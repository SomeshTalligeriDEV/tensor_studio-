import { expect, it } from 'vitest';
import { loader } from '../../routes/api.chain-config';
import type { LoaderFunctionArgs } from '@remix-run/cloudflare';
function load(app: string, endpoint: string) {
  return loader({ request: new Request(app), context: { cloudflare: { env: { CHAIN_WS: endpoint } } }, params: {} } as unknown as LoaderFunctionArgs);
}
it('permits loopback localnet from the local development app', async () => {
  const response = load('http://localhost:5173', 'ws://127.0.0.1:9944');
  expect(response.status).toBe(200);
});
it('requires secure reachable configuration for a hosted app', async () => {
  for (const endpoint of ['ws://127.0.0.1:9944', 'wss://localhost:9944', 'ws://chain.example:9944']) {
    expect(load('https://studio.example', endpoint).status).toBe(503);
  }
  expect(load('https://studio.example', 'wss://chain.example').status).toBe(200);
});
it('never exposes credentials embedded in configuration', async () => {
  const response = load('https://studio.example', 'wss://user:secret@chain.example');
  expect(response.status).toBe(503);
  expect(JSON.stringify(await response.json())).not.toContain('secret');
});
it('returns public network mode without exposing a loopback endpoint for standalone deployment', async () => {
 const response=loader({request:new Request('http://localhost:10000/api/chain-config'),context:{cloudflare:{env:{SCAN_PUBLIC_ONLY:'1',CHAIN_WS:''}}},params:{}} as unknown as LoaderFunctionArgs);
 expect(response.status).toBe(200);
 expect(await response.json()).toEqual({localEndpoint:'',publicOnly:true});
});
