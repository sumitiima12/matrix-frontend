const { SEED_STRATS } = await import('./src/domain/strategies.js');
const { backtest } = await import('./src/domain/backtest.js');
const c=[]; for(let d=0;d<6;d++){ let t=Date.UTC(2024,0,1+d,3,45,0); let p=100+d*1.5;
  for(let i=0;i<125;i++){ p+=Math.sin(i/6)*0.9+(Math.random()-0.45)*0.6; c.push({t,o:p,h:p+0.4,l:p-0.4,c:p,v:100}); t+=3*60000; } }
const s59=SEED_STRATS.find(s=>s.id==="s59");
console.log("s59 trades now:", backtest(s59.cfg,c,1,"3m").stats.n);
