import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {JSDOM} from 'jsdom';
import {createApp} from '../src/server.mjs';
let app,url;
before(async()=>{app=createApp();await new Promise(resolve=>app.server.listen(0,'127.0.0.1',resolve));url=`http://127.0.0.1:${app.server.address().port}`;});
after(async()=>{await app.close();});
test('API rejects cross-origin, malformed and oversized listings',async()=>{
  assert.equal((await fetch(url+'/api/runs',{method:'POST',headers:{Origin:'https://attacker.example','Content-Type':'application/json'},body:'{}'})).status,403);
  assert.equal((await fetch(url+'/api/runs',{method:'POST',body:'{}'})).status,415);
  for(const listing of ['', 'x'.repeat(2049)])assert.equal((await fetch(url+'/api/runs',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({listing})})).status,400);
  assert.equal((await fetch(url+'/../package.json')).status,404);
});
test('dashboard runs live high-risk assessment, displays six receipts and refunds',async()=>{
  const dom=new JSDOM(fs.readFileSync('web/index.html','utf8'),{url,runScripts:'outside-only'});
  const w=dom.window;w.fetch=(path,options)=>fetch(new URL(path,url),options);w.TextEncoder=TextEncoder;w.TextDecoder=TextDecoder;
  w.URL.createObjectURL=()=> 'blob:test';w.URL.revokeObjectURL=()=>{};
  try{
    w.eval(fs.readFileSync('web/app.js','utf8'));
    const until=async(predicate)=>{const start=Date.now();while(!predicate()){if(Date.now()-start>45000)throw new Error(`DOM timeout; UI error: ${w.document.querySelector('#error').textContent}`);await new Promise(r=>setTimeout(r,25));}};
    const $=s=>w.document.querySelector(s);
    await until(()=>$('#listing').value.includes('headphones'));
    $('[data-scenario="risky"]').click();$('#run').click();
    await until(()=>!!$('#settle'));
    assert.equal($('#trace').querySelectorAll('.done').length,6);
    assert.equal($('#settle').dataset.action,'refund');
    assert.match($('#decision').textContent,/held for buyer protection/);
    assert.match($('#evidence-detail').textContent,/Two local EVM chains/);
    $('#settle').click();await until(()=>$('#decision').textContent.includes('Refunded'));
    assert.equal($('#settle'),null);
    w.location.hash='model';await until(()=>!$('#model').hidden);
    assert.equal($('#feature-bars').querySelectorAll('progress').length,10);
    // Listing text is escaped when rendered, including user-supplied markup.
    $('#listing').value='<img src=x onerror=alert(1)> serial tested delivery tracking refund escrow';
    $('#listing').dispatchEvent(new w.Event('input'));$('#run').click();await until(()=>!!$('#settle'));
    assert.equal($('#settle').dataset.action,'release');assert.equal($('#evidence-detail').querySelector('img'),null);
    $('#settle').click();await until(()=>$('#decision').textContent.includes('Released'));
  }finally{dom.window.close();}
});
