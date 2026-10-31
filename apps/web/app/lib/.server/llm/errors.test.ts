import { describe, expect, it, vi, afterEach } from 'vitest';
import { aiErrorResponse, ModelConfigurationError } from './errors';
import { z } from 'zod';
afterEach(() => { vi.restoreAllMocks(); });
describe('safe AI provider diagnostics', () => {
  it.each([401, 403, 429, 500])('logs only safe diagnostic fields for upstream %s', async statusCode => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    const secret = 'SECRET-API-KEY-never-emit';
    const error = Object.assign(new Error(secret), { name: 'AI_APICallError', statusCode, url: `https://provider.example/${secret}`, responseBody: secret, responseHeaders: { authorization: secret }, requestBodyValues: { secret } });
    const response = aiErrorResponse(error);
    const body = await response.text();
    expect(log).toHaveBeenCalledTimes(1);
    expect(log).toHaveBeenCalledWith('AI provider request failed', { name: 'AI_APICallError', upstreamStatus: statusCode });
    expect(JSON.stringify(log.mock.calls)).not.toContain(secret);
    expect(body).not.toContain(secret);
    expect(body).not.toContain('provider.example');
    expect(response.status).toBe(statusCode === 429 ? 429 : 502);
    if (statusCode === 401) expect(body).toContain('credentials');
    if (statusCode === 403) expect(body).toContain('permissions');
    if (statusCode === 429) expect(body).toContain('quota');
  });
  it('does not log arbitrary names or string statuses', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    const response = aiErrorResponse({ name: 'secret-name', statusCode: 'secret-status', message: 'secret-message' });
    expect(log).toHaveBeenCalledWith('AI provider request failed', { name: 'UnknownError', upstreamStatus: null });
    expect(await response.text()).not.toContain('secret');
  });
  it('preserves explicit configuration and validation errors without provider logging', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    const configured = aiErrorResponse(new ModelConfigurationError('Select a configured model.'));
    expect(configured.status).toBe(503); expect(await configured.text()).toBe('Select a configured model.');
    expect(aiErrorResponse(new SyntaxError('invalid')).status).toBe(400);
    const parsed = z.string().safeParse(3);
    if (!parsed.success) expect(aiErrorResponse(parsed.error).status).toBe(400);
    expect(log).not.toHaveBeenCalled();
  });
});
