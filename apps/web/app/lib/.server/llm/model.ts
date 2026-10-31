import { createOpenAI } from '@ai-sdk/openai';
import { ModelConfigurationError } from './errors';
import { env } from 'node:process';
import { providerLabel } from './provider';

export function getModelConfig(bindings: Env) {
  const read = (key: keyof Env) => env[key] || bindings[key] || '';
  return {
    apiKey: read('AI_API_KEY') || read('CHUTES_API_KEY'),
    baseURL: read('AI_API_KEY') ? read('AI_BASE_URL') : 'https://llm.chutes.ai/v1',
    provider: read('AI_API_KEY') ? providerLabel(read('AI_BASE_URL')) : 'Chutes',
    models: (read('AI_API_KEY') ? read('AI_MODEL') : read('CHUTES_MODELS')).split(',').map((id) => id.trim()).filter(Boolean),
    fallbackKey: read('AI_FALLBACK_API_KEY'),
    fallbackURL: read('AI_FALLBACK_BASE_URL'),
    fallbackModel: read('AI_FALLBACK_MODEL'),
  };
}

export function getModel(bindings: Env, selection?: string) {
  const config = getModelConfig(bindings);
  if (selection === 'fallback') {
    if (!config.fallbackKey || !config.fallbackURL || !config.fallbackModel) {
      throw new ModelConfigurationError('Fallback provider is not configured.');
    }
    return createOpenAI({ apiKey: config.fallbackKey, baseURL: config.fallbackURL, compatibility: 'compatible' })(config.fallbackModel);
  }
  const model = selection || config.models[0];
  if (!config.apiKey || !model || !config.baseURL) {
    throw new ModelConfigurationError('Configure AI_API_KEY, AI_BASE_URL and AI_MODEL in apps/web/.env.local, or configure CHUTES_API_KEY and CHUTES_MODELS.');
  }
  if (!config.models.includes(model)) {
    throw new ModelConfigurationError('Select a configured model in AI settings.');
  }
  return createOpenAI({ apiKey: config.apiKey, baseURL: config.baseURL, compatibility: 'compatible' })(model);
}
