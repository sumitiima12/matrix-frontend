import { interpretText, detectTf } from "./src/domain/strategyLang.js";
const txt = "macd 3,10,16 (3 mins) crosses above macd signal";
console.log("detectTf:", detectTf(txt));
const r = interpretText(txt);
console.log("conds:", JSON.stringify(r.conds));
console.log("defs :", JSON.stringify(r.defs));
for (const t of ["rsi 21 (5 min)","ema 20 crosses above ema 50 on 15m","buy on daily","1 hour macd"]) console.log(t, "=> tf", detectTf(t));
