import { ApiPromise, WsProvider } from '@polkadot/api';
const api = new ApiPromise({ provider: new WsProvider('wss://test.finney.opentensor.ai:443', 1000), noInitWarn: true });
const timer=setTimeout(()=>process.exit(2),90000);
try {
 await api.isReadyOrError;
 const hash=await api.rpc.chain.getFinalizedHead(); const at=await api.at(hash);
 console.log(JSON.stringify({genesis:api.genesisHash.toHex(),spec:api.runtimeVersion.specVersion.toString(),block:hash.toHex(),calls:Object.keys(at.call),subnetCalls:at.call.subnetInfoRuntimeApi && Object.keys(at.call.subnetInfoRuntimeApi)}));
 console.log('SWAP',Object.keys(at.call.swapRuntimeApi));
 const price=await at.call.swapRuntimeApi.currentAlphaPrice(1);console.log('PRICE',price.toRawType(),price.toString(),JSON.stringify(price.toJSON()));
} finally {clearTimeout(timer);await api.disconnect();}
