import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ActionFunctionArgs } from '@remix-run/cloudflare';
import { action } from '~/routes/api.subcreate';
import { getModel } from '~/lib/.server/llm/model';
import { ModelConfigurationError } from '~/lib/.server/llm/errors';
import { generateObject } from 'ai';
vi.mock('~/lib/.server/llm/model', () => ({ getModel: vi.fn() }));
vi.mock('ai', () => ({ generateObject: vi.fn(), NoObjectGeneratedError: { isInstance: () => false } }));
const args = (body: unknown) => ({ request: new Request('http://localhost/api/subcreate', { method: 'POST', body: JSON.stringify(body) }), context: { cloudflare: { env: {} } } }) as unknown as ActionFunctionArgs;
describe('live recipe API failure behavior', () => {
  beforeEach(() => { vi.resetAllMocks(); });
  it('returns setup errors without inserting a recipe', async () => {
    vi.mocked(getModel).mockImplementation(() => { throw new ModelConfigurationError('Configure CHUTES_API_KEY and CHUTES_MODELS on the server.'); });
    const response = await action(args({ problem: 'Classify support messages' }));
    expect(response.status).toBe(503);
    expect(await response.text()).toContain('CHUTES_API_KEY');
    expect(generateObject).not.toHaveBeenCalled();
  });
  it('rejects invalid requests before contacting a provider', async () => {
    const response = await action(args({ problem: 'x', code: 'evil' }));
    expect(response.status).toBe(400);
    expect(getModel).not.toHaveBeenCalled();
  });
  it('does not leak provider errors or silently use fixtures', async () => {
    vi.mocked(generateObject).mockRejectedValue(new Error('private upstream token'));
    const response = await action(args({ problem: 'Classify support messages' }));
    expect(response.status).toBe(502);
    const text = await response.text();
    expect(text).not.toContain('private upstream token');
    expect(text).toContain('No sample recipe was substituted');
  });
});
