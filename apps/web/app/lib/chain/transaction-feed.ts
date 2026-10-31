import type {ChainBlock} from './explorer';
export function transactionFeedFacts(state:{status:string;updated:number|null;blocks:ChainBlock[]},now:number){
 const hasObservations=state.blocks.length>0;
 const sourceStatus=state.status!=='Connected' ? hasObservations?'Cached observations':state.status
  : state.updated===null?'Reading blocks':now-state.updated>45000?'Updates delayed':'Live WebSocket';
 let signed=0,unsigned=0,events=0;
 for(const block of state.blocks){
  events+=block.events.length;
  for(const tx of block.transactions){if(tx.signer)signed++;else unsigned++;}
 }
 return {blocks:state.blocks.length,signed,unsigned,events,hasObservations,sourceStatus,newest:state.blocks[0]??null};
}
