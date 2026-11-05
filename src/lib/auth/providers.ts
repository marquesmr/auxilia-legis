/**
 * Provedores de login via broker. Fonte única do servidor e do cliente.
 * Sem dependências: senão o bundle puxa Better Auth e `pg`.
 * Os segredos Google/X ficam no broker; o app só manda `idp`.
 * `providerId` é o id local e o segmento do callback; `idp` é o hint (X ainda é `twitter`).
 */
export type GrokProvider = {
  /** Id local e segmento do callback. */
  providerId: string;
  /** Hint que o broker encaminha (id social do Better Auth). */
  idp: string;
  label: string;
};

export const GROK_PROVIDERS: readonly GrokProvider[] = [
  { providerId: "grok-google", idp: "google", label: "Google" },
  { providerId: "grok-x", idp: "twitter", label: "X" },
];
