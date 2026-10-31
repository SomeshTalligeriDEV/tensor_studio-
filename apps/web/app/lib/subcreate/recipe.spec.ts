import { describe, expect, it } from 'vitest';
import { liveRecipeSchema, parseDataset } from './recipe';

const recipe = {
  problem: 'Classify support messages by urgency', task: { block: 'classify', params: {} },
  ground_truth: { block: 'dataset', params: { file: 'custom.jsonl' } },
  scoring: [{ block: 'exact_or_fuzzy', weight: 1 }], anti_cheat: ['timeout_zero'],
  weights: { block: 'ema_normalize', params: { alpha: 0.2 } },
  brief: { problem: 'Triage', who_benefits: 'Support agents', what_miners_do: 'Classify', how_validators_check: 'Compare labels', how_rewards_flow: 'EMA weights', how_cheaters_lose: 'Timeouts score zero', why_this_design: 'Labelled evaluation', alternative_considered: 'Manual triage' },
};
describe('live SubCreate contract', () => {
  it('rejects fixtures, code, invalid scoring and duplicate-label penalties', () => {
    expect(liveRecipeSchema.safeParse(recipe).success).toBe(true);
    expect(liveRecipeSchema.safeParse({ ...recipe, code: 'print(1)' }).success).toBe(false);
    expect(liveRecipeSchema.safeParse({ ...recipe, anti_cheat: ['timeout_zero', 'copy_penalty'] }).success).toBe(false);
    expect(liveRecipeSchema.safeParse({ ...recipe, scoring: [{ block: 'latency_bonus', weight: 1 }] }).success).toBe(false);
    expect(liveRecipeSchema.safeParse({ ...recipe, ground_truth: { block: 'dataset', params: { file: 'reviews.jsonl' } } }).success).toBe(false);
  });
  it('requires real user input instead of inserting sample data', () => {
    expect(() => parseDataset('')).toThrow('2–1,000');
    expect(() => parseDataset('{"input":"a","answer":"A"}\nnot json')).toThrow('line 2');
    expect(() => parseDataset('{"input":"a","answer":"A"}\n{"input":"A","answer":"B"}')).toThrow('unique');
    expect(parseDataset('{"input":"first","answer":"A"}\n{"input":"second","answer":"B"}')).toHaveLength(2);
  });
});
