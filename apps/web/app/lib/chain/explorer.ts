import type { ApiPromise } from '@polkadot/api';
import { decodeAddress, encodeAddress } from '@polkadot/util-crypto';

export { explorerNetworks, type ExplorerNetwork } from './networks';
export type ChainEvent = { name: string; data: unknown; phase: string; rawData?: string[]; fieldTypes?: string[] };
export type ChainTransaction = {
  index: number; hash: string; call: string; signer: string | null; args: unknown;
  result: 'Success' | 'Failed' | 'Unknown'; events: ChainEvent[];
  feeRao?: string; failure?: string; failureHint?: string; summary?: string;
};
export type ChainBlock = {
  number: number; hash: string; parent: string; timestamp: number | null;
  transactions: ChainTransaction[]; events: ChainEvent[];
  byteLength?: number | null; stateRoot?: string | null; extrinsicsRoot?: string | null;
};
export function parseExplorerSearch(input: string): { kind: 'block' | 'hash' | 'transaction' | 'address' | 'subnet'; value: string; index?: number } {
  const value = input.trim();
  const subnet = /^subnet:(\d{1,5})$/i.exec(value);
  if (subnet && Number(subnet[1]) <= 65535) return { kind: 'subnet', value: String(Number(subnet[1])) };
  if (/^\d{1,10}$/.test(value)) return { kind: 'block', value: String(Number(value)) };
  const transaction = /^(\d{1,10})-(\d{1,6})$/.exec(value);
  if (transaction) return { kind: 'transaction', value: String(Number(transaction[1])), index: Number(transaction[2]) };
  if (/^0x[0-9a-fA-F]{64}$/.test(value)) return { kind: 'hash', value: value.toLowerCase() };
  try {
    const key = decodeAddress(value);
    if (key.length === 32) return { kind: 'address', value: encodeAddress(key, 42) };
  } catch { /* Report supported formats below. */ }
  throw new Error('Enter a block number, block hash, block-index (such as 123-2), subnet:123, or SS58 address.');
}
export function taoFromRao(value: string) {
  const amount = BigInt(value);
  return `${amount / 1000000000n}.${(amount % 1000000000n).toString().padStart(9, '0')}`;
}
export async function readExplorerBlock(api: ApiPromise, hash: string): Promise<ChainBlock> {
  const [signed, at] = await Promise.all([api.rpc.chain.getBlock(hash), api.at(hash)]);
  const records = await at.query.system.events() as unknown as {
    event: { section: string; method: string; meta?: { fields: { typeName: { toString(): string } }[] }; data: { length: number; [index: number]: { toString(): string }; toHuman(): unknown } };
    phase: { isApplyExtrinsic: boolean; asApplyExtrinsic: { toNumber(): number }; toString(): string };
  }[];
  const events = Array.from(records).map(({ event, phase }) => ({
    name: `${event.section}.${event.method}`, data: event.data.toHuman(), phase: phase.toString(),
    rawData: Array.from({length: event.data.length}, (_, i) => event.data[i].toString()),
    fieldTypes: event.meta?.fields.map(field => field.typeName.toString()),
  }));
  const transactions = signed.block.extrinsics.map((tx, index): ChainTransaction => {
    const txEvents = Array.from(records).flatMap((record, i) =>
      record.phase.isApplyExtrinsic && record.phase.asApplyExtrinsic.toNumber() === index ? [events[i]] : []);
    const rawEvents = Array.from(records).filter(record => record.phase.isApplyExtrinsic && record.phase.asApplyExtrinsic.toNumber() === index);
    const failed = rawEvents.find(record => record.event.section === 'system' && record.event.method === 'ExtrinsicFailed');
    const paid = rawEvents.find(record => record.event.section === 'transactionPayment' && record.event.method === 'TransactionFeePaid');
    let failure: string | undefined;
    let failureHint: string | undefined;
    if (failed) {
      const error = failed.event.data[0] as unknown as { isModule: boolean; asModule: Parameters<typeof at.registry.findMetaError>[0]; toString(): string };
      try {
        if (error.isModule) {
          const decoded = at.registry.findMetaError(error.asModule);
          failure = `${decoded.section}.${decoded.name}: ${decoded.docs.join(' ')}`;
          failureHint = explorerFailureHint(decoded.section, decoded.name);
        } else failure = error.toString();
      } catch { failure = error.toString(); }
    }
    const named = Object.fromEntries(tx.method.meta.args.map((arg, i) => [arg.name.toString(), tx.method.args[i]?.toString()]));
    const actor = tx.isSigned ? tx.signer.toString() : 'Unsigned call';
    const succeeded = !failed && txEvents.some(event => event.name === 'system.ExtrinsicSuccess');
    const argTypes = Object.fromEntries(tx.method.meta.args.map(arg => [arg.name.toString(), arg.typeName?.toString() || '']));
    const action = summarizeExplorerCall(tx.method.section, tx.method.method, named, { events: succeeded ? txEvents : [], argTypes });
    return {
      feeRao: paid?.event.data[1]?.toString(), failure, failureHint,
      summary: failed ? `Failed: ${actor} tried to ${action}` : succeeded ? `${actor} ${pastTense(action)}` : `Submitted: ${actor} — ${action}`,
      index, hash: tx.hash.toHex(), call: `${tx.method.section}.${tx.method.method}`,
      signer: tx.isSigned ? tx.signer.toString() : null, args: tx.method.args.map((arg) => arg.toHuman()),
      result: txEvents.some((event) => event.name === 'system.ExtrinsicFailed') ? 'Failed'
        : txEvents.some((event) => event.name === 'system.ExtrinsicSuccess') ? 'Success' : 'Unknown',
      events: txEvents,
    };
  });
  const timestampCall = signed.block.extrinsics.find((tx) => tx.method.section === 'timestamp' && tx.method.method === 'set');
  return {
    number: signed.block.header.number.toNumber(), hash: signed.block.header.hash.toHex(),
    parent: signed.block.header.parentHash.toHex(),
    timestamp: timestampCall ? Number(timestampCall.method.args[0].toString()) : null,
    transactions, events, byteLength: signed.block.encodedLength ?? null,
    stateRoot: signed.block.header.stateRoot?.toHex() ?? null,
    extrinsicsRoot: signed.block.header.extrinsicsRoot?.toHex() ?? null,
  };
}

