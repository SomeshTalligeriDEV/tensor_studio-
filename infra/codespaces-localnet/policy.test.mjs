import {test} from 'node:test';
import assert from 'node:assert/strict';
import {allowedRequest} from './policy.mjs';
test('permits actual block, runtime, storage and head subscription reads',()=>{
 for(const method of ['chain_getBlock','chain_getBlockHash','state_getMetadata','state_queryStorageAt','state_call','system_chainType','chain_subscribeNewHeads','chain_subscribeNewHead','chain_unsubscribeNewHead','chain_getFinalisedHead','chain_subscribeFinalisedHeads','chain_unsubscribeFinalisedHeads','chain_subscribeFinalizedHeads','state_subscribeRuntimeVersion'])assert.equal(allowedRequest({jsonrpc:'2.0',id:1,method,params:[]}),true,method);
});
test('blocks submissions, keys, unsafe administration and malformed or oversized batches',()=>{
 for(const method of ['author_submitExtrinsic','author_insertKey','system_addReservedPeer','sudo','state_setStorage','chain_getBlockAndSubmit'])assert.equal(allowedRequest({jsonrpc:'2.0',id:1,method,params:[]}),false,method);
 for(const value of [null,[],{},[{jsonrpc:'2.0',id:1,method:'chain_getBlock'},{jsonrpc:'2.0',id:2,method:'author_submitExtrinsic'}],Array(21).fill({jsonrpc:'2.0',id:1,method:'chain_getBlock'})])assert.equal(allowedRequest(value),false);
});
