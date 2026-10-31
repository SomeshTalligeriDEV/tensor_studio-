import { readFile, writeFile, mkdir } from 'node:fs/promises';
const secret=JSON.parse(await readFile(new URL('../.deploy/studio-secrets.json',import.meta.url),'utf8'));
const origin='https://tensorstudio-workbench.vercel.app';
const auth='Basic '+Buffer.from('studio:'+secret.STUDIO_ACCESS_PASSWORD).toString('base64');
const results=[];
for(const [path,authenticated] of [['/healthz',false],['/',false],['/runner',false],['/api/models',true],['/api/runner-connection',true]]) {
 const r=await fetch(origin+path,{headers:authenticated?{Authorization:auth,'X-Bitcode-Client':'studio'}:{},signal:AbortSignal.timeout(30000)});
 const text=await r.text();let body;try{body=JSON.parse(text);}catch{body=text.slice(0,140);}
 const safe=path==='/api/runner-connection'&&body?.token?{mode:body.mode,url:body.url,tokenIssued:true}:body;
 results.push({path,authenticated,status:r.status,body:safe});
 console.log(path,r.status,JSON.stringify(safe).slice(0,350));
}
const answer=await fetch(origin+'/api/ask',{method:'POST',headers:{Authorization:auth,'Content-Type':'application/json'},body:JSON.stringify({messages:[{role:'user',content:'Briefly explain how TensorStudio can help me plan a Bittensor subnet. Ask one focused question about my idea.'}]}),signal:AbortSignal.timeout(65000)});
const answerText=await answer.text();console.log('Live AI',answer.status,answerText.slice(0,450));results.push({path:'/api/ask',status:answer.status,body:answerText});
await mkdir(new URL('../artifacts/demo/',import.meta.url),{recursive:true});
await writeFile(new URL('../artifacts/demo/deployed-check.json',import.meta.url),JSON.stringify({checkedAt:new Date().toISOString(),results},null,2));
