/** Browser-only signer boundary. Callers never receive key material. */
export interface Signer {
  readonly kind: 'mnemonic' | 'extension' | 'social';
  readonly address: string;
  readonly locked: boolean;
  sign(payload: Uint8Array): Promise<Uint8Array>;
  lock(): void;
}
