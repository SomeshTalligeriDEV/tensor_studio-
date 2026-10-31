export function providerLabel(baseURL: string): string {
  try { if (new URL(baseURL).origin === 'https://api.groq.com') return 'Groq'; } catch { /* Unconfigured provider */ }
  return 'Configured provider';
}
