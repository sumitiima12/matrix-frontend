import { useMemo, useState } from "react";
import { ALL, marketOf } from "../domain/universe";
import { techSignal } from "../domain/signals";
import { analyzeHolding, portfolioHealth, sectorExposure } from "../services/portfolioService";

const START_WALLET = 1000000;
const MARKETS = ["IN", "US", "Crypto", "Commodity"];

/**
 * usePortfolio — holdings, per-market wallets, and the AI portfolio intelligence.
 *
 * It deliberately exposes NO buy/sell. Orders go through useOrders so they can't
 * skip the Risk Engine; this hook only holds state and derives insight from it.
 */
export function usePortfolio() {
  const [portfolio, setPortfolio] = useState([]);
  const [walletMap, setWalletMap] = useState(
    () => Object.fromEntries(MARKETS.map((m) => [m, START_WALLET]))
  );

  const adjustWallet = (mkt, delta) =>
    setWalletMap((w) => ({ ...w, [mkt]: (w[mkt] ?? START_WALLET) + delta }));

  const updateHolding = (sym, patch) =>
    setPortfolio((p) => p.map((h) => (h.sym === sym ? { ...h, ...patch } : h)));

  /** Per-holding intelligence, from the SAME real signal engine the picks use. */
  const intel = useMemo(() => {
    const map = {};
    portfolio.forEach((h) => {
      const st = ALL.find((a) => a.sym === h.sym);
      map[h.sym] = analyzeHolding(h, st, st ? techSignal(st) : null);
    });
    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [portfolio.map((h) => `${h.sym}:${h.qty}:${h.sl || ""}:${h.tp || ""}`).join(",")]);

  const analyses = useMemo(() => Object.values(intel), [intel]);

  const health = useMemo(
    () => portfolioHealth(analyses, walletMap.IN ?? 0),
    [analyses, walletMap]
  );

  const sectors = useMemo(
    () => sectorExposure(analyses, (sym) => ALL.find((a) => a.sym === sym)),
    [analyses]
  );

  return {
    portfolio, setPortfolio,
    walletMap, setWalletMap, adjustWallet,
    updateHolding,
    intel, health, sectors,
  };
}
