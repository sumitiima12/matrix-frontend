const { SEED_STRATS } = await import('./src/domain/strategies.js');
const { backtest } = await import('./src/domain/backtest.js');
const { resolveOperand } = await import('./src/domain/strategyLang.js');
// Build 5 trading days of 5-min candles (75 bars/day, starting 03:45 UTC = NSE open)
const c = [];
for (let day=0; day<5; day++){
  let t = Date.UTC(2024,0,1+day,3,45,0); let p = 100 + day*2;
  for (let i=0;i<75;i++){ const up = Math.sin(i/8)*1.5; p += up*0.4 + 0.06; c.push({t,o:p,h:p+0.6,l:p-0.6,c:p,v:100}); t += 5*60000; }
}
const closes=c.map(x=>x.c), vols=c.map(x=>x.v);
// ORB operand check
const orb = resolveOperand("OR.high",[{type:"ORB",len:"15",name:"OR"}],c,closes,vols,{});
console.log("ORB.high resets per day? day0 bar0..3:", orb.slice(0,4).map(x=>x.toFixed(1)).join(","), "| day1 bar75:", orb[75].toFixed(1));
const s59 = SEED_STRATS.find(s=>s.id==="s59"), s60 = SEED_STRATS.find(s=>s.id==="s60");
console.log("s59 name/tf:", s59.name, s59.tf, "| defs tfs:", s59.cfg.defs.map(d=>d.tf).join(","));
console.log("s60 name/tf:", s60.name, s60.tf, "| sl/tp:", s60.cfg.sl, s60.cfg.tp, "| premium:", s60.premium);
const r59 = backtest(s59.cfg, c, 1, "3m");
const r60 = backtest(s60.cfg, c, 1, "5m");
console.log("s59 MTF trades:", r59.stats.n, "| s60 ORB trades:", r60.stats.n);
