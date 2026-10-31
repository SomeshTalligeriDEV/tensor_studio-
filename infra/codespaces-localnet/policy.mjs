const reads=new Set([
 'rpc_methods','system_chain','system_chainType','system_name','system_version','system_properties','system_health',
 'chain_subscribeNewHead','chain_unsubscribeNewHead','chain_getFinalisedHead','chain_subscribeFinalisedHeads','chain_unsubscribeFinalisedHeads',
 'chain_getBlock','chain_getBlockHash','chain_getFinalizedHead','chain_getHeader',
 'chain_subscribeNewHeads','chain_unsubscribeNewHeads','chain_subscribeFinalizedHeads','chain_unsubscribeFinalizedHeads',
 'state_getMetadata','state_getRuntimeVersion','state_getStorage','state_getStorageHash','state_getStorageSize','state_getKeysPaged','state_queryStorageAt','state_getReadProof','state_call',
 'state_subscribeRuntimeVersion','state_unsubscribeRuntimeVersion','state_subscribeStorage','state_unsubscribeStorage'
]);
export function allowedRequest(value){
 if(Array.isArray(value))return value.length>0 && value.length<=20 && value.every(allowedRequest);
 return !!value && typeof value==='object' && value.jsonrpc==='2.0' && (typeof value.id==='number'||typeof value.id==='string') && reads.has(value.method) && (value.params===undefined||Array.isArray(value.params));
}
