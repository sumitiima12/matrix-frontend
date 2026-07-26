import { useCallback, useEffect, useRef, useState } from "react";
import { BACKEND_URL } from "../config";
import { ALL, marketOf } from "../domain/universe";
import { postTrade, resolveExitFromCandles } from "../domain/api";
import { validateOrder, DEFAULT_LIMITS } from "../services/riskService";
import { fmt } from "../lib/format";

/**
 * useOrders — THE ORDER EXECUTION PIPELINE.
 *
 * The spec is explicit that every trade follows one path and takes no shortcuts:
 *
 *   Recommendation -> Strategy -> RISK ENGINE -> Broker Adapter -> Broker
 *     -> Order Status -> Portfolio Update -> Trade Journal -> Notifications
 *
 * This hook owns that pipeline. Manual buys, pick buys, auto-buy and automations
 * all call placeOrder() — none of them touch the portfolio directly. That means
 * the Risk Engine cannot be bypassed, and the journal can never miss a trade.
 *
 * The broker step is injected (`broker`), so swapping MockBroker for a real
 * adapter changes nothing here or anywhere upstream.
 */
export function useOrders({ portfolio, setPortfolio, walletMap, adjustWallet, userId, broker, notify }) {
  const [trades, setTrades] = useState([]);
  const [riskLimits, setRiskLimits] = useState(DEFAULT_LIMITS);
  const resolving = useRef(false);

  /* ------------------------------ journal ------------------------------ */
  const recordTrade = useCallback((t) => {
    const rec = {
      id: t.id || `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      tradeType: t.tradeType || "Manual",
      exitType: t.exitType || "Manual",
      ...t,
    };
    setTrades((p) => (rec.id && p.some((x) => x.id === rec.id) ? p : [rec, ...p].slice(0, 5000)));
    postTrade(userId, rec);
    return rec;
  }, [userId]);

  const recordBatch = useCallback((list) => (list || []).forEach(recordTrade), [recordTrade]);

  /* --------------------------- the pipeline --------------------------- */
  /**
   * Place an order. Returns { ok, reasons, warnings, order }.
   * Nothing else in the app is allowed to mutate the portfolio.
   */
  const placeOrder = useCallback(async ({ stock, side = "BUY", qty = 1, opts = {} }) => {
    const market = opts.market || marketOf(stock.sym);
    const price = stock.price;

    // 1 ── RISK ENGINE. No order proceeds without passing here.
    const verdict = validateOrder(
      { sym: stock.sym, side, qty, price, market },
      {
        wallet: walletMap[market] ?? 0,
        portfolio: portfolio.filter((h) => marketOf(h.sym) === market),
        trades,
        limits: riskLimits,
      }
    );
    if (!verdict.ok) {
      notify?.({ kind: "risk", text: verdict.reasons[0], error: true });
      // Journal the REJECT (buys only) with its reason so it shows in Orders under "Rejected" — a
      // paper reject used to vanish (only real orders were logged), so the Rejected filter was empty.
      if (side === "BUY") {
        try { recordTrade({ id: `rej-${Date.now()}-${stock.sym}`, sym: stock.sym, market, qty, side: "BUY", entryAt: Date.now(), tradeType: opts.tradeType || "Manual", strategy: opts.strategy || null, status: "rejected", rejectReason: verdict.reasons[0] }); } catch {}
      }
      return { ok: false, reasons: verdict.reasons, warnings: verdict.warnings };
    }
    if (verdict.warnings.length) notify?.({ kind: "risk", text: verdict.warnings[0] });

    // 2 ── BROKER ADAPTER. The app never knows which broker is behind this.
    const res = await broker.placeOrder({
      symbol: stock.sym, side, qty, price, market,
      orderType: opts.orderType || "MARKET",
      ...(opts.limitPrice != null ? { limitPrice: opts.limitPrice } : {}),
      product: opts.product,
    });

    // 3 ── ORDER STATUS.
    if (res.status !== "FILLED") {
      notify?.({ kind: "order", text: `Order rejected: ${res.reason || "broker declined"}`, error: true });
      if (side === "BUY") {
        try { recordTrade({ id: `rej-${Date.now()}-${stock.sym}`, sym: stock.sym, market, qty, side: "BUY", entryAt: Date.now(), tradeType: opts.tradeType || "Manual", strategy: opts.strategy || null, status: "rejected", rejectReason: res.reason || "broker declined" }); } catch {}
      }
      return { ok: false, reasons: [res.reason || "Broker rejected the order."], warnings: [] };
    }

    // A sell with a momentarily-missing quote falls back to the position's own price so the
    // close still books a sane value. Buys always have a price (the risk engine required it).
    const heldNow = portfolio.find((h) => h.sym === stock.sym);
    const fill = res.avgPrice ?? price ?? (heldNow ? (heldNow.buy ?? heldNow.avg) : null) ?? 0;
    const cost = fill * qty;

    // 4 ── PORTFOLIO UPDATE. Supports LONG and SHORT positions:
    //   BUY  → cover an open short (books P&L), else open/add a long.
    //   SELL → close a long you hold (books P&L), else open/add a short.
    const matchMkt = (h) => h.sym === stock.sym && (h.market || marketOf(h.sym)) === market;
    const isShort = (h) => h.side === "SELL" || h.short;
    const newLong = (q, price0) => ({
      sym: stock.sym, qty: q, buy: price0, date: Date.now(), market: opts.market || market || "IN",
      isOpt: Boolean(stock.isOpt), under: stock.under || null,
      product: opts.product === "MIS" ? "MIS" : "CNC", boughtAt: Date.now(),
      tradeType: opts.tradeType || "Manual", sl: opts.sl ?? null, tp: opts.tp ?? null, tsl: opts.tsl ?? null,
    });
    let realized = null;                 // P&L booked by this order (only when it CLOSES a position)
    let openEntry = fill;                // entry price to journal (the position's original entry on a close)
    const existing = portfolio.find(matchMkt);

    if (side === "BUY") {
      if (existing && isShort(existing)) {
        // Cover a short: profit when the cover price is BELOW the short entry.
        const coverQty = Math.min(qty, existing.qty || 0);
        realized = (existing.buy - fill) * coverQty; openEntry = existing.buy;
        adjustWallet(market, realized);
        setPortfolio((p) => p.map((h) => (matchMkt(h) && isShort(h)) ? { ...h, qty: (Number(h.qty) || 0) - coverQty } : h).filter((h) => (Number(h.qty) || 0) > 1e-9));
      } else {
        adjustWallet(market, -cost);
        setPortfolio((p) => {
          const held = p.find((h) => matchMkt(h) && !isShort(h));
          if (held) {
            const totalQty = held.qty + qty;
            const avg = (held.buy * held.qty + fill * qty) / totalQty;
            return p.map((h) => (matchMkt(h) && !isShort(h)) ? { ...h, qty: totalQty, buy: +avg.toFixed(2), product: h.product === "MIS" && opts.product === "MIS" ? "MIS" : (h.product || "CNC"), boughtAt: h.boughtAt || Date.now(), sl: opts.sl ?? h.sl, tp: opts.tp ?? h.tp, tsl: opts.tsl ?? h.tsl } : h);
          }
          return [...p, newLong(qty, fill)];
        });
      }
    } else {   // SELL
      if (existing && !isShort(existing)) {
        // Close a long: proceeds + P&L (profit when the sell price is ABOVE the buy).
        const closeQty = Math.min(qty, existing.qty || 0);
        realized = (fill - existing.buy) * closeQty; openEntry = existing.buy;
        adjustWallet(market, fill * closeQty);
        setPortfolio((p) => p.map((h) => (matchMkt(h) && !isShort(h)) ? { ...h, qty: (Number(h.qty) || 0) - closeQty } : h).filter((h) => (Number(h.qty) || 0) > 1e-9));
      } else {
        // Open / add a SHORT. Paper margin is ignored (no cash moves on open); P&L books on cover.
        setPortfolio((p) => {
          const sh = p.find((h) => matchMkt(h) && isShort(h));
          if (sh) {
            const totalQty = sh.qty + qty;
            const avg = (sh.buy * sh.qty + fill * qty) / totalQty;
            return p.map((h) => (matchMkt(h) && isShort(h)) ? { ...h, qty: totalQty, buy: +avg.toFixed(2), sl: opts.sl ?? h.sl, tp: opts.tp ?? h.tp } : h);
          }
          return [...p, { ...newLong(qty, fill), side: "SELL", short: true }];
        });
      }
    }

    // 5 ── TRADE JOURNAL. Closing orders carry the realized P&L + the round-trip entry/exit; opening a
    //     short is flagged so downstream P&L knows the direction.
    const closing = realized != null;
    const openedShort = side === "SELL" && !closing;
    const order = recordTrade({
      sym: stock.sym, market, qty, side,
      entry: openEntry, entryAt: Date.now(),
      ...(closing ? { exit: fill, exitAt: Date.now(), pnl: +realized.toFixed(2), closed: true } : {}),
      ...(openedShort ? { short: true } : {}),
      ...(closing && existing && isShort(existing) ? { short: true, coversShort: true } : {}),
      sl: opts.sl ?? null, tp: opts.tp ?? null, tsl: opts.tsl ?? null,
      tradeType: opts.tradeType || "Manual",
      strategy: opts.strategy || null,
      strategyId: opts.strategyId || null,
      brokerOrderId: res.orderId,
      broker: res.broker,
    });

    // 6 ── NOTIFICATIONS.
    notify?.({
      kind: side === "BUY" ? "fill" : "exit",
      text: `${side === "BUY" ? "Bought" : "Sold"} ${qty} ${stock.sym} at ${fmt(fill, market)}`,
    });

    return { ok: true, reasons: [], warnings: verdict.warnings, order };
  }, [portfolio, setPortfolio, walletMap, adjustWallet, trades, riskLimits, broker, notify, recordTrade]);

  /* ------------------------ real exit monitoring ------------------------ */
  // Every minute, check each OPEN position that has a stop/target against REAL
  // intraday candles. If a level was actually touched, close at that real price.
  useEffect(() => {
    if (!BACKEND_URL) return;

    const applyClose = (t, closed) => {
      const qty = closed.qty || t.qty || 1;
      setTrades((p) => p.map((x) => (x.id === t.id ? closed : x)));
      adjustWallet(closed.market || "IN", closed.exit * qty);
      setPortfolio((p) => p
        .map((x) => (x.sym === closed.sym ? { ...x, qty: x.qty - qty } : x))
        .filter((x) => x.qty > 0));
      const pnl = closed.pnl || 0;
      notify?.({
        kind: pnl >= 0 ? "target" : "stop",
        text: `${closed.sym} auto-exited at ${fmt(closed.exit, closed.market || "IN")} (${closed.exitType}) · P&L ${pnl >= 0 ? "+" : ""}${fmt(pnl, closed.market || "IN")}`,
        error: pnl < 0,
      });
    };

    const tick = async () => {
      if (resolving.current) return;
      resolving.current = true;
      try {
        const open = trades.filter((t) => t.exitAt == null && (t.sl || t.tp || t.tsl));
        for (const t of open) {
          const holding = portfolio.find((h) => h.sym === t.sym);
          const risk = holding ? { sl: holding.sl, tp: holding.tp, tsl: holding.tsl } : {};
          const hit = await resolveExitFromCandles(t, risk);
          if (!hit) continue;
          const qty = t.qty || 1;
          const closed = {
            ...t, ...hit,
            pnl: +((hit.exit - t.entry) * qty).toFixed(2),
          };
          applyClose(t, closed);
          postTrade(userId, closed);
        }
      } finally {
        resolving.current = false;
      }
    };

    tick();
    const id = setInterval(tick, 60000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trades, portfolio, userId]);

  return { trades, setTrades, recordTrade, recordBatch, placeOrder, riskLimits, setRiskLimits };
}
