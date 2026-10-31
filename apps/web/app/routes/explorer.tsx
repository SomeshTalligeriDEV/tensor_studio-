import { ClientOnly } from 'remix-utils/client-only';
import { Explorer } from '~/components/explorer/Explorer.client';
export const meta = () => [{ title: 'Bittensor Explorer · TensorStudio' }];
export default function ExplorerRoute() {
  return <ClientOnly fallback={<p className="p-6">Connecting to Bittensor explorer…</p>}>{() => <Explorer />}</ClientOnly>;
}
