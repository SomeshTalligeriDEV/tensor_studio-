import type { Network } from '@tensorstudio/chain';
export function resolveExplorerNetwork(requested: string | null, publicOnly: boolean): Network {
  if (requested === 'finney') return 'finney';
  if (requested === 'local' && !publicOnly) return 'local';
  return 'test';
}
