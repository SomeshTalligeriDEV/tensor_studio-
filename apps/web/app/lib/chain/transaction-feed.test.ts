import {expect,it} from 'vitest';
import {transactionFeedFacts} from './transaction-feed';
import type {ChainBlock} from './explorer';
const block={number:42,hash:'0xabc',parent:'0xdef',timestamp:1000,transactions:[{signer:null},{signer:null}],events:[{},{},{}]} as unknown as ChainBlock;
it('distinguishes real system-only blocks from absent data',()=>{
 const facts=transactionFeedFacts({status:'Connected',updated:1000,blocks:[block]},1100);
 expect(facts).toMatchObject({blocks:1,signed:0,unsigned:2,events:3,sourceStatus:'Live WebSocket',hasObservations:true});
 expect(facts.newest?.hash).toBe('0xabc');
 const empty=transactionFeedFacts({status:'Connecting',updated:null,blocks:[]},1100);
 expect(empty.hasObservations).toBe(false);expect(empty.sourceStatus).toBe('Connecting');
});
it('counts signed transactions separately and marks cached or delayed observations honestly',()=>{
 const signed={...block,transactions:[{signer:'5Alice'},{signer:null}]} as unknown as ChainBlock;
 expect(transactionFeedFacts({status:'Connected',updated:1000,blocks:[block,signed]},1100)).toMatchObject({blocks:2,signed:1,unsigned:3,events:6});
 expect(transactionFeedFacts({status:'Disconnected',updated:1000,blocks:[block]},1100).sourceStatus).toBe('Cached observations');
 expect(transactionFeedFacts({status:'Connected',updated:1000,blocks:[block]},47000).sourceStatus).toBe('Updates delayed');
});
