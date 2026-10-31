import { ZodError } from 'zod';

export class ModelConfigurationError extends Error {}

// Provider errors may include credentials in their message, URL, body or headers.
// Even names are untrusted: emit only recognized diagnostic names.
const SAFE_NAMES = new Set(['Error', 'TypeError', 'AbortError', 'TimeoutError', 'AI_APICallError', 'APICallError', 'AI_RetryError', 'RetryError', 'AI_NoContentGeneratedError', 'AI_InvalidResponseDataError']);
function providerDiagnostic(error: unknown) {
  const value = error && typeof error === 'object' ? error as Record<string, unknown> : {};
  const candidate = value.statusCode ?? value.status;
  const upstreamStatus = typeof candidate === 'number' && Number.isInteger(candidate) && candidate >= 100 && candidate <= 599 ? candidate : null;
  return { name: typeof value.name === 'string' && SAFE_NAMES.has(value.name) ? value.name : 'UnknownError', upstreamStatus };
}

export function aiErrorResponse(error: unknown) {
  if (error instanceof ZodError || error instanceof SyntaxError) {
    return new Response('Invalid request: provide a message and a valid model selection.', { status: 400 });
  }
  if (error instanceof ModelConfigurationError) {
    return new Response(error.message, { status: 503, headers: { 'Content-Type': 'text/plain' } });
  }
  const diagnostic = providerDiagnostic(error);
  console.error('AI provider request failed', diagnostic);
  const message = diagnostic.upstreamStatus === 401
    ? 'The AI provider rejected the server credentials. Check the configured provider API key.'
    : diagnostic.upstreamStatus === 403
      ? 'The AI provider denied access. Check server account permissions and model access.'
      : diagnostic.upstreamStatus === 429
        ? 'The AI provider rate limit or quota was reached. Check provider quota and retry later.'
        : 'AI provider failed. Check server configuration and provider availability.';
  return new Response(message, { status: diagnostic.upstreamStatus === 429 ? 429 : 502, headers: { 'Content-Type': 'text/plain', 'Cache-Control': 'no-store' } });
}
