export function forward(model, x) {
  const hidden = model.w1.map((row,i)=>Math.tanh(row.reduce((sum,w,j)=>sum+w*x[j],model.b1[i])));
  const z = model.w2.reduce((sum,w,i)=>sum+w*hidden[i],model.b2);
  return {hidden, probability:1/(1+Math.exp(-Math.max(-30,Math.min(30,z))))};
}
