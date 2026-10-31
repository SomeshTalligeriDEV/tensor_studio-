import type { ApiPromise } from '@polkadot/api';
import { decodeAddress, encodeAddress } from '@polkadot/util-crypto';
import { runtimeField, runtimeInteger, runtimeText } from './explorer-subnet';

export type AccountStake = { netuid: number; hotkey: string; coldkey: string; alpha: string; unit: 'TAO' | 'alpha' };
export type AccountDetails = {
  address: string;
  blockNumber: number;
  blockHash: string;
  /** Exact raw rao, not floating-point TAO. Frozen overlaps free. */
  free: string;
  reserved: string;
  frozen: string;
  nonce: string;
  subnets: number[];
  stakes: AccountStake[];
  membershipError: string | null;
  stakesError: string | null;
};
function required(value: unknown, label: string): string {
  const text = runtimeText(value);
  if (text === null) throw new Error(`Runtime account ${label} is unavailable.`);
  return text;
}
/** Balance, hotkey memberships and coldkey positions pinned to exactly one block. */
export async function readAccountDetails(
  api: ApiPromise,
  address: string,
  blockHash?: string,
): Promise<AccountDetails> {
  const key = decodeAddress(address);
  if (key.length !== 32) throw new Error('Expected a 32-byte SS58 address.');
  const normalized = encodeAddress(key, 42);
  const hash = blockHash || (await api.rpc.chain.getFinalizedHead()).toString();
  const [at, header] = await Promise.all([api.at(hash), api.rpc.chain.getHeader(hash)]);
  const membership = async () => {
    const fn = at.query.subtensorModule?.isNetworkMember?.entries;
    if (!fn) throw new Error();
    const entries = await fn(normalized);
    return [
      ...new Set(
        entries
          .filter(([, value]) => value.toString() === 'true')
          .map(([key]) => {
            const netuid = runtimeInteger(key.args[1]);
            if (netuid === null) throw new Error();
            return netuid;
          }),
      ),
    ].sort((a, b) => a - b);
  };
  const positions = async () => {
    const fn = at.call?.stakeInfoRuntimeApi?.getStakeInfoForColdkey;
    if (!fn) throw new Error();
    const result = (await fn(normalized)) as unknown as Iterable<unknown>;
    return Array.from(result).map((row): AccountStake => {
      const netuid = runtimeInteger(runtimeField(row, 'netuid'));
      if (netuid === null) throw new Error();
      return {
        netuid,
        hotkey: required(runtimeField(row, 'hotkey'), 'stake hotkey'),
        coldkey: required(runtimeField(row, 'coldkey'), 'stake coldkey'),
        alpha: required(runtimeField(row, 'stake'), 'stake amount'),
        unit: netuid === 0 ? 'TAO' : 'alpha',
      };
    });
  };
  const [account, members, stakes] = await Promise.all([
    at.query.system.account(normalized),
    Promise.allSettled([membership()]),
    Promise.allSettled([positions()]),
  ]);
  const data = runtimeField(account, 'data');
  const m = members[0];
  const s = stakes[0];
  return {
    address: normalized,
    blockNumber: header.number.toNumber(),
    blockHash: hash,
    free: required(runtimeField(data, 'free'), 'free balance'),
    reserved: required(runtimeField(data, 'reserved'), 'reserved balance'),
    frozen: required(runtimeField(data, 'frozen') ?? runtimeField(data, 'miscFrozen'), 'frozen balance'),
    nonce: required(runtimeField(account, 'nonce'), 'nonce'),
    subnets: m.status === 'fulfilled' ? m.value : [],
    membershipError: m.status === 'rejected' ? 'Hotkey subnet memberships could not be read at this block.' : null,
    stakes: s.status === 'fulfilled' ? s.value : [],
    stakesError: s.status === 'rejected' ? 'Coldkey stake positions could not be read at this block.' : null,
  };
}
