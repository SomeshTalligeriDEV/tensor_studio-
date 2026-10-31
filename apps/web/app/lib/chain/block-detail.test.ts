import {expect,it,vi} from 'vitest';
import type {ApiPromise} from '@polkadot/api';
import {ExplorerIndex} from './explorer-index';
import {loadBlockDetail} from './block-detail';
import type {ChainBlock} from './explorer';
const block:ChainBlock={number:42,hash:'0x'+'a'.repeat(64),parent:'0x'+'b'.repeat(64),timestamp:123,transactions:[],events:[]};
it('opens an already decoded block by number or hash without requesting RPC again',async()=>{
 const index=new ExplorerIndex('genesis');index.addBlock(block);
 for(const query of ['42',block.hash])expect(await loadBlockDetail(null,index,query)).toBe(block);
});
it('reports missing connection for an unindexed block rather than waiting indefinitely',async()=>{
 await expect(loadBlockDetail(null,null,'43')).rejects.toThrow('Connect');
});
it('rejects absent block hashes before requesting a decoded block',async()=>{
 const getBlockHash=vi.fn(async()=>({toHex:()=> '0x'}));
 const api={rpc:{chain:{getBlockHash}}} as unknown as ApiPromise;
 await expect(loadBlockDetail(api,null,'999')).rejects.toThrow('Block not found');
});
