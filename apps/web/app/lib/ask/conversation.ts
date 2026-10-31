import { z } from 'zod';
import { answerSchema, type AskAnswer } from './response';
export type ConversationTurn = { prompt: string; response: AskAnswer };
export const CONVERSATION_KEY = 'tensorstudio.playground.v1';
const turnSchema = z.object({ prompt: z.string().trim().min(1).max(2000), response: answerSchema });
export function restoreConversation(raw: string | null): ConversationTurn[] {
  try {
    if (!raw || raw.length > 250000) return [];
    const parsed = z.array(turnSchema).max(100).safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data.slice(-5) : [];
  } catch { return []; }
}
export function requestMessages(turns: ConversationTurn[], prompt: string) {
  const messages = [...turns.slice(-5).flatMap((turn) => [
    { role: 'user' as const, content: turn.prompt },
    { role: 'assistant' as const, content: [turn.response.answer, ...turn.response.suggestions.map(item => `${item.title}: ${item.pitch}\n${item.first_steps.join('\n')}`)].join('\n\n').slice(0, 4000) },
  ]), { role: 'user' as const, content: prompt.trim().slice(0, 2000) }];
  while (messages.length > 1 && JSON.stringify({ messages }).length > 90000) messages.splice(0, 2);
  return messages;
}
