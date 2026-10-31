import { json, type LoaderFunctionArgs } from '@remix-run/cloudflare';
import { getModelConfig } from '~/lib/.server/llm/model';

export function loader({ context }: LoaderFunctionArgs) {
  const config = getModelConfig(context.cloudflare.env);
  return json({
    provider: config.apiKey && config.baseURL && config.models.length ? config.provider : null,
    models: config.apiKey ? config.models.map((id) => ({ id, label: `${config.provider} · ${id}` })) : [],
    fallback: Boolean(config.fallbackKey && config.fallbackURL && config.fallbackModel),
  }, { headers: { 'Cache-Control': 'no-store' } });
}
