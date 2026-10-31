import type {ApiPromise} from '@polkadot/api';
import {parseExplorerSearch,readExplorerBlock,type ChainBlock} from './explorer';
import type {ExplorerIndex} from './explorer-index';
import {bounded} from '~/components/explorer/useExplorer';
export function indexedBlock(index:ExplorerIndex|null,query:string):ChainBlock|undefined{
 const number=/^\d+(?:-\d+)?$/.test(query)?Number(query.split('-')[0]):null;
 return index?.getBlocks().find(block=>number===null?block.hash.toLowerCase()===query.toLowerCase():block.number===number);
}
/** Reuse an actual decoded block before making another historical RPC read. */
export async function loadBlockDetail(api:ApiPromise|null,index:ExplorerIndex|null,query:string):Promise<ChainBlock>{
 const search=parseExplorerSearch(query);
 if(!['block','hash','transaction'].includes(search.kind))throw new Error('Enter a block number or block hash.');
 const cached=indexedBlock(index,query);if(cached)return cached;
 if(!api)throw new Error('Connect to the selected network to read this block.');
 const hash=search.kind==='hash'?search.value:(await bounded(api.rpc.chain.getBlockHash(Number(search.value)))).toHex();
 if(!/^0x[0-9a-f]{64}$/i.test(hash)||/^0x0+$/.test(hash))throw new Error('Block not found on this network.');
 return bounded(readExplorerBlock(api,hash));
}
