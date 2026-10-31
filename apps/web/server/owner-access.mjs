import { createHmac, timingSafeEqual } from 'node:crypto';
export const OWNER_COOKIE = '__Host-tensorstudio-owner';
const LIFETIME = 8 * 60 * 60;
const signature = (value, password) => createHmac('sha256', password).update(`studio-owner:${value}`).digest('hex');
export function createOwnerCookie(password, now = Date.now()) {
  const expires = String(Math.floor(now / 1000) + LIFETIME);
  return `${OWNER_COOKIE}=${expires}.${signature(expires, password)}; Path=/; Max-Age=${LIFETIME}; HttpOnly; Secure; SameSite=Strict`;
}
export function ownerCookieValid(header, password, now = Date.now()) {
  if (typeof header !== 'string' || typeof password !== 'string' || !password) return false;
  const token = header.split(';').map(x => x.trim()).find(x => x.startsWith(OWNER_COOKIE + '='))?.slice(OWNER_COOKIE.length + 1);
  if (!token || !/^\d{10}\.[a-f0-9]{64}$/.test(token)) return false;
  const [expires, signed] = token.split('.');
  const current = Math.floor(now / 1000);
  if (Number(expires) <= current || Number(expires) > current + LIFETIME) return false;
  return timingSafeEqual(Buffer.from(signed, 'hex'), Buffer.from(signature(expires, password), 'hex'));
}
