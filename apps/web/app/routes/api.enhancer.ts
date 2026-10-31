import { enhancerRequest } from '~/lib/.server/llm/request';
import { aiErrorResponse } from '~/lib/.server/llm/errors';
import { type ActionFunctionArgs } from '@remix-run/cloudflare';
import { streamText } from '~/lib/.server/llm/stream-text';
import { stripIndents } from '~/utils/stripIndent';


export async function action(args: ActionFunctionArgs) {
  return enhancerAction(args);
}

async function enhancerAction({ context, request }: ActionFunctionArgs) {


  try {
    const { message, model } = enhancerRequest.parse(await request.json());
    const result = await streamText(
      [
        {
          role: 'user',
          content: stripIndents`
          I want you to improve the user prompt that is wrapped in \`<original_prompt>\` tags.

          IMPORTANT: Only respond with the improved prompt and nothing else!

          <original_prompt>
            ${message}
          </original_prompt>
        `,
        },
      ],
      context.cloudflare.env,
      undefined,
      model,
    );

    return result.toTextStreamResponse();
  } catch (error) {
    return aiErrorResponse(error);
  }
}
