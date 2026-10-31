import { describe, expect, it, vi } from 'vitest';
import { ExplorerIndex } from './explorer-index';
import type { ChainBlock } from './explorer';
const block = (number: number, signer = 'Alice'): ChainBlock => ({ number, hash: `block${number}`, parent: '', timestamp: null, events: [], transactions: [{index: 0, hash: `tx${number}`, call: 'balances.transfer', signer, args: ['Bob', '1'], result: 'Success', events: []}] });
describe('bounded finalized explorer index', () => {
  it('keeps the latest 200 heights even when backfill arrives after new heads', () => {
    const index = new ExplorerIndex('genesis');
    for (let n = 510; n >= 0; n--) index.addBlock(block(n));
    expect(index.size).toBe(200);
    expect(index.getBlocks()[0].number).toBe(510);
    expect(index.findTransaction('tx310')).toBeUndefined();
    expect(index.findTransaction('tx311')?.block.number).toBe(311);
  });
  it('replaces a height without leaving stale transaction lookup entries', () => {
    const index = new ExplorerIndex('genesis');
    index.addBlock(block(1));
    index.addBlock({...block(1), hash: 'replacement', transactions: []});
    expect(index.findTransaction('tx1')).toBeUndefined();
  });
  it('finds incoming and outgoing activity and limits newest first', () => {
    const index = new ExplorerIndex('genesis');
    index.addBlock(block(1)); index.addBlock(block(2));
    expect(index.accountTransactions('Bob', 1).map(x => x.block.number)).toEqual([2]);
    expect(index.accountTransactions('Alice').length).toBe(2);
    expect(index.accountTransactions('Al').length).toBe(0);
  });
  it('retains a usable memory index without IndexedDB', async () => {
    const index = new ExplorerIndex('genesis');
    await index.hydrate(); index.addBlock(block(1)); await index.persist();
    expect(index.size).toBe(1);
  });
});

// IndexedDB boundary double: queued request/transaction completion and persistent store.
function databaseBoundary() {
 const stored = new Map<string, unknown>();
 let closed = false;
 const db = {close: () => {closed = true;}, transaction: () => {
  if (closed) throw new Error('Database closed');
  const tx = {oncomplete: undefined as undefined | (() => void), objectStore: () => ({
   put: (value: unknown, key: string) => {stored.set(key,structuredClone(value));queueMicrotask(() => tx.oncomplete?.());},
   get: (key: string) => {const request = {result: structuredClone(stored.get(key)), onsuccess: undefined as undefined | (() => void)};queueMicrotask(() => request.onsuccess?.());return request;},
  })};return tx;
 }};
 const factory = {open: () => {closed = false;const request = {result:db,onsuccess:undefined as undefined | (()=>void)};queueMicrotask(() => request.onsuccess?.());return request;}};
 return {factory, isClosed: () => closed};
}
it('clears memory and persisted history so a reset chain can start at a lower height', async () => {
 const database = databaseBoundary();vi.stubGlobal('indexedDB',database.factory);
 try {
  const index = new ExplorerIndex('reset');index.addBlock(block(500));await index.persist();
  index.clear();expect(index.findTransaction('tx500')).toBeUndefined();expect(index.size).toBe(0);await index.persist();
  const reloaded = new ExplorerIndex('reset');await reloaded.hydrate();expect(reloaded.size).toBe(0);
  reloaded.addBlock(block(1));expect(reloaded.getBlocks()[0].number).toBe(1);
 } finally {vi.unstubAllGlobals();}
});
it('closes the database after pending persistence finishes', async () => {
 const database = databaseBoundary();vi.stubGlobal('indexedDB',database.factory);
 try {
  const index=new ExplorerIndex('closed');index.addBlock(block(3));void index.persist();await index.close();
  expect(database.isClosed()).toBe(true);
  const reloaded=new ExplorerIndex('closed');await reloaded.hydrate();expect(reloaded.findTransaction('tx3')?.block.number).toBe(3);
 } finally {vi.unstubAllGlobals();}
});
