import { ClientOnly } from 'remix-utils/client-only';
import { Wallet } from '~/components/wallet/Wallet.client';
import { ExtensionWallet } from '~/components/wallet/ExtensionWallet';
export default function WalletRoute() {
  return <ClientOnly fallback={<p className="p-6">Loading wallet…</p>}>{() => <div className="p-6 flex flex-col gap-6"><ExtensionWallet /><details><summary>Browser development wallet</summary><Wallet /></details></div>}</ClientOnly>;
}
