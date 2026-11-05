import { getRequest } from "@tanstack/react-start/server";
import { gateIdentityEnabled } from "./gate-identity.server";
import { auth, authConfigured } from "./server";

/**
 * Sessão no servidor. O cookie same-origin vai em server functions e loaders SSR.
 * O usuário sai de `auth.api.getSession` — nunca confie num id vindo do cliente.
 */

const databaseConfigured = Boolean(process.env.DATABASE_URL?.trim());

/** Reexportado para não importar `server.ts` (segredo e `pg`). */
export { authConfigured };

if (databaseConfigured && !authConfigured) {
  console.error(
    "[auth] DATABASE_URL is set but auth is disabled (VITE_AUTH_ENABLED=false) " +
      "— requireUserId() will reject every request (fail closed) rather than " +
      "share one dev user on a real database.",
  );
}

/** Id de dev, só com auth desligado. */
export const DEV_USER_ID = "dev-user";

/** Sem sessão válida. `status` 401; a mensagem `"Unauthorized"` é contrato estável no cliente. */
export class UnauthorizedError extends Error {
  readonly status = 401;
  constructor() {
    super("Unauthorized");
    this.name = "UnauthorizedError";
  }
}

export type VerifiedUser = { id: string; email: string | null };

/**
 * Usuário da request, ou `null` sem auth/sessão. Vale em server functions e SSR.
 * `bearerToken` é do preview (iframe particionado: o cookie não chega) e vira
 * `Authorization: Bearer`. No deploy não há token e vale o cookie.
 */
export async function getSessionUser(
  bearerToken?: string,
): Promise<VerifiedUser | null> {
  if (!authConfigured && !gateIdentityEnabled()) return null;
  const request = getRequest();
  if (!request) return null;
  let headers = request.headers;
  if (bearerToken) {
    headers = new Headers(request.headers);
    headers.set("Authorization", `Bearer ${bearerToken}`);
  }
  const session = await auth.api.getSession({ headers });
  if (!session?.user) return null;
  return { id: session.user.id, email: session.user.email ?? null };
}

/**
 * Id do usuário ou lança. Prefira `authMiddleware`.
 * Auth ligado: id da sessão; deslogado lança `UnauthorizedError` (também no preview).
 * Auth desligado + `DATABASE_URL`: lança (fail closed) — um dev user compartilhado vaza dados.
 * Auth desligado sem banco: id de dev.
 */
export async function requireUserId(bearerToken?: string): Promise<string> {
  if (!authConfigured && !gateIdentityEnabled()) {
    if (databaseConfigured) {
      throw new Error(
        "Auth is disabled (VITE_AUTH_ENABLED=false) but DATABASE_URL is set — " +
          "refusing to fall back to the shared dev user against a real database.",
      );
    }
    return DEV_USER_ID;
  }
  const user = await getSessionUser(bearerToken);
  if (!user) throw new UnauthorizedError();
  const { barrarSePreciso } = await import("../gestao.server");
  await barrarSePreciso(user.id);
  return user.id;
}
