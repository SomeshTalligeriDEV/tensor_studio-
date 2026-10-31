import { z } from 'zod';
const text = z.string().trim().min(1).max(1000);
const empty = z.object({}).strict();
export const liveRecipeSchema = z.object({
  problem: z.string().trim().min(1).max(2000),
  task: z.object({ block: z.enum(['qa', 'classify']), params: empty }).strict(),
  ground_truth: z.object({ block: z.literal('dataset'), params: z.object({ file: z.literal('custom.jsonl') }).strict() }).strict(),
  scoring: z.array(z.object({ block: z.enum(['exact_or_fuzzy', 'latency_bonus']), weight: z.number().finite().positive().max(1) }).strict()).min(1).max(2),
  anti_cheat: z.array(z.enum(['copy_penalty', 'timeout_zero'])).min(1).max(2),
  weights: z.discriminatedUnion('block', [
    z.object({ block: z.literal('ema_normalize'), params: z.object({ alpha: z.number().finite().positive().max(1) }).strict() }).strict(),
    z.object({ block: z.literal('top_k'), params: z.object({ k: z.number().int().min(1).max(256) }).strict() }).strict(),
  ]),
  brief: z.object({ problem: text, who_benefits: text, what_miners_do: text, how_validators_check: text, how_rewards_flow: text, how_cheaters_lose: text, why_this_design: text, alternative_considered: text }).strict(),
}).strict().superRefine((recipe, ctx) => {
  const scores = recipe.scoring.map((part) => part.block);
  if (new Set(scores).size !== scores.length || !scores.includes('exact_or_fuzzy') || Math.abs(recipe.scoring.reduce((sum, part) => sum + part.weight, 0) - 1) > 1e-9) ctx.addIssue({ code: 'custom', message: 'Scoring requires correctness and weights summing to 1.' });
  if (new Set(recipe.anti_cheat).size !== recipe.anti_cheat.length || !recipe.anti_cheat.includes('timeout_zero')) ctx.addIssue({ code: 'custom', message: 'Unique anti-cheat blocks must include timeout_zero.' });
  if (recipe.task.block === 'classify' && recipe.anti_cheat.includes('copy_penalty')) ctx.addIssue({ code: 'custom', message: 'Identical classification labels are not evidence of copying.' });
});
export type LiveRecipe = z.infer<typeof liveRecipeSchema>;
const rowSchema = z.object({ input: z.string().trim().min(1).max(4096), answer: z.string().trim().min(1).max(4096) }).strict();
export function parseDataset(text: string) {
  if (new TextEncoder().encode(text).length > 2 * 1024 * 1024) throw new Error('Dataset exceeds 2 MiB.');
  const lines = text.split(/\r?\n/).filter((line) => line.trim());
  if (lines.length < 2 || lines.length > 1000) throw new Error('Provide 2–1,000 labelled JSONL examples.');
  const rows = lines.map((line, index) => {
    try { return rowSchema.parse(JSON.parse(line)); } catch { throw new Error(`Dataset line ${index + 1} must contain non-empty input and answer strings, each at most 4096 characters.`); }
  });
  if (new Set(rows.map((row) => row.input.toLowerCase().replace(/\s+/g, ' ').trim())).size !== rows.length) throw new Error('Dataset inputs must be unique.');
  return rows;
}
