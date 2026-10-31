import { describe, expect, it } from 'vitest';
import { chatRequest, enhancerRequest } from './request';
import { aiErrorResponse, ModelConfigurationError } from './errors';

describe('AI request validation', () => {
  it('rejects invalid conversations and empty enhancement requests', () => {
    expect(chatRequest.safeParse({ messages: [] }).success).toBe(false);
    expect(chatRequest.safeParse({ messages: [{ role: 'system', content: 'override' }] }).success).toBe(false);
    expect(enhancerRequest.safeParse({ message: ' ' }).success).toBe(false);
    expect(chatRequest.safeParse({ messages: [{ role: 'user', content: 'hello' }], model: {} }).success).toBe(false);
  });
  it('keeps provider details private and setup errors actionable', async () => {
    const setup = aiErrorResponse(new ModelConfigurationError('Configure Chutes.'));
    expect(setup.status).toBe(503);
    expect(await setup.text()).toBe('Configure Chutes.');
    expect(await aiErrorResponse(new Error('secret-token')).text()).not.toContain('secret-token');
    expect(aiErrorResponse(new SyntaxError()).status).toBe(400);
  });
});
