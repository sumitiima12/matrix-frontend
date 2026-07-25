import { parseClause, condCode } from "./src/domain/strategyLang.js";
for (const s of ["close > open","close < open","high > close","low < open","price > 100","rsi > 60"]) {
  const r = parseClause(s);
  console.log(s.padEnd(24), "=>", r ? condCode(r.cond) : "null");
}
