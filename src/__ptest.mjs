import { detectPatterns } from "./domain/patterns.js";
const C = (arr) => arr.map((p,i) => ({ i, o:p, h:p+0.3, l:p-0.3, c:p, t:i }));
// clean W (double bottom): trough ~100 twice, peak 108 between, break above 108
const w = [114,112,110,108,106,104,102,100, 102,104,106,108, 106,104,102,100, 102,104,106,108,110,112];
console.log("DoubleBottom:", JSON.stringify(detectPatterns(C(w))[0]||"none"));
// clean M (double top)
const m = [100,102,104,106,108,110,112,114, 112,110,108,106, 108,110,112,114, 112,110,108,106,104,102];
console.log("DoubleTop:", JSON.stringify(detectPatterns(C(m))[0]||"none"));
// ascending triangle: flat top 120, rising lows
let at=[]; for(let i=0;i<28;i++){ at.push(i%4<2 ? 120 : 106 + i*0.45); }
console.log("Triangle:", JSON.stringify(detectPatterns(C(at))[0]||"none"));