/** Exact module names only: unknown failures retain their decoded metadata text. */
export function explorerFailureHint(section: string, name: string): string | undefined {
  const hints: Record<string, string> = {
    'balances.InsufficientBalance': 'Check the spendable balance and leave enough TAO for the fee.',
    'balances.Expendability': 'Reduce the amount so the account remains above its existential deposit.',
    'subtensorModule.NotEnoughBalanceToStake': 'Check the coldkey balance and reduce the stake amount.',
    'subtensorModule.NotEnoughStakeToWithdraw': 'Check the alpha stake on this hotkey and subnet before retrying.',
    'subtensorModule.HotKeyNotRegisteredInSubNet': 'Register the hotkey on this subnet before retrying.',
    'subtensorModule.HotKeyNotRegisteredInNetwork': 'Check that the hotkey is registered on the selected network.',
    'subtensorModule.SettingWeightsTooFast': 'Wait for the subnet weight rate limit before submitting again.',
    'subtensorModule.NeuronNoValidatorPermit': 'Check the validator permit and stake weight; permits are recalculated at epochs.',
    'subtensorModule.CommitRevealEnabled': 'Use the subnet commit/reveal flow; direct set-weights is disabled.',
    'subtensorModule.NotSubnetOwner': 'This operation must be signed by the subnet owner.',
  };
  return hints[`${section}.${name}`];
}

function pastTense(action: string): string {
  const verbs: Record<string, string> = { send: 'sent', stake: 'staked', unstake: 'unstaked', register: 'registered', set: 'set', request: 'requested', activate: 'activated' };
  return action.replace(/^(send|stake|unstake|register|set|request|activate)\b/, verb => verbs[verb]);
}

type SummaryContext = { events?: ChainEvent[]; argTypes?: Record<string, string> };
const normalizeName = (value: string) => value.replace(/_/g, '').toLowerCase();
function vectorLength(value: string | undefined): number | null {
  try { const parsed: unknown = JSON.parse(value || 'null'); return Array.isArray(parsed) ? parsed.length : null; }
  catch { return null; }
}
function summaryEvent(events: ChainEvent[], name: string, types: string[]): string[] | undefined {
  return events.find(event => event.name === `subtensorModule.${name}` &&
    event.rawData?.length === types.length && types.every((type, i) => event.fieldTypes?.[i] === type))?.rawData;
}

