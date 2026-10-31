import { ApiPromise, WsProvider } from '@polkadot/api';
import { ChainSession, type Network, type SessionState } from '@tensorstudio/chain';
import { ExplorerIndex } from './explorer-index';
import { readExplorerBlock, type ChainBlock } from './explorer';

export type LiveState = SessionState<ApiPromise> & {
  blocks: ChainBlock[]; index: ExplorerIndex | null; updated: number | null;
  progress: {done:number;total:number}; revision:number; headHash:string; latencyMs:number|null;
};
export const initialLiveState: LiveState = {api:null,network:'test',endpoint:'',genesis:'',chain:'',status:'Connecting',error:'',best:null,finalized:null,generation:0,subscriptions:0,blocks:[],index:null,updated:null,progress:{done:0,total:20},revision:0,headHash:'',latencyMs:null};
function bounded<T>(promise:Promise<T>,ms=20000):Promise<T>{let timer:ReturnType<typeof setTimeout>;return Promise.race([promise,new Promise<never>((_,reject)=>{timer=setTimeout(()=>reject(new Error('RPC request timed out')),ms);})]).finally(()=>clearTimeout(timer));}
export function createLiveSession(emit:(state:LiveState)=>void) {
  let state={...initialLiveState};
  let cache: ExplorerIndex|null=null;
  let initialized=-1;
  let setup:Promise<void>=Promise.resolve();
  type PendingHead={height:number;hash:string;generation:number;arrived:number};
  let worker:{pending:PendingHead|null;running:boolean;queue:Promise<void>}={pending:null,running:false,queue:Promise.resolve()};
  let canonicalRevision=0;
  const inFlight=new Map<string,Promise<ChainBlock>>();
  const update=(patch:Partial<LiveState>)=>{state={...state,...patch};emit(state);
    if(typeof window !== 'undefined') (window as unknown as {__tensorChain:unknown}).__tensorChain={network:state.network,genesis:state.genesis,generation:state.generation,subscriptions:state.subscriptions,status:state.status,best:state.best,decoded:state.blocks[0]?.number,latencyMs:state.latencyMs,blocks:state.blocks.length};
  };
  const session=new ChainSession<ApiPromise>(endpoint=>{
    const provider=new WsProvider(endpoint,false);
    const api=new ApiPromise({provider,noInitWarn:true});
    return {api,ready:async()=>{await provider.connect();await api.isReadyOrError;const [chain,type]=await Promise.all([api.rpc.system.chain(),api.rpc.system.chainType()]);return {genesis:api.genesisHash.toHex(),chain:chain.toString(),runtime:api.runtimeVersion.specName.toString(),chainType:type.toString()};},heads:cb=>api.rpc.chain.subscribeNewHeads(h=>cb(h.number.toNumber(),h.hash.toHex())),finality:cb=>api.rpc.chain.subscribeFinalizedHeads(h=>cb(h.number.toNumber())),onDisconnect:cb=>{provider.on('disconnected',cb);},close:()=>api.disconnect()};
  });
  const current=(generation:number)=>session.state.generation===generation && !!session.state.api;
  const read=async(api:ApiPromise,hash:string)=>{
    let pending=inFlight.get(hash);
    if(!pending){pending=bounded(readExplorerBlock(api,hash));inFlight.set(hash,pending);void pending.finally(()=>{if(inFlight.get(hash)===pending)inFlight.delete(hash);}).catch(()=>{});}
    return pending;
  };
  const publishCache=()=>update({blocks:cache?.getBlocks()||[],revision:state.revision+1});
  session.subscribe(()=>{
    const next=session.state;
    if(next.generation!==state.generation){void cache?.close();cache=null;inFlight.clear();worker={pending:null,running:false,queue:Promise.resolve()};canonicalRevision++;update({...initialLiveState,...next,progress:{done:0,total:next.network==='local'?100:20}});}
    else update({...next});
    if(next.api && next.genesis && initialized!==next.generation){
      initialized=next.generation;
      const {generation,api,genesis,network}=next;
      const owned=new ExplorerIndex(genesis);cache=owned;
      setup=(async()=>{
        await owned.hydrate();
        const finalizedHash=await bounded(api.rpc.chain.getFinalizedHead());
        const finalized=await bounded(api.rpc.chain.getHeader(finalizedHash));
        if(!current(generation))return;
        owned.removeAfter(finalized.number.toNumber());
        const top=owned.getBlocks()[0];
        if(top && (await bounded(api.rpc.chain.getBlockHash(top.number))).toHex()!==top.hash)owned.clear();
        if(!current(generation))return;
        update({index:owned});publishCache();
      })();
      void setup.catch(()=>{if(current(generation))session.retry();});
      void setup.then(async()=>{
        if(!current(generation))return;
        const head=await bounded(api.rpc.chain.getHeader());
        const top=head.number.toNumber(),total=Math.min(top+1,network==='local'?100:20);
        let done=0;update({progress:{done,total}});
        for(let offset=0;offset<total && current(generation);offset+=2){
          // Yield to live callbacks without waiting for a continuously busy head queue.
          // Backfill stays bounded to two concurrent reads, with shared request deduplication.
          await new Promise<void>(resolve=>setTimeout(resolve,0));
          await Promise.all(Array.from({length:Math.min(2,total-offset)},async(_,i)=>{
            const revision=canonicalRevision;
            const height=top-offset-i;
            if(owned.getBlocks().some(b=>b.number===height)){done++;return;}
            const hash=(await bounded(api.rpc.chain.getBlockHash(height))).toHex();
            const block=await read(api,hash);
            if(current(generation) && canonicalRevision===revision && !owned.getBlocks().some(b=>b.number===height))owned.addBlock(block);
            done++;
          }));
          if(current(generation)){publishCache();update({progress:{done,total}});}
        }
        if(current(generation))void owned.persist();
      }).catch(error=>{if(current(generation))update({error:`Recent history unavailable: ${error.message}. Live subscription remains active.`});});
    }
  });
  const processHead=async({height,hash,generation,arrived}:PendingHead)=>{
      await setup;
      if(!current(generation)||!cache)return;
      const api=session.state.api!,owned=cache;
      const newest=owned.getBlocks()[0];
      // Recover a bounded missed range, and reconcile the parent on forks.
      if(newest && height>newest.number+1){
        const from=Math.max(newest.number+1,height-199);
        if(from>newest.number+1)update({error:'Connection gap exceeds the 200-block window. Earlier history is not indexed.'});
        for(let n=from;n<height && current(generation);n++){
          const h=(await bounded(api.rpc.chain.getBlockHash(n))).toHex();
          const b=await read(api,h);if(current(generation))owned.addBlock(b);
        }
      }
      const block=await read(api,hash);
      if(!current(generation))return;
      const parent=owned.getBlocks().find(b=>b.number===height-1);
      if(parent && parent.hash!==block.parent){
        canonicalRevision++;
        let n=height-1;
        const fork:ChainBlock[]=[];
        while(n>=Math.max(0,height-199)){
          const h=(await bounded(api.rpc.chain.getBlockHash(n))).toHex();
          const known=owned.getBlocks().find(b=>b.number===n);
          if(known?.hash===h)break;
          fork.push(await read(api,h));n--;
        }
        if(!current(generation))return;
        owned.removeAfter(n);fork.reverse().forEach(b=>owned.addBlock(b));
      } else if(newest && height<=newest.number){canonicalRevision++;owned.removeAfter(height-1);}
      owned.addBlock(block);
      publishCache();update({headHash:hash,updated:Date.now(),latencyMs:Math.round(performance.now()-arrived)});
      void owned.persist();
  };
  session.onHead=(height,hash,generation)=>{
    const own=worker;
    own.pending={height,hash,generation,arrived:performance.now()};
    if(own.running)return;
    own.running=true;
    own.queue=(async()=>{
      while(own.pending && current(generation)){
        const next=own.pending;own.pending=null;
        try{await processHead(next);}catch(error){if(current(generation))update({error:`Block ${next.height} unavailable: ${error instanceof Error?error.message:'RPC failure'}`});}
      }
    })().finally(()=>{own.running=false;});
  };
  return {select:(network:Network,endpoint:string)=>session.select(network,endpoint),reconnect:()=>session.reconnect(),suspend:()=>session.suspend(),dispose:async()=>{await session.dispose();await cache?.close();},snapshot:()=>state};
}
