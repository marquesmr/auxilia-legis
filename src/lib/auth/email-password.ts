/** E-mail/senha local (banco deste app, não o broker). Não edite `server.ts` — só este arquivo. */
export const emailAndPasswordEnabled = true;

export const emailAndPassword = {
  enabled: true,
  revokeSessionsOnPasswordReset: true,
  minPasswordLength: 8,
} as const;
