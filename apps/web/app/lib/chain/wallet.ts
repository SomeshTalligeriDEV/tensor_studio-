import { Keyring } from '@polkadot/keyring';
import type { KeyringPair, KeyringPair$Json } from '@polkadot/keyring/types';
import { cryptoWaitReady, mnemonicGenerate, mnemonicValidate } from '@polkadot/util-crypto';
import type { Signer } from './signer';
import { z } from 'zod';

export type EncryptedWallet = KeyringPair$Json;
const keyring = () => new Keyring({ type: 'sr25519', ss58Format: 42 });
export const MAX_WALLET_BYTES = 64 * 1024;
const walletSchema = z.object({
  address: z.string().min(1).max(128),
  encoded: z.string().min(1).max(MAX_WALLET_BYTES),
  encoding: z.object({
    content: z.tuple([z.literal('pkcs8'), z.literal('sr25519')]),
    type: z.tuple([z.literal('scrypt'), z.literal('xsalsa20-poly1305')]),
    version: z.literal('3'),
  }),
});

export function parseEncryptedWallet(value: unknown): EncryptedWallet {
  const parsed = walletSchema.safeParse(value);
  if (!parsed.success) throw new Error('Use a version 3 encrypted sr25519 wallet JSON backup.');
  // Do not persist arbitrary metadata or extra fields from imported files.
  return { ...parsed.data, meta: {} };
}

export async function importEncryptedWallet(text: string, password: string): Promise<EncryptedWallet> {
  if (new TextEncoder().encode(text).length > MAX_WALLET_BYTES) throw new Error('Wallet backup must be smaller than 64 KB.');
  let value: unknown;
  try { value = JSON.parse(text); } catch { throw new Error('Wallet backup is not valid JSON.'); }
  const wallet = parseEncryptedWallet(value);
  const signer = await MnemonicSigner.unlock(wallet, password);
  try { return { ...wallet, address: signer.address }; } finally { signer.lock(); }
}

export async function generateMnemonic() {
  await cryptoWaitReady();
  return mnemonicGenerate(12);
}

export async function encryptMnemonic(mnemonic: string, password: string): Promise<EncryptedWallet> {
  await cryptoWaitReady();
  if (password.length < 12) throw new Error('Use a password of at least 12 characters.');
  const normalized = mnemonic.trim().split(/\s+/).join(' ');
  if (normalized.split(' ').length !== 12 || !mnemonicValidate(normalized)) throw new Error('Enter a valid 12-word recovery phrase.');
  const pair = keyring().addFromMnemonic(normalized);
  try { return pair.toJson(password); } finally { pair.lock(); }
}

export class MnemonicSigner implements Signer {
  readonly kind = 'mnemonic' as const;
  #pair: KeyringPair;
  private constructor(pair: KeyringPair) { this.#pair = pair; }
  get address() { return this.#pair.address; }
  get locked() { return this.#pair.isLocked; }
  static async unlock(wallet: EncryptedWallet, password: string) {
    await cryptoWaitReady();
    const pair = keyring().addFromJson(parseEncryptedWallet(wallet));
    const expectedAddress = pair.address;
    try {
      pair.decodePkcs8(password);
      if (pair.address !== expectedAddress) throw new Error('Address mismatch');
    } catch { pair.lock(); throw new Error('Incorrect password or damaged wallet.'); }
    return new MnemonicSigner(pair);
  }
  async sign(payload: Uint8Array) {
    if (this.locked) throw new Error('Unlock your wallet first.');
    return this.#pair.sign(payload, { withType: true });
  }
  lock() { this.#pair.lock(); }
}

function database(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('bitcode-wallet', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('wallets');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(new Error('Browser wallet storage is unavailable.'));
  });
}

export async function loadWallet(): Promise<EncryptedWallet | undefined> {
  const db = await database();
  try {
    return await new Promise((resolve, reject) => {
      const request = db.transaction('wallets').objectStore('wallets').get('primary');
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(new Error('Could not read wallet.'));
    });
  } finally { db.close(); }
}

export async function saveWallet(wallet: EncryptedWallet) {
  wallet = parseEncryptedWallet(wallet);
  const db = await database();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction('wallets', 'readwrite');
      // add refuses to overwrite an existing wallet, including from another tab.
      tx.objectStore('wallets').add(wallet, 'primary');
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(new Error('Wallet could not be saved; an existing wallet will not be overwritten.'));
      tx.onabort = () => reject(new Error('Wallet save was cancelled.'));
    });
  } finally { db.close(); }
}
