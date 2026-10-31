import { atom } from 'nanostores';

// Only the model identifier is shared with the browser. Credentials stay server-side.
export const selectedModel = atom('');
