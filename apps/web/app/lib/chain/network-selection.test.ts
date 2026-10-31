import { expect, it } from 'vitest';
import { resolveExplorerNetwork } from './network-selection';
it('recovers stale local URLs to testnet in the public explorer',()=>{
 expect(resolveExplorerNetwork('local',true)).toBe('test');
 expect(resolveExplorerNetwork('test',true)).toBe('test');
 expect(resolveExplorerNetwork('finney',true)).toBe('finney');
});
it('keeps localnet available in an explicitly configured development deployment',()=>{
 expect(resolveExplorerNetwork('local',false)).toBe('local');
 expect(resolveExplorerNetwork(null,false)).toBe('test');
 expect(resolveExplorerNetwork('invalid',false)).toBe('test');
});
