import { ClientOnly } from 'remix-utils/client-only';
import { ProcessNodes } from '~/components/nodes/ProcessNodes.client';
export default function NodesRoute() {
  return <ClientOnly fallback={<p className="p-6">Loading nodes…</p>}>{() => <ProcessNodes />}</ClientOnly>;
}
