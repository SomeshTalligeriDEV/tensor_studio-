import { useChain } from '~/components/studio/ChainProvider';
import { Link } from '@remix-run/react';
import type { ReactNode } from 'react';
export function scanPath(kind: 'block' | 'extrinsic' | 'account' | 'subnet' | 'home' | 'blocks' | 'transactions', value = '') {
  return kind === 'home' ? '/scan' : `/scan/${kind}${value ? `/${encodeURIComponent(value)}` : ''}`;
}
export function ScanLink({ kind, value = '', children, className }: { kind: Parameters<typeof scanPath>[0]; value?: string; children: ReactNode; className?: string }) {
  const {state} = useChain();
  const query = new URLSearchParams();
  query.set('network', state.network);
  return <Link className={className} to={`${scanPath(kind, value)}${query.size ? `?${query}` : ''}`}>{children}</Link>;
}
export const short = (value: string) => value.length > 24 ? `${value.slice(0, 10)}…${value.slice(-8)}` : value;
export function ago(timestamp: number | null, now: number) {
  if (timestamp === null) return 'Time unavailable';
  const seconds = Math.max(0, Math.floor((now - timestamp) / 1000));
  return seconds < 60 ? `${seconds}s ago` : seconds < 3600 ? `${Math.floor(seconds / 60)}m ago` : `${Math.floor(seconds / 3600)}h ago`;
}
