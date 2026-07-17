import { closedCandles } from "../lib/series";
import { resolveOptionOrder } from "../domain/options";
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
export function evaluate({ cfg, candles: raw, position, price, now = Date.now() }) {
  if (!cfg || !raw || raw.length < 2) return { action: "NONE", reason: "no candles" };

  /* ONLY COMPLETED CANDLES.
     The last bar of a live series is the one currently forming: its close IS the live
     price and it moves every tick. Evaluating on it means "close crossed above the
     upper band" can be true at 10:31:05 and false at 10:31:40 — the engine buys into a
     cross that never happened, then holds a position the rule no longer justifies.
     A closed candle is a fact. A forming one is a rumour. We act on facts. */
  const candles = closedCandles(raw, now);
  if (candles.length < 2) return { action: "NONE", reason: "no completed candles yet" };

  const closes = candles.map((x) => x.c);
  const vols = candles.map((x) => x.v || 0);
  const cache = {};
  const get = (op) => resolveOperand(op, cfg.defs, candles, closes, vols, cache);

  const i = candles.length - 1;                 // the last COMPLETED bar

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
export function runOnce({ strats, getCandles, getStock, getChain, positions, capitalOf, onBuy, onSell }) {
  const next = { ...positions };
  const log = [];

  /* Per-strategy, per-DAY counters. Stored under a reserved key in the same positions map
     so they survive across ticks (the engine is otherwise stateless between runs). The day
     stamp resets them automatically when the date rolls over — a "max 5 trades a day" limit
     that never reset would silently kill the strategy on day two. */
  const today = new Date().toISOString().slice(0, 10);
  const counterKey = (id) => `__count|${id}`;
  const getCount = (id) => {
    const c = next[counterKey(id)];
    return c && c.day === today ? c : { day: today, entries: 0, reentries: 0 };
  };

  (strats || []).filter((s) => s.active).forEach((strat) => {
    const syms = strat.symbols || [];
    if (!syms.length) return;

    /* Caps, with the documented defaults. maxTrades counts FRESH entries in the day;
       maxReentries counts entries on a symbol the strategy has already traded and exited
       today (a re-entry). Both default the way the UI shows them: 5 and 5. */
    const maxTrades = strat.maxTrades != null ? strat.maxTrades : 5;
    const maxReentries = strat.maxReentries != null ? strat.maxReentries : 5;
    const count = getCount(strat.id);
    if (count.entries >= maxTrades) {
      log.push({ strat: strat.name, action: "SKIP", reason: `daily trade cap reached (${maxTrades})` });
      return;
    }

    syms.forEach((sym) => {
      const stock = getStock(sym);
      if (!stock || stock.price == null) return;         // no live price -> no order. Ever.

      const candles = getCandles(sym, (strat.cfg && strat.cfg.tf) || "1D");
      if (!candles || candles.length < 2) return;        // no real data -> do nothing

      const key = `${strat.id}|${sym}`;
      const position = next[key] || null;

      /* Has this strategy already traded-and-exited this symbol today? If so, a new entry
         is a RE-ENTRY and counts against the separate re-entry budget. */
      const exitedKey = `__exited|${strat.id}|${sym}`;
      const exitedToday = next[exitedKey] === today;

      const intent = evaluate({ cfg: strat.cfg, candles, position, price: stock.price });

      if (intent.action === "BUY" && !position) {
        /* Re-entry budget. If we've already traded and exited this symbol today, this is a
           re-entry — refuse once the re-entry cap is hit. */
        if (exitedToday && count.reentries >= maxReentries) {
          log.push({ sym, strat: strat.name, action: "SKIP", reason: `re-entry cap reached (${maxReentries})` });
          return;
        }
        /* Also respect the daily fresh-trade cap at the per-symbol level (the top-level
           guard catches it before the symbol loop; this catches entries accumulated
           earlier in THIS tick across multiple symbols). */
        if (count.entries >= maxTrades) {
          log.push({ sym, strat: strat.name, action: "SKIP", reason: `daily trade cap reached (${maxTrades})` });
          return;
        }

        /* OPTION LEG. The strategy says "trade the option, not the stock" — so the exact
           contract is resolved HERE, at the moment the signal fires, against the broker's
           live chain. Not at configuration time: a strike that was ATM when you set the
           strategy up is not ATM after a 400-point move.

           If the chain won't load, or the ladder doesn't reach the requested strike, or we
           have no real lot size — the strategy DOES NOT TRADE. An automation firing on a
           guessed contract is far worse than one that skips a signal. */
        const wantOpt = strat.opt && strat.opt.enabled;

        if (wantOpt) {
          const chain = getChain ? getChain(sym) : null;
          if (!chain) {
            log.push({ sym, strat: strat.name, action: "SKIP", reason: "option chain unavailable — not guessing a contract" });
            return;
          }
          const r = resolveOptionOrder(chain, strat.opt, stock.price);
          if (!r || r.contract.ltp == null) {
            log.push({ sym, strat: strat.name, action: "SKIP", reason: "no listed contract, or no live premium, for that strike" });
            return;
          }

          const optStock = {
            ...stock,
            sym: r.contract.symbol,              // the BROKER's symbol, verbatim
            name: `${sym} ${r.strike} ${r.type === "CE" ? "CALL" : "PUT"}`,
            price: r.contract.ltp,               // the real premium, not the spot
            under: sym,
            isOpt: true,
            lot: r.lotSize,
            strike: r.strike,
            optType: r.type,
            expiry: r.expiry,
          };

          onBuy(optStock, r.qty, {
            tp: strat.cfg && strat.cfg.tp,
            sl: strat.cfg && strat.cfg.sl,
            tradeType: "Automate",
            strategy: strat.name,
            strategyId: strat.id,
            market: "IN",                        // options file under Indian. There is no F&O market.
          });

          next[key] = {
            qty: r.qty, entry: r.contract.ltp, at: Date.now(),
            optSymbol: r.contract.symbol, lotSize: r.lotSize,
            strike: r.strike, optType: r.type, expiry: r.expiry,
          };
          count.entries += 1;
          if (exitedToday) count.reentries += 1;
          next[counterKey(strat.id)] = count;
          log.push({ sym, strat: strat.name, action: "BUY", qty: r.qty, price: r.contract.ltp, contract: r.contract.symbol, reason: intent.reason });
          return;
        }

        /* EXPLICIT quantity. The strategy now carries a share/lot count (default 1) rather
           than a rupee capital that we divide by price — the user asked for exactly N,
           they get exactly N. Falls back to the old capital-sizing only if an older
           strategy has no qty saved. */
        const qty = strat.qty != null
          ? Math.max(1, strat.qty)
          : Math.max(1, Math.floor((capitalOf(strat) / syms.length) / stock.price));
        if (!Number.isFinite(qty) || qty < 1) return;

        /* LIMIT price is computed HERE, at fire time, from the live signal price — not
           stored at config time, when the price was something else entirely. For a buy the
           limit sits BELOW the trigger by the offset, so we buy a small pullback rather
           than chasing the breakout. A MARKET order carries no price. */
        /* Indian options are LIMIT-only — a market order on an illiquid option
           can fill far from the quote, so the exchange/broker won't accept one.
           Any strategy that trades an option leg is forced to Limit regardless of
           what was saved. */
        const isOptStrat = !!(strat.opt && strat.opt.enabled);
        const isLimit = isOptStrat || strat.entryType === "Limit";
        const off = isLimit ? (Number(strat.limitOffset) || 0) / 100 : 0;
        const limitPrice = isLimit ? +(stock.price * (1 - off)).toFixed(2) : null;

        onBuy(stock, qty, {
          tp: strat.cfg && strat.cfg.tp,
          sl: strat.cfg && strat.cfg.sl,
          tradeType: "Automate",
          strategy: strat.name,
          strategyId: strat.id,
          market: "IN",
          product: strat.buyType === "NRML" ? "NRML" : "MIS",   // Intraday -> MIS
          orderType: isLimit ? "LIMIT" : "MARKET",
          ...(limitPrice != null ? { limitPrice } : {}),
        });
        next[key] = { qty, entry: stock.price, at: Date.now() };
        count.entries += 1;
        if (exitedToday) count.reentries += 1;
        next[counterKey(strat.id)] = count;
        log.push({ sym, strat: strat.name, action: "BUY", qty, price: stock.price, reason: intent.reason });
      }

      if (intent.action === "SELL" && position) {
        /* Sell THE CONTRACT WE BOUGHT — not the underlying, and not whatever is ATM now.
           The position remembers its own symbol. We also need its CURRENT premium: exiting
           at the spot price, or at the entry premium, would book a P&L that never happened.
           If we can't price the contract this minute, we skip and try again next minute
           rather than recording an invented exit. */
        if (position.optSymbol) {
          const chain = getChain ? getChain(sym) : null;
          const live = chain && chain.contracts.find((c) => c.symbol === position.optSymbol);

          if (!live || live.ltp == null) {
            log.push({ sym, strat: strat.name, action: "SKIP", reason: "cannot price the option to exit — will retry" });
            return;
          }

          onSell(
            { ...stock, sym: position.optSymbol, price: live.ltp, isOpt: true, lot: position.lotSize, under: sym },
            position.qty,
            { tradeType: "Automate", strategy: strat.name, strategyId: strat.id, market: "IN" }
          );
          delete next[key];
          next[exitedKey] = today;
          log.push({ sym, strat: strat.name, action: "SELL", qty: position.qty, price: live.ltp, contract: position.optSymbol, reason: intent.reason });
          return;
        }

        onSell(stock, position.qty, {
          tradeType: "Automate",
          strategy: strat.name,
          strategyId: strat.id,
          market: "IN",
        });
        delete next[key];
        next[exitedKey] = today;
        log.push({ sym, strat: strat.name, action: "SELL", qty: position.qty, price: stock.price, reason: intent.reason });
      }
    });
  });

  return { positions: next, log };
}
