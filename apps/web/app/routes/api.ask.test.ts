import { afterEach, expect, it, vi } from 'vitest';
import type { ActionFunctionArgs } from '@remix-run/cloudflare';
vi.mock('ai', () => ({ generateText: vi.fn() }));
vi.mock('~/lib/.server/llm/model', () => ({ getModel: vi.fn(() => ({})) }));
import { generateText } from 'ai';
import { action } from './api.ask';
afterEach(() => { vi.restoreAllMocks(); });
it('Ask reports upstream authentication failure safely through centralized diagnostics', async () => {
  const log = vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.mocked(generateText).mockRejectedValueOnce(Object.assign(new Error('SECRET-BEARER-value'), { name: 'AI_APICallError', statusCode: 401, responseBody: 'SECRET-BEARER-value' }));
  const request = new Request('https://studio.example/api/ask', { method: 'POST', body: JSON.stringify({ messages: [{ role: 'user', content: 'Help me build a subnet' }] }) });
  const response = await action({ request, context: { cloudflare: { env: {} } } } as unknown as ActionFunctionArgs);
  expect(response.status).toBe(502);
  const body = await response.text();
  expect(body).toContain('credentials'); expect(body).not.toContain('SECRET');
  expect(log).toHaveBeenCalledWith('AI provider request failed', { name: 'AI_APICallError', upstreamStatus: 401 });
  expect(JSON.stringify(log.mock.calls)).not.toContain('SECRET');
});
