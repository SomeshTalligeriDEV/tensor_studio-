// Explicit localnet acceptance check. Creates ephemeral keys; prints no secrets.
import assert from 'node:assert/strict';
import { ApiPromise, WsProvider } from '@polkadot/api';
import { generateMnemonic, encryptMnemonic, MnemonicSigner } from '../app/lib/chain/wallet.ts';
import { assertLocalSubtensor, previewTransfer, sendTransfer } from '../app/lib/chain/transfers.ts';
const provider = new WsProvider('ws://127.0.0.1:9944', false);
await provider.connect();
const api = await ApiPromise.create({ provider, noInitWarn: true });
let sender;
try {
  await assertLocalSubtensor(api);
  const password = 'ephemeral local acceptance password';
  sender = await MnemonicSigner.unlock(await encryptMnemonic(await generateMnemonic(), password), password);
  const recipient = await encryptMnemonic(await generateMnemonic(), password);
  const funding = await fetch('http://127.0.0.1:8787/localnet/fund', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Bitcode-Client': 'studio' }, body: JSON.stringify({ address: sender.address }) });
  const receipt = await funding.json();
  assert.equal(funding.status, 200, JSON.stringify(receipt));
  const before = await api.query.system.account(sender.address);
  assert(BigInt(before.data.free.toString()) >= 1000000000000n);
  const preview = await previewTransfer(api, sender.address, recipient.address, '10');
  console.log('Local Bittensor fee preview (rao):', preview.fee.toString());
  const hash = await sendTransfer(api, sender, preview);
  const received = await api.query.system.account(recipient.address);
  const after = await api.query.system.account(sender.address);
  assert.equal(received.data.free.toString(), '10000000000');
  assert(BigInt(after.data.free.toString()) < BigInt(before.data.free.toString()) - 10000000000n);
  console.log(JSON.stringify({ result: 'PASS', hash, recipientRao: received.data.free.toString(), senderRao: after.data.free.toString() }));
} finally { sender?.lock(); await api.disconnect(); }
