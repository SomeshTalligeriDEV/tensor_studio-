import { expect, it } from 'vitest';
import { parseExplorerSearch, readExplorerBlock, summarizeExplorerCall, explorerFailureHint } from './explorer';
import type { ApiPromise } from '@polkadot/api';
it('accepts explicit subnet IDs and rejects out of range IDs', () => {
  expect(parseExplorerSearch(' subnet:123 ')).toEqual({kind: 'subnet', value: '123'});
  expect(() => parseExplorerSearch('subnet:65536')).toThrow();
});
it('decodes failure with historical metadata, actual fee and a truthful transfer summary', async () => {
  const value = (v: string) => ({ toString: () => v, toHuman: () => v });
  const event = (section: string, method: string, values: unknown[]) => ({ event: {section, method, data: Object.assign(values, {toHuman: () => values.map(String)})}, phase: {isApplyExtrinsic: true, asApplyExtrinsic: {toNumber: () => 0}, toString: () => 'ApplyExtrinsic'} });
  const tx = {hash: {toHex: () => '0xtx'}, isSigned: true, signer: value('Alice'), method: {section: 'balances', method: 'transferKeepAlive', args: [value('Bob'), value('10000000000')], meta: {args: [{name: value('dest')}, {name: value('value')}]}}};
  const api = {rpc: {chain: {getBlock: async () => ({block: {header: {number: {toNumber: () => 1}, hash: {toHex: () => '0xblock'}, parentHash: {toHex: () => '0xparent'}}, extrinsics: [tx]}})}}, at: async () => ({registry: {findMetaError: () => ({section: 'balances', name: 'InsufficientBalance', docs: ['Balance too low']})}, query: {system: {events: async () => [event('system', 'ExtrinsicFailed', [{isModule: true, asModule: {}}]), event('transactionPayment', 'TransactionFeePaid', [value('Alice'), value('123'), value('0')])]}}})} as unknown as ApiPromise;
  const result = (await readExplorerBlock(api, '0xblock')).transactions[0];
  expect(result.feeRao).toBe('123');
  expect(result.failure).toContain('balances.InsufficientBalance');
  expect(result.summary).toContain('10.000000000 TAO');
  expect(result.summary).toContain('Failed');
  expect(result.summary).toContain('Bob');
});

it('summarizes subnet actions using named runtime arguments and keeps unknown calls explicit', () => {
  expect(summarizeExplorerCall('subtensorModule', 'addStake', {amount_staked: '2000000000', netuid: '3', hotkey: 'Hot'})).toContain('stake 2.000000000 TAO');
  expect(summarizeExplorerCall('subtensorModule', 'removeStake', {amount_unstaked: '2000000000', netuid: '3', hotkey: 'Hot'})).toContain('unstake 2000000000 raw stake units');
  expect(summarizeExplorerCall('subtensorModule', 'registerNetwork', {})).toBe('register a subnet');
  expect(summarizeExplorerCall('subtensorModule', 'burnedRegister', {netuid: '3', hotkey: 'Hot'})).toContain('register neuron Hot on subnet 3');
  expect(summarizeExplorerCall('subtensorModule', 'setWeights', {netuid: '3'})).toContain('set weights on subnet 3');
  expect(summarizeExplorerCall('unknown', 'foo', {})).toBe('unknown.foo');
});

it('uses successful registration and activation events rather than guessing assigned IDs', () => {
  const events = [{name: 'subtensorModule.NeuronRegistered', data: [], phase: '', rawData: ['2', '4', 'Hot'], fieldTypes: ['NetUid', 'u16', 'T::AccountId']}];
  expect(summarizeExplorerCall('subtensorModule', 'burnedRegister', {netuid: '2', hotkey: 'Hot'}, {events})).toContain('UID 4');
  expect(summarizeExplorerCall('subtensorModule', 'registerNetwork', {}, {events: [{name: 'subtensorModule.NetworkAdded', data: [], phase: '', rawData: ['7', '1'], fieldTypes: ['NetUid', 'u16']}]})).toBe('register subnet 7');
  expect(summarizeExplorerCall('subtensorModule', 'startCall', {netuid: '2'}, {events: [{name: 'subtensorModule.FirstEmissionBlockNumberSet', data: [], phase: '', rawData: ['2', '123'], fieldTypes: ['NetUid', 'u64']}]})).toContain('first emission block 123');
});

it('counts weight destinations without claiming they are all miners', () => {
  expect(summarizeExplorerCall('subtensorModule', 'setWeights', {netuid:'2', dests:'[1,2,3]'})).toBe('set weights on subnet 2 for 3 UIDs');
});

it('uses historical argument types for unstake units and avoids invented TAO conversions', () => {
  expect(summarizeExplorerCall('subtensorModule', 'removeStake', {netuid:'2', amount_unstaked:'2000000000'}, {argTypes:{amount_unstaked:'AlphaBalance'}})).toContain('2.000000000 alpha');
  expect(summarizeExplorerCall('subtensorModule', 'removeStake', {netuid:'2', amount_unstaked:'2000000000'}, {argTypes:{amount_unstaked:'TaoBalance'}})).toContain('2.000000000 TAO');
});

it('uses actual amounts for partial staking and preserves unknown event layouts', () => {
  const context = {events:[{name:'subtensorModule.StakeAdded',data:[],phase:'',rawData:['Cold','Hot','500000000','700000000','2','0'],fieldTypes:['T::AccountId','T::AccountId','TaoBalance','AlphaBalance','NetUid','u64']}]};
  expect(summarizeExplorerCall('subtensorModule','addStakeLimit',{netuid:'2',hotkey:'Hot',amount_staked:'1000000000'},context)).toContain('0.500000000 TAO');
  expect(summarizeExplorerCall('subtensorModule','startCall',{netuid:'2'})).toBe('request subnet 2 activation');
  expect(summarizeExplorerCall('balances','transferKeepAlive',{dest:'Bob',value:'not-a-number'})).toBe('balances.transferKeepAlive');
});

it('offers hints only for exact known errors and ignores mismatched event schemas', () => {
  expect(explorerFailureHint('balances','InsufficientBalance')).toContain('spendable');
  expect(explorerFailureHint('unknown','InsufficientBalance')).toBeUndefined();
  expect(explorerFailureHint('subtensorModule','UnrecognizedError')).toBeUndefined();
  expect(summarizeExplorerCall('subtensorModule','burnedRegister',{netuid:'2',hotkey:'Hot'}, {events:[{name:'subtensorModule.NeuronRegistered',phase:'',data:[],rawData:['2','999','Hot'],fieldTypes:['Unknown','u16','T::AccountId']}]})).not.toContain('999');
});
