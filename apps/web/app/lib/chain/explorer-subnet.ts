import type { ApiPromise } from '@polkadot/api';

export type ExplorerNeuron = {
  uid: number;
  hotkey: string | null;
  coldkey: string | null;
  /** Raw alpha units, never a TAO valuation. */
  stake: string | null;
  /** Raw root TAO rao from the metagraph. */
  taoStake: string | null;
  /** Raw u16 values; divide by 65535 for normalized scores. */
  incentive: string | null;
  dividends: string | null;
  /** Raw alpha units from the metagraph, not lifetime income. */
  emission: string | null;
  lastUpdate: number | null;
  validatorPermit: boolean | null;
  active: boolean | null;
};
export type ExplorerSubnet = {
  netuid: number;
  owner: string | null;
  ownerHotkey: string | null;
  neuronCount: number;
  name: string | null;
  symbol: string | null;
  tempo: number | null;
  lastStep: number | null;
  /** Spot TAO per alpha from SwapRuntimeApi.current_alpha_price. */
  alphaPrice: string | null;
  priceError: string | null;
  emissionRao: string | null;
  alphaEmissionRao: string | null;
  ownerEarnings: null;
  ownerEarningsUnavailable: string;
  blockNumber: number;
  blockHash: string;
  neurons: ExplorerNeuron[];
  source: 'runtime-api';
};

/** Access decoded Codec structs without JSON conversion, preserving u64 precision. */
export function runtimeField(value: unknown, key: string): unknown {
  if (!value || typeof value !== 'object') return undefined;
  const codec = value as { get?: (key: string) => unknown } & Record<string, unknown>;
  return typeof codec.get === 'function' ? codec.get(key) : codec[key];
}
export function runtimeText(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  return String(value);
}
export function runtimeInteger(value: unknown): number | null {
  const text = runtimeText(value);
  if (text === null || !/^\d+$/.test(text)) return null;
  const number = Number(text);
  return Number.isSafeInteger(number) ? number : null;
}
function vector(value: unknown, key: string): unknown[] {
  const field = runtimeField(value, key);
  return field && typeof field === 'object' && Symbol.iterator in field ? Array.from(field as Iterable<unknown>) : [];
}
function bool(value: unknown): boolean | null {
  const text = runtimeText(value);
  return text === 'true' ? true : text === 'false' ? false : null;
}
function utf8(value: unknown, key: string): string | null {
  const bytes = vector(value, key).map(runtimeInteger);
  if (!bytes.length || bytes.some((byte) => byte === null || byte > 255)) return null;
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(new Uint8Array(bytes as number[]));
  } catch {
    return null;
  }
}
function fixedRao(value: unknown): string | null {
  const text = runtimeText(value);
  if (text === null || !/^\d+$/.test(text)) return null;
  const rao = BigInt(text);
  return `${rao / 1000000000n}.${(rao % 1000000000n).toString().padStart(9, '0')}`;
}
const caches = new WeakMap<ApiPromise, Map<string, Promise<ExplorerSubnet>>>();
/** One typed runtime call for the entire metagraph, pinned to the caller's block. */
export async function readSubnet(api: ApiPromise, netuid: number, blockHash?: string): Promise<ExplorerSubnet> {
  if (!Number.isInteger(netuid) || netuid < 0 || netuid > 65535)
    throw new Error('Invalid netuid: use an integer from 0 to 65535.');
  const hash = blockHash || (await api.rpc.chain.getFinalizedHead()).toString();
  let cache = caches.get(api);
  if (!cache) {
    cache = new Map();
    caches.set(api, cache);
  }
  const key = `${hash}:${netuid}`;
  const saved = cache.get(key);
  if (saved) return saved;
  const pending = fetchSubnet(api, netuid, hash);
  cache.set(key, pending);
  while (cache.size > 32) cache.delete(cache.keys().next().value!);
  try {
    return await pending;
  } catch (error) {
    cache.delete(key);
    throw error;
  }
}
async function fetchSubnet(api: ApiPromise, netuid: number, hash: string): Promise<ExplorerSubnet> {
  const [at, header] = await Promise.all([api.at(hash), api.rpc.chain.getHeader(hash)]);
  const call = at.call?.subnetInfoRuntimeApi?.getMetagraph;
  if (!call) throw new Error('This runtime does not expose SubnetInfoRuntimeApi.getMetagraph.');
  const graphOption = (await call(netuid)) as unknown as { isNone: boolean; unwrap(): unknown };
  if (graphOption.isNone) throw new Error(`Subnet ${netuid} does not exist at block ${header.number.toNumber()}.`);
  const graph = graphOption.unwrap();
  const count = runtimeInteger(runtimeField(graph, 'numUids'));
  if (count === null || count > 65535) throw new Error('Runtime returned an invalid neuron count.');
  const fields = Object.fromEntries(
    [
      'hotkeys',
      'coldkeys',
      'alphaStake',
      'taoStake',
      'incentives',
      'dividends',
      'emission',
      'lastUpdate',
      'validatorPermit',
      'active',
    ].map((key) => [key, vector(graph, key)]),
  );
  if (fields.hotkeys.length !== count) throw new Error('Runtime returned an incomplete metagraph.');
  let alphaPrice: string | null = null;
  let priceError: string | null = null;
  try {
    const priceCall = at.call?.swapRuntimeApi?.currentAlphaPrice;
    if (!priceCall) throw new Error();
    alphaPrice = fixedRao(await priceCall(netuid));
    if (alphaPrice === null) throw new Error();
  } catch {
    priceError = 'Spot price is unavailable from this block runtime.';
  }
  return {
    netuid,
    owner: runtimeText(runtimeField(graph, 'ownerColdkey')),
    ownerHotkey: runtimeText(runtimeField(graph, 'ownerHotkey')),
    neuronCount: count,
    name: utf8(graph, 'name'),
    symbol: utf8(graph, 'symbol'),
    tempo: runtimeInteger(runtimeField(graph, 'tempo')),
    lastStep: runtimeInteger(runtimeField(graph, 'lastStep')),
    alphaPrice,
    priceError,
    emissionRao: runtimeText(runtimeField(graph, 'subnetEmission')),
    alphaEmissionRao: runtimeText(runtimeField(graph, 'alphaOutEmission')),
    ownerEarnings: null,
    ownerEarningsUnavailable:
      'Cumulative owner payments are not provided by this snapshot; no earnings total has been inferred.',
    blockNumber: header.number.toNumber(),
    blockHash: hash,
    source: 'runtime-api',
    neurons: Array.from({ length: count }, (_, uid) => ({
      uid,
      hotkey: runtimeText(fields.hotkeys[uid]),
      coldkey: runtimeText(fields.coldkeys[uid]),
      stake: runtimeText(fields.alphaStake[uid]),
      taoStake: runtimeText(fields.taoStake[uid]),
      incentive: runtimeText(fields.incentives[uid]),
      dividends: runtimeText(fields.dividends[uid]),
      emission: runtimeText(fields.emission[uid]),
      lastUpdate: runtimeInteger(fields.lastUpdate[uid]),
      validatorPermit: bool(fields.validatorPermit[uid]),
      active: bool(fields.active[uid]),
    })),
  };
}
