import { json, type ActionFunctionArgs } from '@remix-run/cloudflare';
import { generateText } from 'ai';
import { z } from 'zod';
import { getModel } from '~/lib/.server/llm/model';
import { aiErrorResponse } from '~/lib/.server/llm/errors';
import { parseSuggestions } from '~/lib/ask/response';
const input = z.object({ model: z.string().max(256).optional(), messages: z.array(z.object({ role: z.enum(['user', 'assistant']), content: z.string().min(1).max(16000) })).min(1).max(12) });
const system = `You are TensorStudio’s thoughtful Bittensor building partner. Listen carefully to the user’s goal and build on prior turns. Available tools are a code editor with browser preview, a fixed-block qa/classify recipe assembler using user-supplied labelled data, offline fixture scoring, native runner process controls, wallet tools, and a read-only chain explorer. Do not claim architecture visualization, compute-budget estimation, automatic deployment, live rewards or on-chain registration are implemented. These are ideas only if proposed explicitly as future work. Explain tradeoffs in plain language. If the goal is unclear, ask one focused question in answer and return no suggestions until enough is known. When clear, recommend a practical approach and explain the next step. Never pretend to have inspected the user’s machine or live chain. This is read-only Ask mode: never output executable artifacts, call tools, claim to change files or deploy anything. Explain uncertainty; do not invent current chain data, earnings, prices, or available free services. Return JSON {answer: string, suggestions: [{title, path: "app"|"subnet", pitch, pattern?: string, uses: string[], difficulty: 1|2|3, first_steps: string[]}]}. Provide up to 3 concrete suggestions, including an app and a subnet when relevant, with 3–5 short, practical first_steps each. Subnets need measurable evaluation data; prediction is a planned adapter, not an already implemented capability. Current assembler supports qa and classify. No markdown outside JSON.`;
export async function action({ request, context }: ActionFunctionArgs) {
  if (request.method !== 'POST') return new Response('Method not allowed', { status: 405 });
  let data: z.infer<typeof input>;
  try {
    const raw = await request.text();
    if (raw.length > 100000) return new Response('Conversation is too large.', { status: 413 });
    data = input.parse(JSON.parse(raw));
  } catch { return new Response('Provide a valid conversation of up to 12 messages.', { status: 400 }); }
  try {
    const model = getModel(context.cloudflare.env, data.model);
    const abortSignal = AbortSignal.any([request.signal, AbortSignal.timeout(60000)]);
    let text = '';
    for (let attempt = 0; attempt < 2; attempt++) {
      const result = await generateText({ model, system, messages: data.messages, maxTokens: 3000, maxRetries: 0, abortSignal,
        experimental_telemetry: { isEnabled: false } });
      text = result.text;
      const parsed = parseSuggestions(text);
      if (parsed) return json(parsed, { headers: { 'Cache-Control': 'no-store' } });
    }
    return new Response('The assistant returned an incomplete answer. Please retry your question.', { status: 502 });
  } catch (error) {
    return aiErrorResponse(error);
  }
}
