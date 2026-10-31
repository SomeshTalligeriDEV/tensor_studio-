import WebSocket from 'ws';
const endpoint=process.argv[2]||'ws://127.0.0.1:8788';
const socket=new WebSocket(endpoint,{maxPayload:16*1024*1024});
const pending=new Map();let serial=0;
const deadline=setTimeout(()=>{console.error('Real localnet verification timed out');socket.terminate();process.exit(1);},90000);
socket.on('message',data=>{
 const message=JSON.parse(data.toString());
 if(pending.has(message.id)){const {resolve,reject}=pending.get(message.id);pending.delete(message.id);message.error?reject(new Error(message.error.message)):resolve(message.result);}
 if(message.params)onHead(message.params);
});
function rpc(method,params=[]){return new Promise((resolve,reject)=>{const id=++serial;pending.set(id,{resolve,reject});socket.send(JSON.stringify({jsonrpc:'2.0',id,method,params}));});}
let onHead=()=>{};
try{
 await new Promise((resolve,reject)=>{socket.once('open',resolve);socket.once('error',reject);});
 const [runtime,chainType,genesis,header,finalizedHash]=await Promise.all([rpc('state_getRuntimeVersion'),rpc('system_chainType'),rpc('chain_getBlockHash',[0]),rpc('chain_getHeader'),rpc('chain_getFinalizedHead')]);
 if(!runtime.specName.toLowerCase().includes('subtensor')||!['Local','Development'].includes(chainType))throw new Error('Not a real Development/Local Subtensor chain');
 if(genesis==='0x8f9cf856bf558a14440e75569c9e58594757048d7b3a84b5d25f6bd978263105')throw new Error('Public testnet must not be labelled localnet');
 const finalized=await rpc('chain_getHeader',[finalizedHash]);
 const startingBest=parseInt(header.number,16),startingFinalized=parseInt(finalized.number,16);
 const progress={best:startingBest,finalized:startingFinalized};
 const advanced=new Promise(resolve=>{onHead=({subscription,result})=>{const kind=subscriptions.get(subscription);if(kind)progress[kind]=parseInt(result.number,16);if(progress.best>startingBest&&progress.finalized>startingFinalized)resolve();};});
 const subscriptions=new Map();
 subscriptions.set(await rpc('chain_subscribeNewHeads'),'best');
 subscriptions.set(await rpc('chain_subscribeFinalizedHeads'),'finalized');
 await advanced;
 let denied=false;try{await rpc('author_submitExtrinsic',['0x00']);}catch{denied=true;}
 if(!denied)throw new Error('Public proxy unexpectedly accepts writes');
 console.log(JSON.stringify({endpoint,chainType,genesis,runtime:runtime.specName,specVersion:runtime.specVersion,before:{best:startingBest,finalized:startingFinalized},after:progress,streamed:true,writesBlocked:true}));
}catch(error){console.error(error.message);process.exitCode=1;}finally{clearTimeout(deadline);socket.close();}
