import { ClientOnly } from 'remix-utils/client-only';
import { Explorer } from '~/components/explorer/Explorer.client';
export const meta = () => [{ title: 'TensorScan — Bittensor Explorer | TensorStudio' }];
export default function ScanRoute() {
  return <ClientOnly fallback={<p className="p-6">Loading TensorScan…</p>}>{() => <Explorer />}</ClientOnly>;
}
