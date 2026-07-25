const { resolveOperand } = await import('./src/domain/strategyLang.js');
// realistic 3-min candles, 6 days, choppy + trending so EMAs cross repeatedly
const c=[]; for(let day=0;day<6;day++){ let t=Date.UTC(2024,0,1+day,3,45,0); let p=100+day*1.5;
  for(let i=0;i<125;i++){ p += Math.sin(i/6)*0.9 + (Math.random()-0.45)*0.6; c.push({t,o:p,h:p+0.4,l:p-0.4,c:p,v:100}); t+=3*60000; } }
const cl=c.map(x=>x.c),v=c.map(x=>x.v),cache={};
const defs=[{type:"EMA",len:"9",tf:"3m",name:"E3f"},{type:"EMA",len:"21",tf:"3m",name:"E3s"},{type:"EMA",len:"9",tf:"5m",name:"E5f"},{type:"EMA",len:"21",tf:"5m",name:"E5s"},{type:"EMA",len:"9",tf:"15m",name:"E15f"},{type:"EMA",len:"21",tf:"15m",name:"E15s"}];
const g=(op)=>resolveOperand(op,defs,c,cl,v,cache,"3m");
const E3f=g("E3f"),E3s=g("E3s"),E5f=g("E5f"),E5s=g("E5s"),E15f=g("E15f"),E15s=g("E15s");
let crosses=0, aligned=0, both=0;
for(let i=1;i<c.length;i++){
  const cross = !isNaN(E3f[i-1])&&E3f[i-1]<=E3s[i-1]&&E3f[i]>E3s[i];
  const al = E5f[i]>E5s[i] && E15f[i]>E15s[i];
  if(cross) crosses++; if(al) aligned++; if(cross&&al) both++;
}
console.log("bars:",c.length,"| 3m EMA9>21 crosses:",crosses,"| bars 5m&15m both bullish:",aligned,"| entry signals (cross+align):",both);
console.log("E5f finite sample:",Number.isFinite(E5f[200]),"E15f finite sample:",Number.isFinite(E15f[200]));
