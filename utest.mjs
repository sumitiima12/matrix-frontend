import { UNIVERSE, marketOf } from "./src/domain/universe.js";
for (const m of ["IN","US","Crypto","Commodity"]) {
  const first = (UNIVERSE[m]||[])[0];
  console.log(m, "len", (UNIVERSE[m]||[]).length, "first.sym", first && first.sym, "marketOf(first)=", first && marketOf(first.sym));
}
// simulate a crypto premium strat activated on IN
const s = { symbols: ["XRP"] };
for (const market of ["IN","US","Crypto"]) {
  const relSyms = (s.symbols||[]).filter(x=>marketOf(x)===market);
  const relSym = relSyms[0] || ((UNIVERSE[market]||[])[0]||{}).sym || s.symbols[0] || null;
  console.log("activate on", market, "-> relSym", relSym, "marketOf", marketOf(relSym));
}
