import { describe, expect, it } from 'vitest';
import { parseSuggestions } from './response';
const suggestion = { title: 'Sports predictions', path: 'subnet', pitch: 'Score predictions against outcomes.', pattern: 'prediction', uses: [], difficulty: 2, first_steps: ['Define outcomes', 'Collect labelled examples'] };
describe('Ask suggestions', () => {
  it('parses fenced structured responses', () => {
    expect(parseSuggestions('```json\n' + JSON.stringify({ answer: 'Two possible directions.', suggestions: [suggestion] }) + '\n```')?.suggestions[0].path).toBe('subnet');
  });
  it('rejects malformed JSON, executable paths, and excess suggestions', () => {
    expect(parseSuggestions('plain answer')).toBeNull();
    expect(parseSuggestions(JSON.stringify({ answer: 'x', suggestions: [{ ...suggestion, path: '/exec' }] }))).toBeNull();
    expect(parseSuggestions(JSON.stringify({ answer: 'x', suggestions: Array(4).fill(suggestion) }))).toBeNull();
  });
});
