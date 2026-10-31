import { selectedModel } from '~/lib/stores/ai';
import { useState } from 'react';
import { toast } from 'react-toastify';

export function usePromptEnhancer() {
  const [enhancingPrompt, setEnhancingPrompt] = useState(false);
  const [promptEnhanced, setPromptEnhanced] = useState(false);

  const resetEnhancer = () => {
    setEnhancingPrompt(false);
    setPromptEnhanced(false);
  };

  const enhancePrompt = async (input: string, setInput: (value: string) => void) => {
    setEnhancingPrompt(true);
    setPromptEnhanced(false);
    try {
      const response = await fetch('/api/enhancer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: input, model: selectedModel.get() }),
      });
      if (!response.ok || !response.body) throw new Error('Prompt enhancement failed. Check AI configuration and try again.');
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let result = '';
      try {
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          result += decoder.decode(value, { stream: true });
          setInput(result);
        }
        result += decoder.decode();
        if (!result.trim()) throw new Error('The provider returned an empty response.');
        setInput(result);
        setPromptEnhanced(true);
      } finally {
        reader.releaseLock();
      }
    } catch (error) {
      setInput(input);
      toast.error(error instanceof Error ? error.message : 'Could not reach the AI provider.');
    } finally {
      setEnhancingPrompt(false);
    }
  };

  return { enhancingPrompt, promptEnhanced, enhancePrompt, resetEnhancer };
}
