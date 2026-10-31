import { ClientOnly } from 'remix-utils/client-only';
import { Playground } from '~/components/playground/Playground';
export default function PlaygroundRoute() {
  return <ClientOnly fallback={<p className="p-6">Loading playground…</p>}>{() => <Playground />}</ClientOnly>;
}
