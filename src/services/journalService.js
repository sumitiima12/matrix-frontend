/**
 * services/journalService.js — the Trading Journal.
 *
 * The spec: "Every completed trade should become a learning opportunity...
 * The AI should identify patterns and suggest improvements over time."
 *
 * This module turns the raw trade log into (a) enriched journal entries and
 * (b) DETECTED PATTERNS with concrete, specific suggestions.
 *
 * Every insight is derived from the user's actual trades. Nothing is invented,
 * and nothing fires until there is enough evidence to justify it.
 */

const DAY_MS = 86_400_000;

/** Enrich a raw trade with the things a journal needs. */
export function journalEntry(t) {
  const closed = t.exitAt != null && t.exit != null;
  const qty = t.qty || 1;
  const pnl = closed ? (t.exit - t.entry) * qty : null;
  const retPct = closed && t.entry ? ((t.exit - t.entry) / t.entry) * 100 : null;
  const holdMs = closed ? t.exitAt - t.entryAt : Date.now() - (t.entryAt || Date.now());
  const holdDays = holdMs / DAY_MS;

  // R-multiple: how many units of planned risk did we make/lose?
  const riskPerUnit = t.sl ? t.entry * (t.sl / 100) : null;
  const rMultiple = closed && riskPerUnit ? +(((t.exit - t.entry) / riskPerUnit)).toFixed(2) : null;

  return {
    ...t,
    closed,
    pnl,
    retPct: retPct != null ? +retPct.toFixed(2) : null,
    holdDays: +holdDays.toFixed(2),
    holdLabel: holdDays < 1 ? `${Math.round(holdMs / 3_600_000)}h` : `${Math.round(holdDays)}d`,
    rMultiple,
    win: closed ? pnl > 0 : null,
    hadStop: Boolean(t.sl || t.tsl),
    hadTarget: Boolean(t.tp),
  };
}

export function buildJournal(trades) {
  return (trades || []).map(journalEntry).sort((a, b) => (b.entryAt || 0) - (a.entryAt || 0));
}

const pctOf = (n, d) => (d ? (n / d) * 100 : 0);
const avg = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

/**
 * Detect real patterns in the user's trading and suggest improvements.
 * Each insight declares the evidence it is based on; low-sample insights are
 * suppressed rather than presented as fact.
 */
