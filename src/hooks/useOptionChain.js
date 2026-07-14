import { useCallback, useEffect, useState } from "react";
import { fetchOptionChain } from "../services/optionService";

/** Loads the real option chain for an underlying. Never invents one. */
export function useOptionChain(underlying, userId, enabled = true) {
  const [chain, setChain] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    if (!enabled || !underlying) return;
    setLoading(true);
    setError(null);
    try {
      setChain(await fetchOptionChain(underlying, userId));
    } catch (e) {
      setChain(null);                       // no chain -> no options. We do not guess one.
      setError(String(e.message || e));
    } finally {
      setLoading(false);
    }
  }, [underlying, userId, enabled]);

  useEffect(() => { load(); }, [load]);

  return { chain, loading, error, reload: load };
}
