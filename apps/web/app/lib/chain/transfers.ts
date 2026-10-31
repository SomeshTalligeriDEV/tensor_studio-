import type { ApiPromise } from '@polkadot/api';
import type { Signer as ApiSigner } from '@polkadot/api/types';
import { blake2AsU8a, decodeAddress, encodeAddress } from '@polkadot/util-crypto';
import type { Signer } from './signer';

export function parseTao(value: string): bigint {
  if (!/^(0|[1-9]\d{0,10})(\.\d{1,9})?$/.test(value)) throw new Error('Enter a positive TAO amount with up to 9 decimal places.');
  const [whole, fraction = ''] = value.split('.');
  const rao = BigInt(whole) * 1000000000n + BigInt(fraction.padEnd(9, '0'));
  if (rao <= 0n || rao > 18446744073709551615n) throw new Error('TAO amount is out of range.');
  return rao;
}
export function formatTao(rao: bigint) { return `${rao / 1000000000n}.${(rao % 1000000000n).toString().padStart(9, '0')}`; }
export function recipientAddress(value: string) {
  try {
    const publicKey = decodeAddress(value.trim());
    if (publicKey.length !== 32) throw new Error('Invalid public key');
    return encodeAddress(publicKey, 42);
  } catch { throw new Error('Enter a valid Bittensor SS58 address.'); }
}
export async function assertLocalSubtensor(api: ApiPromise) {
  const type = (await api.rpc.system.chainType()).toString();
  if (!['Development', 'Local'].includes(type) || !api.runtimeVersion.specName.toString().toLowerCase().includes('subtensor')) {
    throw new Error('Transfers are enabled only on the local Bittensor development chain.');
  }
}
export function signerAdapter(api: ApiPromise, signer: Signer): ApiSigner {
  return { signPayload: async (payload) => {
    if (payload.address !== signer.address || payload.genesisHash !== api.genesisHash.toHex()) throw new Error('Signing account or chain changed.');
    const bytes = api.registry.createType('ExtrinsicPayload', payload, { version: payload.version }).toU8a({ method: true });
    const signature = await signer.sign(bytes.length > 256 ? blake2AsU8a(bytes) : bytes);
    return { id: 1, signature: `0x${Array.from(signature, (byte) => byte.toString(16).padStart(2, '0')).join('')}` };
  } };
}
export async function previewTransfer(api: ApiPromise, address: string, recipient: string, amount: string) {
  await assertLocalSubtensor(api);
  const destination = recipientAddress(recipient);
  const rao = parseTao(amount);
  const tx = api.tx.balances.transferKeepAlive(destination, rao.toString());
  const fee = BigInt((await tx.paymentInfo(address)).partialFee.toString());
  return { destination, rao, fee, created: Date.now(), genesis: api.genesisHash.toHex(), address };
}
export type TransferPreview = Awaited<ReturnType<typeof previewTransfer>>;
export async function sendTransfer(api: ApiPromise, signer: Signer, preview: TransferPreview): Promise<string> {
  await assertLocalSubtensor(api);
  if (signer.locked || signer.address !== preview.address || api.genesisHash.toHex() !== preview.genesis || Date.now() - preview.created > 60000) throw new Error('Preview expired or wallet changed. Preview the fee again.');
  const tx = api.tx.balances.transferKeepAlive(preview.destination, preview.rao.toString());
  const fee = BigInt((await tx.paymentInfo(signer.address)).partialFee.toString());
  if (fee > preview.fee) throw new Error('Estimated fee increased. Preview the fee again.');
  await tx.signAsync(signer.address, { signer: signerAdapter(api, signer), era: 64 });
  signer.lock();
  return new Promise((resolve, reject) => {
    let unsubscribe: (() => void) | undefined;
    let done = false;
    const finish = (error?: Error) => {
      if (done) return;
      done = true; clearTimeout(timer); unsubscribe?.();
      if (error) reject(error); else resolve(tx.hash.toHex());
    };
    const timer = setTimeout(() => finish(new Error(`Confirmation timed out for ${tx.hash.toHex()}. Check chain activity before retrying.`)), 60000);
    void tx.send((result) => {
      if (result.dispatchError) {
        const error = result.dispatchError;
        const reason = error.isModule ? api.registry.findMetaError(error.asModule).name : error.toString();
        finish(new Error(`Transfer failed: ${reason}`));
      } else if (result.isError) finish(new Error(`Transfer failed: ${result.status.type}`));
      else if (result.status.isFinalized) finish();
    }).then((stop) => { unsubscribe = stop; if (done) stop(); }).catch((error) => finish(error));
  });
}
