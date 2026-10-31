import type { ApiPromise } from '@polkadot/api';
import type { Signer as ApiSigner } from '@polkadot/api/types';
import { decodeAddress, encodeAddress } from '@polkadot/util-crypto';
import { assertLocalSubtensor, type TransferPreview } from './transfers';

export const TAOSTATS_INSTALL_URL = 'https://taostats.io/wallet-extension';
export type ExtensionAccount = { address: string; name?: string; genesisHash?: string | null; type?: string };
type Injected = {
  accounts: { get: () => Promise<ExtensionAccount[]>; subscribe: (callback: (accounts: ExtensionAccount[]) => void) => (() => void) | Promise<() => void> };
  signer: ApiSigner;
};
type ExtensionWindow = { injectedWeb3?: { taostats?: { enable: (name: string) => Promise<Injected> } } };
export function taostatsProvider(host: ExtensionWindow = window as unknown as ExtensionWindow) {
  const provider = host.injectedWeb3?.taostats;
  return typeof provider?.enable === 'function' ? provider : undefined;
}
function normalize(accounts: ExtensionAccount[]): ExtensionAccount[] {
  const result = new Map<string, ExtensionAccount>();
  for (const account of accounts) {
    try {
      if (account.type && !['sr25519', 'ed25519'].includes(account.type)) continue;
      const key = decodeAddress(account.address);
      if (key.length !== 32) continue;
      const address = encodeAddress(key, 42);
      result.set(address, { address, name: account.name, genesisHash: account.genesisHash, type: account.type });
    } catch { /* Ignore non-Substrate/invalid accounts; never guess their address. */ }
  }
  return [...result.values()];
}
export type ExtensionSession = {
  readonly accounts: ExtensionAccount[];
  readonly connected: boolean;
  disconnect(): void;
  signer(api: ApiPromise, address: string, isCurrent: () => boolean): ApiSigner;
};
/** Call only from an explicit Connect action. Never requests or receives key material. */
export async function connectTaostats(onAccounts: (accounts: ExtensionAccount[]) => void, host?: ExtensionWindow): Promise<ExtensionSession> {
  const provider = taostatsProvider(host);
  if (!provider) throw new Error('Taostats Wallet is not installed or has not injected its provider. Install it, then reload this page.');
  const injected = await provider.enable('TensorStudio');
  if (!injected?.accounts?.get || !injected.accounts.subscribe || !injected.signer?.signPayload) throw new Error('Taostats Wallet did not provide the required account and transaction-signing APIs.');
  let connected = true;
  let accounts = normalize(await injected.accounts.get());
  onAccounts(accounts);
  const stop = await injected.accounts.subscribe(next => { if (connected) { accounts = normalize(next); onAccounts(accounts); } });
  const check = (api: ApiPromise, address: string, isCurrent: () => boolean) => {
    const account = accounts.find(item => item.address === address);
    if (!connected || !isCurrent() || !account) throw new Error('Wallet disconnected, account permission changed, or chain switched. Connect and preview again.');
    if (account.genesisHash && account.genesisHash !== api.genesisHash.toHex()) throw new Error('This wallet account is restricted to another network. Select an account enabled for this chain.');
  };
  return {
    get accounts() { return accounts; },
    get connected() { return connected; },
    disconnect() { if (connected) { connected = false; accounts = []; stop(); } },
    signer(api, address, isCurrent) {
      return { signPayload: async payload => {
        check(api, address, isCurrent);
        await assertLocalSubtensor(api);
        check(api, address, isCurrent);
        if (payload.address !== address || payload.genesisHash !== api.genesisHash.toHex()) throw new Error('Signing payload does not match the approved account and chain.');
        const signed = await injected.signer.signPayload!(payload);
        check(api, address, isCurrent);
        return signed;
      } };
    },
  };
}

/** Explicitly confirmed localnet transfer; extension owns the approval and signing UI. */
export async function sendExtensionTransfer(api: ApiPromise, session: ExtensionSession, preview: TransferPreview, isCurrent: () => boolean): Promise<string> {
  await assertLocalSubtensor(api);
  const valid = () => session.connected && isCurrent() && session.accounts.some(account => account.address === preview.address)
    && api.genesisHash.toHex() === preview.genesis && Date.now() - preview.created <= 60000;
  if (!valid()) throw new Error('Preview expired or wallet/network changed. Preview again.');
  const tx = api.tx.balances.transferKeepAlive(preview.destination, preview.rao.toString());
  const fee = BigInt((await tx.paymentInfo(preview.address)).partialFee.toString());
  if (fee > preview.fee) throw new Error('Estimated fee increased. Preview again.');
  if (!valid()) throw new Error('Preview expired or wallet/network changed. Preview again.');
  await tx.signAsync(preview.address, { signer: session.signer(api, preview.address, isCurrent), era: 64 });
  if (!valid()) throw new Error('Approval expired or wallet/network changed before submission. Preview again.');
  return new Promise((resolve, reject) => {
    let unsubscribe: (() => void) | undefined;
    let done = false;
    const finish = (error?: Error) => {
      if (done) return;
      done = true; clearTimeout(timer); unsubscribe?.();
      if (error) reject(error); else resolve(tx.hash.toHex());
    };
    const timer = setTimeout(() => finish(new Error(`Confirmation timed out for ${tx.hash.toHex()}. Check TensorScan before retrying.`)), 60000);
    void tx.send(result => {
      if (result.dispatchError) {
        const reason = result.dispatchError.isModule ? api.registry.findMetaError(result.dispatchError.asModule).name : result.dispatchError.toString();
        finish(new Error(`Transfer failed: ${reason}`));
      } else if (result.isError) finish(new Error(`Transfer failed: ${result.status.type}`));
      else if (result.status.isFinalized) finish();
    }).then(stop => { unsubscribe = stop; if (done) stop(); }).catch(error => finish(error instanceof Error ? error : new Error('Transfer submission failed.')));
  });
}