/** Only verified call names and metadata types become prose; unknown layouts stay raw. */
export function summarizeExplorerCall(section: string, method: string, args: Record<string, string | undefined>, context: SummaryContext = {}): string {
  const fallback = `${section}.${method}`;
  const named = Object.fromEntries(Object.entries(args).map(([key, value]) => [normalizeName(key), value]));
  const argTypes = Object.fromEntries(Object.entries(context.argTypes || {}).map(([key, value]) => [normalizeName(key), value]));
  const events = context.events || [];
  try {
    if (section === 'balances' && ['transfer', 'transferKeepAlive', 'transferAllowDeath'].includes(method) && named.value && named.dest) {
      return `send ${taoFromRao(named.value)} TAO to ${named.dest}`;
    }
    if (section !== 'subtensorModule') return fallback;
    const subnet = named.netuid !== undefined ? ` on subnet ${named.netuid}` : '';
    const alphaUnit = named.netuid === '0' ? 'root stake (TAO-equivalent)' : 'alpha';
    const stakeTypes = ['T::AccountId', 'T::AccountId', 'TaoBalance', 'AlphaBalance', 'NetUid', 'u64'];
    if (['addStake', 'addStakeLimit'].includes(method) && named.amountstaked) {
      const event = summaryEvent(events, 'StakeAdded', stakeTypes);
      if (event && event[1] === named.hotkey && event[4] === named.netuid) return `stake ${taoFromRao(event[2])} TAO for ${taoFromRao(event[3])} ${alphaUnit}${subnet} with ${event[1]}`;
      return `${method === 'addStakeLimit' ? 'request staking up to' : 'stake'} ${taoFromRao(named.amountstaked)} TAO${subnet}${named.hotkey ? ` with ${named.hotkey}` : ''}`;
    }
    if (['removeStake', 'removeStakeLimit'].includes(method) && named.amountunstaked) {
      const event = summaryEvent(events, 'StakeRemoved', stakeTypes);
      if (event && event[1] === named.hotkey && event[4] === named.netuid) return `unstake ${taoFromRao(event[3])} ${alphaUnit} for ${taoFromRao(event[2])} TAO${subnet} from ${event[1]}`;
      const type = argTypes.amountunstaked;
      const amount = type === 'AlphaBalance' ? `${taoFromRao(named.amountunstaked)} ${alphaUnit}` : type === 'TaoBalance' ? `${taoFromRao(named.amountunstaked)} TAO` : `${named.amountunstaked} raw stake units`;
      return `${method === 'removeStakeLimit' ? 'request unstaking up to' : 'unstake'} ${amount}${subnet}${named.hotkey ? ` from ${named.hotkey}` : ''}`;
    }
    if (method === 'registerNetwork') {
      const event = summaryEvent(events, 'NetworkAdded', ['NetUid', 'u16']);
      return event ? `register subnet ${event[0]}` : 'register a subnet';
    }
    if (['register', 'burnedRegister'].includes(method)) {
      const event = summaryEvent(events, 'NeuronRegistered', ['NetUid', 'u16', 'T::AccountId']);
      if (event && event[0] === named.netuid && event[2] === named.hotkey) return `register hotkey ${event[2]} on subnet ${event[0]} as UID ${event[1]}`;
      return `register neuron${named.hotkey ? ` ${named.hotkey}` : ''}${subnet}`;
    }
    if (method === 'setWeights') {
      const count = vectorLength(named.dests);
      return `set weights${subnet}${count === null ? '' : ` for ${count} UIDs`}`;
    }
    if (method === 'startCall' && named.netuid !== undefined) {
      const event = summaryEvent(events, 'FirstEmissionBlockNumberSet', ['NetUid', 'u64']);
      return event && event[0] === named.netuid ? `activate subnet ${event[0]}; first emission block ${event[1]}` : `request subnet ${named.netuid} activation`;
    }
  } catch { /* A changed runtime or malformed value must not break the whole block. */ }
  return fallback;
}
