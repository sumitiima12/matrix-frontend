import { chainEval, resolveOperand } from "../domain/strategyLang";

/**
 * services/automationEngine.js — the thing that makes "automated strategy" TRUE.
 *
 * WHAT WAS THERE BEFORE
 * ---------------------
 * `recordAutomateTrades` bought EVERY symbol in the strategy the instant you
 * activated it — without ever evaluating the entry rule — and then never sold.
 * There was no monitoring loop. So a "strategy" was really just "market-buy
 * everything now", and its rules were decoration. Worse, it *looked* like it
 * worked: trades appeared, a P&L accrued.
 *
 * WHAT THIS DOES
 * --------------
 * On each tick, for every ACTIVE strategy and every symbol it watches:
 *
 *   - not holding  ->  evaluate the ENTRY rule on the latest real candle.
 *                      Only if it is TRUE do we buy.
 *   - holding      ->  evaluate the EXIT rule, and check the stop-loss and
 *                      take-profit against the REAL live price. Any one of them
 *                      triggers a SELL.
 *
 * Rules are evaluated at the LAST CLOSED BAR (index length-1) using the same
 * strategyLang the backtest uses — so what you backtested is what runs. If the
 * candles haven't loaded, the strategy does nothing. It does not guess.
 *
 * Positions are tracked per (strategyId, symbol) so a strategy cannot buy the
 * same symbol twice, and cannot sell something it never bought.
 */

/** Evaluate one strategy against one symbol's candles. Pure: returns an intent. */
export function evaluate({ cfg, candles, position, price }) {
  if (!cfg || !candles || candles.length < 2) return { action: "NONE", reason: "no candles" };

  const closes = candles.map((x) => x.c);
  const vols = candles.map((x) => x.v || 0);
  const cache = {};
  const get = (op) => resolveOperand(op, cfg.defs, candles, closes, vols, cache);

  const i = candles.length - 1;                 // the latest real bar

  if (!position) {
    let entry = false;
    try { entry = Boolean(chainEval(cfg.entry, i, get)); } catch { return { action: "NONE", reason: "rule error" }; }
    return entry
      ? { action: "BUY", reason: "Entry rule met" }
      : { action: "NONE", reason: "Entry rule not met" };
  }

  // Holding: stop-loss and take-profit measured against the REAL live price.
  const ref = price != null ? price : closes[i];
  const ret = ref / position.entry - 1;

  const slPct = cfg.sl != null ? Math.abs(Number(cfg.sl)) / 100 : null;
  const tpPct = cfg.tp != null ? Math.abs(Number(cfg.tp)) / 100 : null;

  if (slPct != null && ret <= -slPct) return { action: "SELL", reason: `Stop-loss hit (${(ret * 100).toFixed(1)}%)` };
  if (tpPct != null && ret >= tpPct)  return { action: "SELL", reason: `Target hit (+${(ret * 100).toFixed(1)}%)` };

  let exit = false;
  try { exit = Boolean(chainEval(cfg.exit, i, get)); } catch { exit = false; }
  if (exit) return { action: "SELL", reason: "Exit rule met" };

  return { action: "NONE", reason: "Holding" };
}

/**
 * Run every active strategy once.
 *
 * @param strats      strategy list
 * @param getCandles  (sym, tf) => candles | null   (real candles; null = not loaded)
 * @param getStock    (sym) => stock | null         (for the live price)
 * @param positions   { "<stratId>|<sym>": {qty, entry} }
 * @param onBuy/onSell  order placers (these go through the real order pipeline)
 * @returns updated positions + a log of what it did
 */
export function runOnce({ strats, getCandles, getStock, positions, capitalOf, onBuy, onSell }) {
  const next = { ...positions };
  const log = [];

  (strats || []).filter((s) => s.active).forEach((strat) => {
    const syms = strat.symbols || [];
    if (!syms.length) return;

    syms.forEach((sym) => {
      const stock = getStock(sym);
      if (!stock || stock.price == null) return;         // no live price -> no order. Ever.

      const candles = getCandles(sym, (strat.cfg && strat.cfg.tf) || "1D");
      if (!candles || candles.length < 2) return;        // no real data -> do nothing

      const key = `${strat.id}|${sym}`;
      const position = next[key] || null;

      const intent = evaluate({ cfg: strat.cfg, candles, position, price: stock.price });

      if (intent.action === "BUY" && !position) {
        const cap = capitalOf(strat) / syms.length;
        const qty = Math.max(1, Math.floor(cap / stock.price));
        if (!Number.isFinite(qty) || qty < 1) return;

        onBuy(stock, qty, {
          tp: strat.cfg && strat.cfg.tp,
          sl: strat.cfg && strat.cfg.sl,
          tradeType: "Automate",
          strategy: strat.name,
          strategyId: strat.id,
        });
        next[key] = { qty, entry: stock.price, at: Date.now() };
        log.push({ sym, strat: strat.name, action: "BUY", qty, price: stock.price, reason: intent.reason });
      }

      if (intent.action === "SELL" && position) {
        onSell(stock, position.qty, {
          tradeType: "Automate",
          strategy: strat.name,
          strategyId: strat.id,
        });
        delete next[key];
        log.push({ sym, strat: strat.name, action: "SELL", qty: position.qty, price: stock.price, reason: intent.reason });
      }
    });
  });

  return { positions: next, log };
}
