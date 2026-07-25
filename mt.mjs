import { parseMomentum } from "./src/domain/strategyLang.js";
const cases = [
  "tf = 5 mins, current price / price of previous candle close > 1.02",
  "price jumped 2% in 5 mins",
  "up 3% today",
  "stocks down 5% in 1 hour",
  "price / previous close > 1.05 on 4 hours",
  "gained 2% in 1 day",
  "current price / prev candle close > 1.02 daily",
  "RSI > 60 and ADX > 25",
];
for (const c of cases) console.log(JSON.stringify(parseMomentum(c)), "<=", c);
