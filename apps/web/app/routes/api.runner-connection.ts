import { json, type LoaderFunctionArgs } from '@remix-run/cloudflare';
import { SignJWT } from 'jose';

export async function loader({ request, context }: LoaderFunctionArgs) {
  const headers = { 'Cache-Control': 'private, no-store', 'Vary': 'Origin', 'X-Content-Type-Options': 'nosniff' };
  const url = new URL(request.url);
  if (request.method !== 'GET') return json({ error: 'Method not allowed.' }, { status: 405, headers });
  if (request.headers.get('X-Bitcode-Client') !== 'studio' || (request.headers.get('Origin') && request.headers.get('Origin') !== url.origin) || ['cross-site', 'same-site'].includes(request.headers.get('Sec-Fetch-Site') ?? '')) return json({ error: 'Origin is not allowed.' }, { status: 403, headers });
  if (['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)) return json({ mode: 'local' }, { headers });
  const env = context.cloudflare.env as unknown as Record<string, string | undefined>;
  try {
    const origin = new URL(env.PUBLIC_ORIGIN || '');
    const target = new URL(env.RUNNER_PUBLIC_URL || '');
    const clean = (value: URL) => value.protocol === 'https:' && !value.username && !value.password && value.pathname === '/' && !value.search && !value.hash;
    if (!clean(origin) || origin.origin !== url.origin || !clean(target) || new TextEncoder().encode(env.RUNNER_SESSION_SECRET || '').length < 32) throw new Error('Invalid configuration');
    const token = await new SignJWT({ scope: 'runner:owner' }).setProtectedHeader({ alg: 'HS256', typ: 'JWT' }).setAudience('tensorstudio-runner').setSubject('studio').setIssuer(origin.origin).setIssuedAt().setExpirationTime('5m').sign(new TextEncoder().encode(env.RUNNER_SESSION_SECRET));
    return json({ mode: 'hosted', url: target.origin, token }, { headers });
  } catch { return json({ error: 'Hosted runner connection is not configured.' }, { status: 503, headers }); }
}
