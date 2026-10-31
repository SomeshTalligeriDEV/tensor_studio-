/** Full Studio adapter. Shared runner credentials never enter the browser. */
import { createRequestHandler } from '@remix-run/cloudflare';
import { Readable, Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { randomUUID } from 'node:crypto';
import * as build from '../build/server/index.js';
import { createOwnerCookie } from './owner-access.mjs';
import { studioAccess, PUBLIC_AI_ACTIONS } from './studio-access.mjs';

const handle = createRequestHandler(build, 'production');
const aiRequests = new Map();
let aiMinute = 0, aiCount = 0;
const LIMIT = 4 * 1024 * 1024;
const CONFIG = ['CHAIN_WS', 'AI_API_KEY', 'AI_BASE_URL', 'AI_MODEL', 'CHUTES_API_KEY', 'CHUTES_MODELS', 'AI_FALLBACK_API_KEY', 'AI_FALLBACK_BASE_URL', 'AI_FALLBACK_MODEL', 'RUNNER_PUBLIC_URL', 'RUNNER_SESSION_SECRET', 'PUBLIC_ORIGIN'];

function deploymentOrigin() {
  const configured = process.env.PUBLIC_ORIGIN;
  const origin = new URL(configured || `https://${process.env.VERCEL_URL || ''}`);
  if (origin.protocol !== 'https:' || origin.username || origin.password || origin.pathname !== '/' || origin.search || origin.hash) throw new Error('Invalid deployment origin');
  return origin.origin;
}

export default async function handler(req, res) {
  try {
    const origin = deploymentOrigin();
    // Reject absolute request targets: the deployment origin is server configuration.
    if (!req.url?.startsWith('/') || req.url.startsWith('//')) throw new Error('Invalid request target');
    const url = new URL(req.url, origin);
    const password = process.env.STUDIO_ACCESS_PASSWORD;
    const owner = studioAccess('GET', '/api/runner-connection', req.headers.authorization, password, req.headers.cookie) === 200;
    if (url.pathname === '/api/access' && req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'private, no-store' });
      res.end(JSON.stringify({ owner })); return;
    }
    if (url.pathname === '/api/owner-access' && req.method === 'POST') {
      if (req.headers.origin !== origin || !req.headers['content-type']?.includes('application/json')) {
        res.writeHead(403); res.end('Origin not allowed.'); return;
      }
      let body = ''; for await (const chunk of req) { body += chunk; if (Buffer.byteLength(body) > 2048) { res.writeHead(413); res.end('Request too large.'); return; } }
      let supplied; try { supplied = JSON.parse(body).password; } catch { supplied = ''; }
      const valid = typeof supplied === 'string' && studioAccess('GET', '/api/runner-connection', 'Basic ' + Buffer.from('studio:' + supplied).toString('base64'), password) === 200;
      res.writeHead(valid ? 200 : 403, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...(valid ? { 'Set-Cookie': createOwnerCookie(password) } : {}) });
      res.end(JSON.stringify(valid ? { ok: true } : { error: 'Owner access could not be verified.' })); return;
    }
    const access = studioAccess(req.method, url.pathname, req.headers.authorization, password, req.headers.cookie);
    if (access === 200 && !owner && req.method === 'POST' && PUBLIC_AI_ACTIONS.has(url.pathname)) {
      const minute = Math.floor(Date.now() / 60000);
      if (minute !== aiMinute) { aiMinute = minute; aiCount = 0; aiRequests.clear(); }
      const client = String(req.headers['x-vercel-forwarded-for'] || req.socket?.remoteAddress || 'unknown');
      const used = aiRequests.get(client) || 0;
      if (used >= 6 || aiCount >= 40) { res.writeHead(429, { 'Retry-After': '60', 'Cache-Control': 'no-store' }); res.end('The public demo request limit was reached. Please try again in a minute.'); return; }
      aiRequests.set(client, used + 1); aiCount++;
    }
    if (access !== 200) {
      res.writeHead(access === 401 ? 403 : access, { 'Cache-Control': 'no-store' });
      res.end(access === 503 ? 'Workspace access is not configured.' : 'Owner execution access is required. Open /owner to connect the private runner.');
      return;
    }
    if (url.pathname === '/healthz') {
      res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
      res.end(req.method === 'HEAD' ? undefined : JSON.stringify({ service: 'tensorstudio', status: 'ok' }));
      return;
    }
    const length = req.headers['content-length'];
    if (length && (!/^\d+$/.test(length) || Number(length) > LIMIT)) {
      res.writeHead(413); res.end('Request body too large.'); return;
    }
    const headers = new Headers();
    for (const [key, value] of Object.entries(req.headers)) {
      if (value !== undefined && !['authorization', 'host', 'x-forwarded-host', 'x-forwarded-proto'].includes(key.toLowerCase())) {
        for (const item of Array.isArray(value) ? value : [value]) headers.append(key, item);
      }
    }
    const init = { method: req.method, headers };
    if (!['GET', 'HEAD'].includes(req.method)) {
      let received = 0;
      const bounded = new Transform({ transform(chunk, encoding, callback) {
        received += chunk.length;
        callback(received > LIMIT ? Object.assign(new Error('Body limit'), { status: 413 }) : null, chunk);
      } });
      req.on('error', error => bounded.destroy(error));
      init.body = Readable.toWeb(req.pipe(bounded));
      init.duplex = 'half';
    }
    const env = Object.fromEntries(CONFIG.map(key => [key, process.env[key] || '']));
    const response = await handle(new Request(url, init), { cloudflare: { env }, requestId: randomUUID() });
    const responseHeaders = Object.fromEntries(response.headers);
    if (!['/', '/scan', '/api/market', '/api/chain-config'].includes(url.pathname) && !url.pathname.startsWith('/scan/')) responseHeaders['cache-control'] = 'private, no-store';
    if (typeof response.headers.getSetCookie === 'function' && response.headers.getSetCookie().length) responseHeaders['set-cookie'] = response.headers.getSetCookie();
    res.writeHead(response.status, responseHeaders);
    if (req.method === 'HEAD' || !response.body) res.end();
    else await pipeline(Readable.fromWeb(response.body), res);
  } catch (error) {
    if (!res.headersSent) { res.writeHead(error?.status === 413 ? 413 : 500); res.end('Studio request unavailable.'); }
    else res.destroy();
  }
}
