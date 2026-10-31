import { decodeAddress } from '@polkadot/util-crypto';
import type { ChainBlock, ChainTransaction } from './explorer';

export type IndexedTransaction = { block: ChainBlock; transaction: ChainTransaction };
const MAX_BLOCKS = 200;
function addressKey(value: string): string {
  try { return Array.from(decodeAddress(value)).join(','); } catch { return value; }
}
function containsAddress(value: unknown, address: string): boolean {
  if (typeof value === 'string') return addressKey(value) === address;
  if (Array.isArray(value)) return value.some(item => containsAddress(item, address));
  return !!value && typeof value === 'object' && Object.values(value).some(item => containsAddress(item, address));
}

/** Bounded observed-block cache. Caller reconciles canonical hashes on reconnect/reorg. */
export class ExplorerIndex {
  private blocks = new Map<number, ChainBlock>();
  private database: Promise<IDBDatabase | null> | undefined;
  private writes: Promise<void> = Promise.resolve();
  constructor(readonly genesisHash: string) {}
  /** Clear memory immediately; call persist() to replace this chain's stored history. */
  clear(): void { this.blocks.clear(); }
  /** Flush pending writes, then release this instance's IndexedDB connection. */
  async close(): Promise<void> {
    await this.writes;
    const db = await this.database;
    db?.close();
    this.database = Promise.resolve(null);
  }
  removeAfter(height: number): void { for (const key of this.blocks.keys()) if (key > height) this.blocks.delete(key); }
  get size() { return this.blocks.size; }
  getBlocks(): ChainBlock[] { return [...this.blocks.values()].sort((a, b) => b.number - a.number); }
  addBlock(block: ChainBlock): void {
    this.blocks.set(block.number, block);
    for (const old of this.getBlocks().slice(MAX_BLOCKS)) this.blocks.delete(old.number);
  }
  findTransaction(hash: string): IndexedTransaction | undefined {
    for (const block of this.getBlocks()) {
      const transaction = block.transactions.find(tx => tx.hash.toLowerCase() === hash.toLowerCase());
      if (transaction) return { block, transaction };
    }
    return undefined;
  }
  accountTransactions(address: string, limit = 25): IndexedTransaction[] {
    const key = addressKey(address);
    return this.getBlocks().flatMap(block => block.transactions.filter(tx =>
      (tx.signer !== null && addressKey(tx.signer) === key) || containsAddress(tx.args, key) || containsAddress(tx.events.map(event => event.data), key),
    ).map(transaction => ({block, transaction}))).slice(0, Math.max(0, limit));
  }
  private open(): Promise<IDBDatabase | null> {
    if (!this.database) this.database = new Promise(resolve => {
      if (typeof indexedDB === 'undefined') { resolve(null); return; }
      try {
        const request = indexedDB.open('tensorstudio-explorer', 1);
        request.onupgradeneeded = () => request.result.createObjectStore('chains');
        request.onsuccess = () => { request.result.onversionchange = () => request.result.close(); resolve(request.result); };
        request.onerror = () => resolve(null);
        request.onblocked = () => resolve(null);
      } catch { resolve(null); }
    });
    return this.database;
  }
  async hydrate(): Promise<void> {
    const db = await this.open();
    if (!db) return;
    const stored = await new Promise<ChainBlock[]>(resolve => {
      try {
        const request = db.transaction('chains', 'readonly').objectStore('chains').get(this.genesisHash);
        request.onsuccess = () => resolve(Array.isArray(request.result) ? request.result : []);
        request.onerror = () => resolve([]);
      } catch { resolve([]); }
    });
    for (const block of stored) {
      if (Number.isSafeInteger(block?.number) && typeof block.hash === 'string' && Array.isArray(block.transactions) && !this.blocks.has(block.number)) this.addBlock(block);
    }
  }
  /** Quota/private-mode failures leave the live in-memory index available. */
  persist(): Promise<void> {
    this.writes = this.writes.then(async () => {
      const db = await this.open();
      if (!db) return;
      await new Promise<void>(resolve => {
        try {
          const tx = db.transaction('chains', 'readwrite');
          tx.objectStore('chains').put(this.getBlocks(), this.genesisHash);
          tx.oncomplete = () => resolve(); tx.onerror = () => resolve(); tx.onabort = () => resolve();
        } catch { resolve(); }
      });
    });
    return this.writes;
  }
}
