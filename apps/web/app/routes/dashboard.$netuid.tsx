import { ClientOnly } from 'remix-utils/client-only';
import { Dashboard } from '~/components/dashboard/Dashboard';
export const meta=()=>[{title:'Subnet dashboard — TensorStudio'}];
export default function DashboardRoute(){return <ClientOnly fallback={<p className="p-6">Loading subnet dashboard…</p>}>{()=> <Dashboard/>}</ClientOnly>;}
