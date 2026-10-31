import { json, type LoaderFunctionArgs } from '@remix-run/cloudflare';

export function loader({ request, context }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const origin = request.headers.get('Origin');
  const headers = { 'Cache-Control': 'no-store', 'Vary': 'Origin', 'X-Content-Type-Options': 'nosniff' };
  if (!['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)
      || request.headers.get('X-Bitcode-Client') !== 'studio'
      || (origin !== null && origin !== url.origin)
      || ['cross-site', 'same-site'].includes(request.headers.get('Sec-Fetch-Site') ?? '')) {
    return json({ error: 'Runner credentials are only available to the local studio.' }, { status: 403, headers });
  }
  const token = context.cloudflare.env.RUNNER_TOKEN || (typeof process !== 'undefined' ? process.env.RUNNER_TOKEN : undefined);
  if (!token) return json({ error: 'RUNNER_TOKEN is not configured.' }, { status: 503, headers });
  return json({ token }, { headers });
}
