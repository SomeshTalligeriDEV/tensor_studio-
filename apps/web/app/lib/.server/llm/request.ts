import { z } from 'zod';

const model = z.string().max(256).optional();
export const chatRequest = z.object({
  model,
  messages: z.array(z.object({
    role: z.enum(['user', 'assistant']),
    content: z.string().max(200000),
  })).min(1).max(200),
});
export const enhancerRequest = z.object({ model, message: z.string().trim().min(1).max(20000) });
