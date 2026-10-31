import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { getModel, getModelConfig } from './model';

beforeEach(() => {
  for (const key of Object.keys(process.env)) {
    if (key.startsWith('AI_') || key.startsWith('CHUTES_')) vi.stubEnv(key, '');
  }
});
afterEach(() => { vi.unstubAllEnvs(); });

const bindings = { CHUTES_API_KEY: 'test-key', CHUTES_MODELS: ' model-a, model-b ' } as Env;

describe('server model selection', () => {
  it('uses the configured default and allows configured alternatives', () => {
    expect(getModel(bindings).modelId).toBe('model-a');
    expect(getModel(bindings, 'model-b').modelId).toBe('model-b');
  });
  it('rejects unconfigured model IDs and missing fallback credentials', () => {
    expect(() => getModel(bindings, 'unapproved')).toThrow('configured model');
    expect(() => getModel(bindings, 'fallback')).toThrow('not configured');
  });
  it('normalizes the configured list', () => {
    expect(getModelConfig(bindings).models).toEqual(['model-a', 'model-b']);
  });
});

it('uses the configured OpenAI-compatible provider as the default', () => {
  const generic = { AI_API_KEY: 'test-key', AI_BASE_URL: 'https://example.com/v1', AI_MODEL: 'configured-model' } as Env;
  expect(getModel(generic).modelId).toBe('configured-model');
  expect(getModelConfig(generic).models).toEqual(['configured-model']);
});
