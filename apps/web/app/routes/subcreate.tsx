import { ClientOnly } from 'remix-utils/client-only';
import { SubCreate } from '~/components/subcreate/SubCreate.client';
export default function SubCreateRoute() {
  return <ClientOnly fallback={<p className="p-6">Loading subnet setup…</p>}>{() => <SubCreate />}</ClientOnly>;
}
