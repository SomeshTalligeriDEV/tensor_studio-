/** Standalone read-only explorer. Deliberately excludes every Studio write/runner route. */
import { createServer } from 'node:http';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { Readable } from 'node:stream';
import { createRequestHandler } from '@remix-run/cloudflare';
import * as build from '../build/server/index.js';
const handle=createRequestHandler(build,'production');
const publicDir=resolve(new URL('../build/client',import.meta.url).pathname);
const mime={'.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.png':'image/png','.webp':'image/webp','.ico':'image/x-icon','.woff2':'font/woff2','.json':'application/json'};
export function allowedPath(path){return path==='/scan'||path.startsWith('/scan/')||path==='/api/market'||path==='/api/chain-config';}
const server=createServer(async(req,res)=>{
 try{
  const url=new URL(req.url,'http://localhost');
  if(!['GET','HEAD'].includes(req.method)){res.writeHead(405);res.end('Read-only explorer');return;}
  if(url.pathname==='/healthz'){res.setHeader('Content-Type','application/json');res.end(JSON.stringify({service:'tensorscan',status:'ok'}));return;}
  if(url.pathname==='/'){res.writeHead(302,{Location:'/scan?network=test'});res.end();return;}
  if(!allowedPath(url.pathname)){
   const file=resolve(publicDir,'.'+decodeURIComponent(url.pathname));
   if(file.startsWith(publicDir+sep)&&!file.endsWith('.map')){
    const info=await stat(file).catch(()=>null);
    if(info?.isFile()){res.setHeader('Content-Type',mime[extname(file)]||'application/octet-stream');res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Cache-Control',url.pathname.startsWith('/assets/')?'public,max-age=31536000,immutable':'public,max-age=300');if(req.method==='HEAD'){res.end();return;}createReadStream(file).pipe(res);return;}
   }
   res.writeHead(404);res.end('TensorScan route not found');return;
  }
  // Public origin is configured, never trusted from arbitrary forwarded headers.
  const origin=process.env.PUBLIC_ORIGIN||`http://localhost:${process.env.PORT||10000}`;
  const request=new Request(new URL(req.url,origin),{method:req.method,headers:req.headers});
  const response=await handle(request,{cloudflare:{env:{CHAIN_WS:process.env.CHAIN_WS||'',SCAN_PUBLIC_ONLY:process.env.CHAIN_WS?'':'1'}},requestId:crypto.randomUUID()});
  res.writeHead(response.status,Object.fromEntries(response.headers));
  if(req.method==='HEAD'||!response.body){res.end();return;}
  Readable.fromWeb(response.body).pipe(res);
 }catch(error){console.error('TensorScan request failed:',error instanceof Error?error.message:'Unknown error');if(!res.headersSent)res.writeHead(500);res.end('Explorer request unavailable');}
});
server.listen(Number(process.env.PORT||10000),'0.0.0.0',()=>console.log('TensorScan listening on port',process.env.PORT||10000));
