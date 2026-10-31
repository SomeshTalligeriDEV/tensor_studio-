import { ClientOnly } from 'remix-utils/client-only';
import { HarnessPage } from '~/components/harness/HarnessReport';

export default function HarnessRoute() {
  return <ClientOnly fallback={<p className="p-6">Loading evaluation report…</p>}>{() => <HarnessPage />}</ClientOnly>;
}
