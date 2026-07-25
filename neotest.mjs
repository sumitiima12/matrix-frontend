import { interpretText } from "./src/domain/strategyLang.js";
for (const t of ["buy when MACD(3,10,16) line crosses above signal","buy when a hammer forms","evening star","buy on shooting star","marubozu"]) {
  const r = interpretText(t);
  console.log(t, "=>", JSON.stringify(r.conds), "defs", JSON.stringify(r.defs), r.unparsed.length?("UNPARSED:"+JSON.stringify(r.unparsed)):"");
}
