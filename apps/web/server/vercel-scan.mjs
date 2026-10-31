/** Vercel adapter for the standalone, read-only TensorScan build. */
import { createRequestHandler } from '@remix-run/cloudflare';
import { Readable } from 'node:stream';
import * as build from '../build/server/index.js';

const handle = createRequestHandler(build, 'production');

export default async function handler(req, res) {
  try {
    if (!['GET', 'HEAD'].includes(req.method)) {
      res.writeHead(405, { Allow: 'GET, HEAD' });
      res.end('Read-only explorer');
      return;
    }
    const path = new URL(req.url, 'https://localhost').pathname;
    if (path === '/healthz') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(req.method === 'HEAD' ? undefined : JSON.stringify({ service: 'tensorscan', status: 'ok' }));
      return;
    }
    if (path === '/') {
      res.writeHead(302, { Location: '/scan?network=test' });
      res.end();
      return;
    }
    if (!(path === '/scan' || path.startsWith('/scan/') || path === '/api/market' || path === '/api/chain-config')) {
      res.writeHead(404);
      res.end('TensorScan route not found');
      return;
    }
    const origin = process.env.PUBLIC_ORIGIN || `https://${process.env.VERCEL_URL || 'tensorscan.vercel.app'}`;
    const request = new Request(new URL(req.url, origin), { method: req.method, headers: req.headers });
    const response = await handle(request, {
      cloudflare: { env: { CHAIN_WS: process.env.CHAIN_WS || '', SCAN_PUBLIC_ONLY: process.env.CHAIN_WS ? '' : '1' } },
      requestId: crypto.randomUUID(),
    });
    res.writeHead(response.status, Object.fromEntries(response.headers));
    if (req.method === 'HEAD' || !response.body) res.end();
    else Readable.fromWeb(response.body).pipe(res);
  } catch (error) {
    console.error('TensorScan request failed:', error instanceof Error ? error.message : 'Unknown error');
    if (!res.headersSent) res.writeHead(500);
    res.end('Explorer request unavailable');
  }
}
