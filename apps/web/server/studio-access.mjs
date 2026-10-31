import { createHash, timingSafeEqual } from 'node:crypto';

export function publicStudioRequest(method, pathname) {
  return method === 'GET' && (pathname === '/' || pathname === '/scan' || pathname.startsWith('/scan/') || ['/api/market', '/api/chain-config', '/healthz'].includes(pathname));
}

export function studioAccess(method, pathname, authorization, password) {
  if (publicStudioRequest(method, pathname)) return 200;
  if (typeof password !== 'string' || !password.length) return 503;
  if (typeof authorization !== 'string' || authorization.length > 16384 || !/^Basic [A-Za-z0-9+/]+={0,2}$/i.test(authorization)) return 401;
  try {
    const encoded = authorization.slice(6);
    const bytes = Buffer.from(encoded, 'base64');
    if (bytes.toString('base64').replace(/=+$/, '') !== encoded.replace(/=+$/, '')) return 401;
    const decoded = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    const digest = value => createHash('sha256').update(value, 'utf8').digest();
    return timingSafeEqual(digest(decoded), digest(`studio:${password}`)) ? 200 : 401;
  } catch { return 401; }
}
