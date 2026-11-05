/**
 * Cliente OAuth do PREVIEW (só servidor — nunca importe no cliente).
 * Cada preview tem host `*.grok-sandbox.com` dinâmico. O broker aceita UM cliente
 * para qualquer callback nesse host: login real, sem mock. No deploy, `GROK_AUTH_*` sobrescreve.
 * Tem de igualar o id/segredo do broker (lá só o hash SHA-256). Rotacione os dois juntos.
 */
export const PREVIEW_CLIENT_ID = "grok_preview";
export const PREVIEW_CLIENT_SECRET =
  "8bcdb7fc5a33874ad933ca568918d5790388a0795e44c4d1dea691f801b17ec5";

/** Issuer do broker; a discovery OIDC fica sob ele. */
export const GROK_ISSUER_DEFAULT = "https://auth.grok.me";

/** Hosts cujo callback o cliente de preview aceita. O origin real sai do host do request (wildcard). */
export const PREVIEW_ALLOWED_HOSTS = ["*.grok-sandbox.com"] as const;
