import { z } from 'zod';
const suggestion = z.object({
  title: z.string().min(1).max(120), path: z.enum(['app', 'subnet']),
  pitch: z.string().min(1).max(1000), pattern: z.string().max(80).optional(),
  uses: z.array(z.string().max(120)).max(6), difficulty: z.number().int().min(1).max(3),
  first_steps: z.array(z.string().min(1).max(300)).min(1).max(8),
});
export const answerSchema = z.object({ answer: z.string().min(1).max(12000), suggestions: z.array(suggestion).max(3) });
export type AskAnswer = z.infer<typeof answerSchema>;
export function parseSuggestions(text: string): AskAnswer | null {
  try {
    const parsed = answerSchema.safeParse(JSON.parse(text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')));
    return parsed.success ? parsed.data : null;
  } catch { return null; }
}
