import {createServer} from 'node:http';
import WebSocket,{WebSocketServer} from 'ws';
import {allowedRequest} from './policy.mjs';
const upstream='ws://127.0.0.1:9944';
async function rpc(method){
 const socket=new WebSocket(upstream,{maxPayload:16*1024*1024});
 return new Promise((resolve,reject)=>{
  const finish=(error,value)=>{clearTimeout(timer);socket.close();error?reject(error):resolve(value);};
  const timer=setTimeout(()=>{socket.terminate();reject(new Error('RPC timeout'));},10000);
  socket.once('error',error=>finish(error));
  socket.once('open',()=>socket.send(JSON.stringify({jsonrpc:'2.0',id:1,method,params:[]})));
  socket.once('message',data=>{try{const result=JSON.parse(data.toString());if(result.error)throw new Error('RPC failed');finish(null,result.result);}catch(error){finish(error);}});
 });
}
const server=createServer(async(req,res)=>{
 if(req.url!=='/healthz'){res.writeHead(404);res.end();return;}
 try{
  const [runtime,chainType,hash,header]=await Promise.all(['state_getRuntimeVersion','system_chainType','chain_getBlockHash','chain_getHeader'].map(rpc));
  // chain_getBlockHash without a height identifies the current head, not genesis.
  const valid=runtime.specName?.toLowerCase().includes('subtensor') && ['Local','Development'].includes(chainType);
  res.writeHead(valid?200:503,{'Content-Type':'application/json','Cache-Control':'no-store'});
  res.end(JSON.stringify({ready:valid,chainType,runtime:runtime.specName,best:Number.parseInt(header.number,16),headHash:hash}));
 }catch{res.writeHead(503,{'Content-Type':'application/json'});res.end(JSON.stringify({ready:false,error:'Real localnet RPC is unavailable'}));}
});
const wss=new WebSocketServer({server,maxPayload:65536,perMessageDeflate:false});
wss.on('connection',client=>{
 const remote=new WebSocket(upstream,{maxPayload:16*1024*1024,perMessageDeflate:false});
 const queued=[];
 client.on('message',data=>{
  let value;try{value=JSON.parse(data.toString());}catch{client.close(1008,'JSON-RPC required');return;}
  if(!allowedRequest(value)){
   const errors=(Array.isArray(value)?value:[value]).map(item=>({jsonrpc:'2.0',id:item?.id??null,error:{code:-32601,message:'Read-only RPC: method not allowed'}}));
   client.send(JSON.stringify(Array.isArray(value)?errors:errors[0]));return;
  }
  if(remote.readyState===WebSocket.OPEN)remote.send(JSON.stringify(value));
  else if(queued.length<20)queued.push(JSON.stringify(value));
  else client.close(1008,'Too many pending requests');
 });
 remote.on('open',()=>{for(const request of queued.splice(0))remote.send(request);});
 remote.on('message',data=>{if(client.readyState===WebSocket.OPEN)client.send(data.toString());});
 remote.on('error',()=>client.close(1011,'Localnet unavailable'));
 remote.on('close',()=>client.close());
 client.on('close',()=>remote.terminate());client.on('error',()=>remote.terminate());
});
server.listen(8788,'0.0.0.0',()=>console.log('Read-only localnet RPC proxy listening on 8788'));
