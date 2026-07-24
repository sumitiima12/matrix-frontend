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

    // 4 ── PORTFOLIO UPDATE.
    if (side === "BUY") {
      adjustWallet(market, -cost);
      setPortfolio((p) => {
        const held = p.find((h) => h.sym === stock.sym);
        if (held) {
          const totalQty = held.qty + qty;
          const avg = (held.buy * held.qty + fill * qty) / totalQty;
          return p.map((h) => (h.sym === stock.sym
            ? {
                ...h, qty: totalQty, buy: +avg.toFixed(2),
                // Adding intraday to a delivery holding would make the whole position
                // subject to square-off. Delivery wins; intraday never escalates.
                product: h.product === "MIS" && opts.product === "MIS" ? "MIS" : (h.product || "CNC"),
                boughtAt: h.boughtAt || Date.now(),
                sl: opts.sl ?? h.sl, tp: opts.tp ?? h.tp, tsl: opts.tsl ?? h.tsl,
              }
            : h));
        }
        return [...p, {
          sym: stock.sym, qty, buy: fill, date: Date.now(),
          market,
          /* STORE THE MARKET ON THE HOLDING.
             The portfolio used to work out a holding's market by looking its SYMBOL up in
             the universe. That breaks for options: "NSE:NIFTY26JUL24050CE" is a broker
             contract string, not a universe entry, so marketOf() returns nothing and the
             position matches no tab — you would own it and never see it. The market you
             traded in is a fact known at order time; record it rather than re-derive it. */
          /* The order's own market wins: an automation option passes market:"IN"
             explicitly, and its symbol ("NSE:NIFTY26JUL24050CE") cannot be looked up in
             the universe — so if we didn't record it, the position would match no tab. */
          market: opts.market || market || "IN",
          isOpt: Boolean(stock.isOpt),
          under: stock.under || null,
          /* MIS = intraday (auto-squared-off before the close), CNC = delivery.
             boughtAt is what the crypto square-off counts 23h45m from, so it must be
             the real entry time, not the time we happened to notice the position. */
          product: opts.product === "MIS" ? "MIS" : "CNC",
          boughtAt: Date.now(),
          // How this position was acquired. It was already stamped on the TRADE log but
          // never on the HOLDING, so the portfolio had no way to tell a strategy's
          // position from one you opened yourself.
          tradeType: opts.tradeType || "Manual",
          sl: opts.sl ?? null, tp: opts.tp ?? null, tsl: opts.tsl ?? null,
        }];
      });
    } else {
      adjustWallet(market, cost);
      const sellQty = Number(qty) || 0;
      setPortfolio((p) => p
        .map((h) => {
          // Target the exact holding: same symbol AND same market. Falls back to marketOf
          // when a holding has no explicit market (older positions).
          const hMarket = h.market || marketOf(h.sym);
          const isMatch = h.sym === stock.sym && hMarket === market;
          if (!isMatch) return h;
          return { ...h, qty: (Number(h.qty) || 0) - sellQty };
        })
        .filter((h) => (Number(h.qty) || 0) > 1e-9));   // > tiny epsilon: kills float dust too
    }

    // 5 ── TRADE JOURNAL.
    const order = recordTrade({
      sym: stock.sym, market, qty, side,
      entry: fill, entryAt: Date.now(),
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
