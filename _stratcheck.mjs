const { SEED_STRATS } = await import('./src/domain/strategies.js');
const { backtest } = await import('./src/domain/backtest.js');
let bad = [];
for (const s of SEED_STRATS) {
  const c = s.cfg;
  if (!c || c.mode !== "builder") continue;
  const tfok = (c.defs||[]).every(d => d.tf === "5m");
  if (!tfok || c.sl !== "0.5" || c.tp !== "1") bad.push(s.name+" tf/sl/tp");
}
console.log("total strategies:", SEED_STRATS.length);
console.log("tf/sl/tp violations:", bad.length ? bad : "none");
// sanity: run one backtest on synthetic candles to ensure cfgs don't throw
const c = []; let t=Date.UTC(2024,0,1), p=100;
for (let i=0;i<600;i++){ p += Math.sin(i/15)*1.2 + 0.05; c.push({t,o:p,h:p+0.5,l:p-0.5,c:p,v:100}); t+=5*60000; }
let errs=0;
for (const s of SEED_STRATS){ try{ if(s.cfg&&s.cfg.mode==="builder") backtest(s.cfg,c,1,"5m"); }catch(e){ errs++; console.log("ERR",s.name,e.message); } }
console.log("backtest errors across all strategies:", errs);
