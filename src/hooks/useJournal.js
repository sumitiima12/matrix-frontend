import { useMemo } from "react";
import { analyzeJournal } from "../services/journalService";

/**
 * useJournal — turns the raw trade log into stats and detected patterns.
 *
 * Thin by design: all the thinking lives in journalService (pure, tested), so
 * the same analysis can be reused by the AI Copilot or an export without React.
 */
export function useJournal(trades) {
  return useMemo(() => analyzeJournal(trades || []), [trades]);
}
