import http from 'node:http';
import fs from 'node:fs';
import {fileURLToPath} from 'node:url';
import {localFixture,localLoop} from './local.mjs';
import {SCENARIOS,features} from '../model/features.mjs';
import {MODEL_HASH,modelBytes} from './risk.mjs';
import {json,save} from './chain.mjs';
import {envInt} from './config.mjs';
export function createApp(){
  let fixturePromise, busy=false;
  const runs=[];
  const archives=fs.existsSync('evidence/local-demo.json')?JSON.parse(fs.readFileSync('evidence/local-demo.json','utf8')).runs.map((r,i)=>({...r,runId:`archive-${i}`,archived:true})):[];
  const server=http.createServer(async(req,res)=>{
    res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Cache-Control','no-store');
    res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'");
    const reply=(status,data)=>{res.writeHead(status,{'Content-Type':'application/json'});res.end(json(data));};
    try{
      const host=req.headers.host||'';
      if(!/^(localhost|127\.0\.0\.1)(:\d+)?$/.test(host))return reply(403,{error:'Use the loopback URL shown in the terminal'});
      const url=new URL(req.url,`http://${host}`);
      if(req.method==='GET'&&url.pathname==='/api/bootstrap')return reply(200,{mode:'local-simulation',runs:[...runs,...archives],scenarios:SCENARIOS,model:{...JSON.parse(modelBytes),hash:MODEL_HASH,w1:undefined,w2:undefined,b1:undefined,b2:undefined}});
      if(req.method==='POST'){
        if(req.headers.origin&&req.headers.origin!==`http://${host}`)return reply(403,{error:'Origin rejected'});
        if(!req.headers['content-type']?.startsWith('application/json'))return reply(415,{error:'JSON required'});
        let body='';for await(const chunk of req){body+=chunk;if(Buffer.byteLength(body)>8192)return reply(413,{error:'Request too large'});}
        let input;try{input=JSON.parse(body);}catch{return reply(400,{error:'Invalid JSON'});}
        if(url.pathname==='/api/runs'){
          try{features(input.listing);}catch(error){return reply(400,{error:error.message});}
          if(busy)return reply(409,{error:'A local transaction sequence is running. Try again shortly.'});
          busy=true;
          try{
            const f=await(fixturePromise??=localFixture());
            res.writeHead(200,{'Content-Type':'application/x-ndjson'});
            const run=await localLoop(f,input.listing,step=>res.write(JSON.stringify({type:'step',step})+'\n'));
            run.runId=crypto.randomUUID();run.title=typeof input.title==='string'?input.title.slice(0,90):'Custom listing';
            runs.unshift(run);save('.state/dashboard-runs.json',runs);
            res.end(JSON.stringify({type:'complete',run})+'\n');
          }catch(error){if(res.headersSent)res.end(JSON.stringify({type:'error',error:error.shortMessage||error.message})+'\n');else reply(500,{error:'Local chain initialization failed'});}
          finally{busy=false;}
          return;
        }
        const match=url.pathname.match(/^\/api\/runs\/([\w-]+)\/(release|refund)$/);
        if(match){
          const run=runs.find(r=>r.runId===match[1]);if(!run)return reply(404,{error:'Only current-session escrows can be changed'});
          if(busy)return reply(409,{error:'Wait for the active transaction sequence'});
          if((match[2]==='release'&&run.status!=='Cleared')||(match[2]==='refund'&&run.status!=='Frozen'))return reply(409,{error:'Action unavailable in this state'});
          busy=true;try{
            const f=await fixturePromise;const receipt=await(await f.vault.connect(f.buyer)[match[2]](run.id)).wait();
            run.status=match[2]==='release'?'Released':'Refunded';run.settlement={txHash:receipt.hash,action:match[2]};save('.state/dashboard-runs.json',runs);reply(200,{run});
          }finally{busy=false;}
          return;
        }
        return reply(404,{error:'Unknown action'});
      }
      if(req.method!=='GET')return reply(405,{error:'Method not allowed'});
      const files={'/':['index.html','text/html'],'/app.js':['app.js','text/javascript'],'/styles.css':['styles.css','text/css']};
      const file=files[url.pathname];if(!file)return reply(404,{error:'Not found'});
      res.writeHead(200,{'Content-Type':file[1]});res.end(fs.readFileSync(new URL(`../web/${file[0]}`,import.meta.url)));
    }catch(error){if(!res.headersSent)reply(500,{error:error.shortMessage||error.message});else res.end();}
  });
  return {server,close:async()=>{server.closeAllConnections();await new Promise(r=>server.close(r));if(fixturePromise)await(await fixturePromise).close();}};
}
if(process.argv[1]===fileURLToPath(import.meta.url)){
  if(!fs.existsSync('artifacts/SentinelReactive.json')){const {compile}=await import('../scripts/compile.mjs');compile();}
  const app=createApp();const port=envInt('PORT',3000,1);
  app.server.listen(port,'127.0.0.1',()=>console.log(`Sentinel Escrow: http://localhost:${port}\nLocal simulation only. No wallet or API key required. Ctrl+C to stop.`));
  for(const signal of ['SIGINT','SIGTERM'])process.once(signal,async()=>{await app.close();process.exit(0);});
}