export function analyzeJournal(trades, minSample = 5) {
  const all = buildJournal(trades);
  const closed = all.filter((t) => t.closed);
  const open = all.filter((t) => !t.closed);

  const stats = {
    total: all.length,
    closed: closed.length,
    open: open.length,
    wins: closed.filter((t) => t.win).length,
    losses: closed.filter((t) => !t.win).length,
    winRate: closed.length ? +pctOf(closed.filter((t) => t.win).length, closed.length).toFixed(1) : null,
    netPnl: +closed.reduce((a, t) => a + (t.pnl || 0), 0).toFixed(2),
    avgWin: +avg(closed.filter((t) => t.win).map((t) => t.pnl)).toFixed(2),
    avgLoss: +avg(closed.filter((t) => !t.win).map((t) => t.pnl)).toFixed(2),
    avgHoldDays: +avg(closed.map((t) => t.holdDays)).toFixed(1),
    expectancy: null,
    profitFactor: null,
  };

  const grossWin = closed.filter((t) => t.win).reduce((a, t) => a + t.pnl, 0);
  const grossLoss = Math.abs(closed.filter((t) => !t.win).reduce((a, t) => a + t.pnl, 0));
  stats.profitFactor = grossLoss ? +(grossWin / grossLoss).toFixed(2) : null;
  if (closed.length) {
    const w = stats.winRate / 100;
    stats.expectancy = +((w * stats.avgWin) + ((1 - w) * stats.avgLoss)).toFixed(2);
  }

  const insights = [];

  if (closed.length < minSample) {
    insights.push({
      kind: "info",
      title: "Not enough closed trades yet",
      body: `You have ${closed.length} closed trade${closed.length === 1 ? "" : "s"}. Matrix needs at least ${minSample} before it can call out reliable patterns — anything sooner would be noise, not insight.`,
      evidence: null,
    });
    return { stats, insights, entries: all };
  }

  // 1. Cutting winners / letting losers run (the classic)
  if (stats.avgWin > 0 && stats.avgLoss < 0) {
    const ratio = Math.abs(stats.avgWin / stats.avgLoss);
    if (ratio < 1) {
      insights.push({
        kind: "warn",
        title: "Your losers are bigger than your winners",
        body: `Average win is ${stats.avgWin.toFixed(0)} but average loss is ${Math.abs(stats.avgLoss).toFixed(0)} — a ${ratio.toFixed(2)}:1 ratio. Even a good win rate struggles to overcome that. Consider letting winners run to their target instead of booking early, and tightening stops.`,
        evidence: `${closed.length} closed trades`,
      });
    } else if (ratio >= 2) {
      insights.push({
        kind: "good",
        title: "Good reward-to-risk discipline",
        body: `Your average win (${stats.avgWin.toFixed(0)}) is ${ratio.toFixed(1)}x your average loss (${Math.abs(stats.avgLoss).toFixed(0)}). That asymmetry is what makes a system durable.`,
        evidence: `${closed.length} closed trades`,
      });
    }
  }

  // 2. Trading without stops
  const noStop = all.filter((t) => !t.hadStop);
  if (noStop.length && pctOf(noStop.length, all.length) > 30) {
    const noStopClosed = noStop.filter((t) => t.closed);
    const noStopWr = noStopClosed.length ? pctOf(noStopClosed.filter((t) => t.win).length, noStopClosed.length) : null;
    insights.push({
      kind: "warn",
      title: "Many trades have no stop-loss",
      body: `${noStop.length} of ${all.length} trades (${pctOf(noStop.length, all.length).toFixed(0)}%) were placed without a stop${noStopWr != null ? `, and those won only ${noStopWr.toFixed(0)}% of the time` : ""}. An unprotected position has unbounded downside.`,
      evidence: `${noStop.length} trades`,
    });
  }

  // 3. Which exit type actually works
  const byExit = {};
  closed.forEach((t) => {
    const k = t.exitType || "Manual";
    byExit[k] = byExit[k] || { n: 0, wins: 0, pnl: 0 };
    byExit[k].n++;
    if (t.win) byExit[k].wins++;
    byExit[k].pnl += t.pnl || 0;
  });
  const exitRows = Object.entries(byExit).filter(([, v]) => v.n >= 3);
  if (exitRows.length >= 2) {
    const best = exitRows.reduce((a, b) => (b[1].pnl > a[1].pnl ? b : a));
    const worst = exitRows.reduce((a, b) => (b[1].pnl < a[1].pnl ? b : a));
    if (best[0] !== worst[0]) {
      insights.push({
        kind: "info",
        title: `"${best[0]}" exits are working best`,
        body: `Trades exited via ${best[0]} made ${best[1].pnl.toFixed(0)} across ${best[1].n} trades, while ${worst[0]} exits made ${worst[1].pnl.toFixed(0)} across ${worst[1].n}. Consider leaning on the former.`,
        evidence: `${closed.length} closed trades`,
      });
    }
  }

  // 4. Manual vs automated
  const byType = {};
  closed.forEach((t) => {
    const k = t.tradeType || "Manual";
    byType[k] = byType[k] || { n: 0, wins: 0, pnl: 0 };
    byType[k].n++;
    if (t.win) byType[k].wins++;
    byType[k].pnl += t.pnl || 0;
  });
  const typeRows = Object.entries(byType).filter(([, v]) => v.n >= 3);
  if (typeRows.length >= 2) {
    const best = typeRows.reduce((a, b) => (pctOf(b[1].wins, b[1].n) > pctOf(a[1].wins, a[1].n) ? b : a));
    insights.push({
      kind: "info",
      title: `${best[0]} trades have your best hit rate`,
      body: typeRows
        .map(([k, v]) => `${k}: ${pctOf(v.wins, v.n).toFixed(0)}% win rate over ${v.n} trades (${v.pnl >= 0 ? "+" : ""}${v.pnl.toFixed(0)})`)
        .join(" · "),
      evidence: `${closed.length} closed trades`,
    });
  }

  // 5. Overtrading — many trades in a single day
  const byDay = {};
  all.forEach((t) => {
    const d = new Date(t.entryAt || 0).toDateString();
    byDay[d] = (byDay[d] || 0) + 1;
  });
  const busiest = Object.entries(byDay).sort((a, b) => b[1] - a[1])[0];
  if (busiest && busiest[1] >= 8) {
    insights.push({
      kind: "warn",
      title: "Signs of overtrading",
      body: `You placed ${busiest[1]} trades on ${busiest[0]}. High frequency multiplies costs and usually reflects reacting to noise rather than following a plan.`,
      evidence: `${busiest[1]} trades in one day`,
    });
  }

  // 6. Symbol-level leaks
  const bySym = {};
  closed.forEach((t) => {
    bySym[t.sym] = bySym[t.sym] || { n: 0, pnl: 0 };
    bySym[t.sym].n++;
    bySym[t.sym].pnl += t.pnl || 0;
  });
  const symRows = Object.entries(bySym).filter(([, v]) => v.n >= 3);
  const bleeder = symRows.filter(([, v]) => v.pnl < 0).sort((a, b) => a[1].pnl - b[1].pnl)[0];
  if (bleeder) {
    insights.push({
      kind: "warn",
      title: `${bleeder[0]} keeps costing you money`,
      body: `${bleeder[0]} is down ${Math.abs(bleeder[1].pnl).toFixed(0)} across ${bleeder[1].n} trades. Repeatedly trading a name that doesn't work for you is a common and expensive habit.`,
      evidence: `${bleeder[1].n} trades in ${bleeder[0]}`,
    });
  }

  // 7. Expectancy verdict
  if (stats.expectancy != null) {
    insights.push({
      kind: stats.expectancy >= 0 ? "good" : "warn",
      title: stats.expectancy >= 0 ? "Positive expectancy" : "Negative expectancy",
      body: `Every trade you place is worth ${stats.expectancy >= 0 ? "+" : ""}${stats.expectancy.toFixed(0)} on average (win rate ${stats.winRate}%, avg win ${stats.avgWin.toFixed(0)}, avg loss ${stats.avgLoss.toFixed(0)}).${stats.expectancy < 0 ? " As it stands, trading more will lose more — fix the ratio before increasing size." : ""}`,
      evidence: `${closed.length} closed trades`,
    });
  }

  return { stats, insights, entries: all };
}
