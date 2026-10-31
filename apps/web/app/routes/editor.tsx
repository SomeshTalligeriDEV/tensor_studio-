import { json, type MetaFunction } from '@remix-run/cloudflare';
import { ClientOnly } from 'remix-utils/client-only';
import { Chat } from '~/components/chat/Chat.client';
import { Header } from '~/components/header/Header';

export const meta: MetaFunction = () => {
  return [{ title: 'Subnet builder — TensorStudio' }, { name: 'description', content: 'Talk with Bitcode, the AI assistant in TensorStudio' }];
};

export const loader = () => json({});

export default function Index() {
  return (
    <div className="flex flex-col h-full w-full">
      <Header />
      <ClientOnly fallback={<p role="status" className="p-6">Loading subnet builder…</p>}>{() => <Chat />}</ClientOnly>
    </div>
  );
}
