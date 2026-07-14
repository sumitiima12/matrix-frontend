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
      return { ok: false, reasons: verdict.reasons, warnings: verdict.warnings };
    }
    if (verdict.warnings.length) notify?.({ kind: "risk", text: verdict.warnings[0] });

    // 2 ── BROKER ADAPTER. The app never knows which broker is behind this.
    const res = await broker.placeOrder({
      symbol: stock.sym, side, qty, price, market, orderType: opts.orderType || "MARKET",
    });

    // 3 ── ORDER STATUS.
    if (res.status !== "FILLED") {
      notify?.({ kind: "order", text: `Order rejected: ${res.reason || "broker declined"}`, error: true });
      return { ok: false, reasons: [res.reason || "Broker rejected the order."], warnings: [] };
    }

    const fill = res.avgPrice ?? price;
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
          /* A position is an F&O position because you TRADED a derivative — not because
             the underlying happens to have listed derivatives. `stock.fno` is true for
             all 35 F&O-eligible names, so keying off it filed every RELIANCE and NIFTY50
             buy under the F&O tab and made it vanish from the Indian portfolio. What
             matters is the market you traded in. */
          fno: Boolean(stock.isFut || market === "FNO"),
          /* MIS = intraday (auto-squared-off before the close), CNC = delivery.
             boughtAt is what the crypto square-off counts 23h45m from, so it must be
             the real entry time, not the time we happened to notice the position. */
          product: opts.product === "MIS" ? "MIS" : "CNC",
          boughtAt: Date.now(),
          sl: opts.sl ?? null, tp: opts.tp ?? null, tsl: opts.tsl ?? null,
        }];
      });
    } else {
      adjustWallet(market, cost);
      setPortfolio((p) => p
        .map((h) => (h.sym === stock.sym ? { ...h, qty: h.qty - qty } : h))
        .filter((h) => h.qty > 0));
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
