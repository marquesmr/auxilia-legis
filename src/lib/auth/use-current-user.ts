import { useMemo } from "react";
import { authClient, authEnabled } from "./client";

export type AppUser = {
  id: string;
  displayName: string | null;
  primaryEmail: string | null;
  profileImageUrl: string | null;
  /** Fallback de dev/sandbox (auth desligado). */
  isDevFallback: boolean;
};

/**
 * Só com auth desligado (`VITE_AUTH_ENABLED=false`). Com auth ligado, o preview faz login real.
 * O id `"dev-user"` é o mesmo de `verify.server.ts`, para as linhas terem um dono só.
 */
export const DEV_USER: AppUser = {
  id: "dev-user",
  displayName: "Dev User",
  primaryEmail: "dev@example.com",
  profileImageUrl: null,
  isDevFallback: true,
};

export type CurrentUserState = {
  /** `null` enquanto carrega E quando deslogado. */
  user: AppUser | null;
  /** Sessão ainda resolvendo — não trate `user: null` como deslogado. */
  isPending: boolean;
};

const DEV_STATE: CurrentUserState = { user: DEV_USER, isPending: false };

/**
 * Usuário + loading, igual no preview e no deploy.
 * Auth ligado: usuário real; `user` é `null` carregando (`isPending`) ou deslogado.
 * Sessão via `useSession()` (cookie no deploy, bearer no preview).
 * Auth desligado: `DEV_USER`, nunca pending.
 * Espere `isPending` antes de redirecionar: `user: null` sozinho manda o logado ao login no reload.
 * `authEnabled` é constante no load, então o hook condicional não quebra a ordem.
 */
export function useCurrentUserState(): CurrentUserState {
  if (!authEnabled) return DEV_STATE;
  // eslint-disable-next-line react-hooks/rules-of-hooks -- authEnabled é constante enquanto o app vive
  return useSessionUserState();
}

function useSessionUserState(): CurrentUserState {
  const { data, isPending } = authClient.useSession();
  const id = data?.user.id;
  const displayName = data?.user.name ?? null;
  const primaryEmail = data?.user.email ?? null;
  const rawImage = data?.user.image ?? null;
  const profileImageUrl = rawImage && !rawImage.startsWith("data:") ? rawImage : null;
  const user = useMemo<AppUser | null>(
    () => (id ? { id, displayName, primaryEmail, profileImageUrl, isDevFallback: false } : null),
    [id, displayName, primaryEmail, profileImageUrl],
  );
  return useMemo(() => ({ user, isPending }), [user, isPending]);
}

/** Atalho de `.user` para exibir. `null` é carregando OU deslogado — em guardas use `useCurrentUserState()` e `isPending`. */
export function useCurrentUser(): AppUser | null {
  return useCurrentUserState().user;
}
