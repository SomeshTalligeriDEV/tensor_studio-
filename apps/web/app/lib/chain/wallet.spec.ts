import { describe, expect, it } from 'vitest';
import { signatureVerify } from '@polkadot/util-crypto';
import { encryptMnemonic, generateMnemonic, importEncryptedWallet, MAX_WALLET_BYTES, MnemonicSigner, parseEncryptedWallet } from './wallet';

describe('browser wallet cryptography', () => {
  it('encrypts, restores the same address, rejects bad passwords, and locks signing', async () => {
    const phrase = await generateMnemonic();
    expect(phrase.split(' ')).toHaveLength(12);
    const encrypted = await encryptMnemonic(phrase, 'a test password long enough');
    expect(JSON.stringify(encrypted)).not.toContain(phrase);
    expect(encrypted.encoding.type).toContain('scrypt');
    const imported = await importEncryptedWallet(JSON.stringify({ ...encrypted, meta: { name: phrase }, extra: phrase }), 'a test password long enough');
    expect(imported.address).toBe(encrypted.address);
    expect(JSON.stringify(imported)).not.toContain(phrase);
    await expect(importEncryptedWallet(JSON.stringify(encrypted), 'wrong')).rejects.toThrow('Incorrect');
    const other = await encryptMnemonic(await generateMnemonic(), 'another long password');
    await expect(importEncryptedWallet(JSON.stringify({ ...encrypted, address: other.address }), 'a test password long enough')).rejects.toThrow('damaged');
    expect(() => parseEncryptedWallet({ ...encrypted, encoding: { ...encrypted.encoding, content: ['pkcs8', 'ed25519'] } })).toThrow('sr25519');
    expect(() => parseEncryptedWallet({ ...encrypted, encoding: { ...encrypted.encoding, type: ['none'] } })).toThrow('encrypted');
    await expect(MnemonicSigner.unlock(encrypted, 'wrong')).rejects.toThrow('Incorrect');
    const signer = await MnemonicSigner.unlock(encrypted, 'a test password long enough');
    expect(signer.address).toMatch(/^5/);
    const restored = await encryptMnemonic(phrase, 'a different test password');
    expect(restored.address).toBe(signer.address);
    const payload = new TextEncoder().encode('Bitcode local signing test');
    expect(signatureVerify(payload, await signer.sign(payload), signer.address).isValid).toBe(true);
    signer.lock();
    await expect(signer.sign(payload)).rejects.toThrow('Unlock');
  }, 30000);
  it('rejects invalid phrases and weak passwords', async () => {
    await expect(encryptMnemonic('not a mnemonic', 'a test password long enough')).rejects.toThrow('12-word');
    await expect(encryptMnemonic('not a mnemonic', 'short')).rejects.toThrow('12 characters');
  });
  it('rejects malformed and oversized backup files', async () => {
    await expect(importEncryptedWallet('{', 'password')).rejects.toThrow('valid JSON');
    await expect(importEncryptedWallet('null', 'password')).rejects.toThrow('encrypted');
    await expect(importEncryptedWallet(' '.repeat(MAX_WALLET_BYTES + 1), 'password')).rejects.toThrow('64 KB');
  });
});
