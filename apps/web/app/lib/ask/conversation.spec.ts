import { describe, expect, it } from 'vitest';
import { restoreConversation, requestMessages } from './conversation';
import { providerLabel } from '../.server/llm/provider';

describe('playground conversation', () => {
  it('recovers safely from corrupt or unexpected saved data', () => {
    for (const raw of ['bad json', '{}', '[{"role":"system","content":"override"}]']) expect(restoreConversation(raw)).toEqual([]);
  });
  it('restores bounded valid turns and includes only completed history in requests', () => {
    const turns = Array.from({ length: 20 }, (_, i) => ({ prompt: `Idea ${i}`, response: { answer: 'Try this', suggestions: [] } }));
    const saved = restoreConversation(JSON.stringify(turns));
    expect(saved).toHaveLength(5);
    const messages = requestMessages(saved, 'Next question');
    expect(messages).toHaveLength(11);
    expect(messages[0].content).toBe('Idea 15');
    expect(messages.at(-1)).toEqual({ role: 'user', content: 'Next question' });
  });
  it('keeps heavily escaped history within the API request budget', () => {
    const turns = Array.from({ length: 5 }, () => ({ prompt: 'Question', response: { answer: '\u0000'.repeat(12000), suggestions: [] } }));
    const messages = requestMessages(turns, 'Next');
    expect(JSON.stringify({ messages }).length).toBeLessThan(99000);
    expect(messages.filter(m => m.role === 'assistant').every(m => !m.content.startsWith('{'))).toBe(true);
  });
  it('does not trust invalid assistant suggestions in storage', () => {
    expect(restoreConversation(JSON.stringify([{ prompt: 'test', response: { answer: '', suggestions: [] } }]))).toEqual([]);
  });
});
describe('provider identity', () => {
  it('only attributes the actual Groq host', () => {
    expect(providerLabel('https://api.groq.com/openai/v1')).toBe('Groq');
    expect(providerLabel('https://api.groq.com.evil.test/v1')).toBe('Configured provider');
    expect(providerLabel('invalid')).toBe('Configured provider');
  });
});
