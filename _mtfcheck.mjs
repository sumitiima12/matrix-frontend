const { resolveOperand } = await import('./src/domain/strategyLang.js');
const c = [];
let t = Date.UTC(2024,0,1,0,0,0), price = 100;
for (let i=0;i<3*288;i++){ price += Math.sin(i/40)*0.5 + 0.02; c.push({ t, o:price, h:price+0.3, l:price-0.3, c:price, v:100 }); t += 5*60000; }
const closes = c.map(x=>x.c), vols = c.map(x=>x.v);
const defs = [{ name:'EMA1', type:'EMA', len:10, tf:'1D' }];
const base = resolveOperand('EMA1', defs, c, closes, vols, {}, '5m');
const asbase = resolveOperand('EMA1', defs, c, closes, vols, {}, null);
const last = c.length-1;
console.log('bars:', c.length);
console.log('1D-EMA mapped to last 5m bar:', base[last].toFixed(3));
console.log('plain 5m-EMA at last bar    :', asbase[last].toFixed(3));
console.log('distinct (MTF applied)?     :', Math.abs(base[last]-asbase[last]) > 1e-6);
console.log('bar 10 NaN (day 1 not closed):', Number.isNaN(base[10]));
console.log('bar 300 finite (>=1 day closed):', Number.isFinite(base[300]));
