import { genericOAuthClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";
import { runPreSignInSignOut, runSignOut } from "../../../scripts/sign-out-plan.mjs";
import { GROK_PROVIDERS } from "./providers";
import { soltarTemaDaConta } from "@/lib/preferencias";
import { liberarProximoAcesso } from "@/lib/lembrar-acesso";

/**
 * Cliente Better Auth no browser, same-origin em `/api/auth/*`.
 * No preview o iframe tem cookies particionados: o bearer do popup autentica
 * (`onRequest` anexa). No deploy não há token.
 * Saia só por `signOut()`: `authClient.signOut()` deixa o bearer e a sessão volta.
 */
export const authClient = createAuthClient({
  plugins: [genericOAuthClient()],
  fetchOptions: {
    onRequest(ctx) {
      const token = getBearerToken();
      if (token) ctx.headers.set("Authorization", `Bearer ${token}`);
      return ctx;
    },
  },
});

/** Login na UI quando `VITE_AUTH_ENABLED` não é `"false"`. O padrão é `"false"` (usuário de dev). Sem a chave, o login é real no preview e no deploy. */
export const authEnabled = import.meta.env.VITE_AUTH_ENABLED !== "false";

export { GROK_PROVIDERS };

// Preview: iframe com cookies particionados. O bearer fica no sessionStorage
// e vai em cada request (e nas server functions). Vazio fora do popup.
const BEARER_KEY = "grok-auth.bearer-token";

export function getBearerToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.sessionStorage.getItem(BEARER_KEY);
  } catch {
    return null;
  }
}

function setBearerToken(token: string | null): void {
  if (typeof window === "undefined") return;
  try {
    if (token) window.sessionStorage.setItem(BEARER_KEY, token);
    else window.sessionStorage.removeItem(BEARER_KEY);
  } catch {
    /* sem storage — ignora */
  }
}

/** No preview (`*.grok-sandbox.com`) o redirect ao broker não cabe no iframe: login por popup. */
function inLivePreview(): boolean {
  return (
    typeof window !== "undefined" &&
    window.location.hostname.endsWith(".grok-sandbox.com")
  );
}

type PopupMessage = { source: "grok-auth-popup"; token: string | null; error?: string };

/**
 * Login via broker. Preview: popup em `/auth/popup` que devolve o bearer, sem navegar o iframe.
 * Deploy: redirect de página. Limpa a sessão local antes — senão trocar de provedor não troca a identidade.
 */
export async function signIn(
  providerId: string,
  opts: { callbackURL?: string; errorCallbackURL?: string } = {},
): Promise<void> {
  const callbackURL = opts.callbackURL ?? "/";
  const errorCallbackURL = opts.errorCallbackURL ?? "/";

  // Abre o popup no clique, antes de qualquer await: o iframe cross-origin perde o gesto.
  const popup = inLivePreview() ? openSignInPopup(providerId) : null;

  // Na tela de login o Google e o X não têm sessão para encerrar. Esperar o
  // sign-out segura o clique vários segundos antes de sair da página.
  const socialDireto =
    !inLivePreview() && (providerId === "grok-google" || providerId === "grok-x");
  if (!socialDireto) {
    await runPreSignInSignOut({
      livePreview: inLivePreview(),
      hasBearer: Boolean(getBearerToken()),
      requestSignOut: () => authClient.signOut(),
      clearToken: () => setBearerToken(null),
    });
  }

  if (inLivePreview()) {
    if (!popup) throw new Error("Pop-up blocked — allow pop-ups for sign-in");
    const token = await waitForPopupToken(popup);
    if (!token) throw new Error("Sign-in was cancelled or failed");
    setBearerToken(token);
    // Atualiza a sessão com o bearer. Não recarrega o iframe se já estamos no destino.
    try {
      await authClient.getSession();
    } catch {
      /* a sessão volta no próximo useSession */
    }
    if (typeof window !== "undefined") {
      const dest = new URL(callbackURL, window.location.origin);
      const here = window.location;
      if (dest.origin !== here.origin || dest.pathname !== here.pathname || dest.search !== here.search) {
        window.location.href = callbackURL;
      }
    }
    return;
  }

  if (providerId === "grok-google") {
    const { data, error } = await authClient.signIn.social({
      provider: "google",
      callbackURL,
      errorCallbackURL,
    });
    if (error) throw new Error(error.message ?? "Não foi possível entrar com o Google.");
    if (data?.url) window.location.href = data.url;
    return;
  }

  if (providerId === "grok-x") {
    const { data, error } = await authClient.signIn.social({
      provider: "twitter",
      callbackURL,
      errorCallbackURL,
    });
    if (error) throw new Error(error.message ?? "Não foi possível entrar com o X.");
    if (data?.url) window.location.href = data.url;
    return;
  }

  const { data, error } = await authClient.signIn.oauth2({
    providerId,
    callbackURL,
    errorCallbackURL,
  });
  if (error) throw new Error(error.message ?? "Sign-in failed");
  if (data?.url) window.location.href = data.url;
}

/**
 * Abre `/auth/popup` no clique (plugin Vite, não rota React).
 * URL real, não about:blank: no iframe cross-origin isso falha e mostra o app.
 */
function openSignInPopup(providerId: string): Window | null {
  const origin = window.location.origin;
  const url = `${origin}/auth/popup?providerId=${encodeURIComponent(providerId)}`;
  // Nome único: senão reusa janela presa na SPA.
  const name = `grok-signin-${Date.now()}`;
  return window.open(url, name, "popup,width=500,height=650");
}

function waitForPopupToken(popup: Window): Promise<string | null> {
  return new Promise((resolve) => {
    const origin = window.location.origin;
    let settled = false;
    let closeTimer: number | undefined;
    const settle = (token: string | null) => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(token);
    };
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== origin) return;
      const data = event.data as PopupMessage | undefined;
      if (!data || data.source !== "grok-auth-popup") return;
      settle(data.token ?? null);
    };
    // Se fechar o popup, espera o postMessage ganhar da corrida com `popup.closed`.
    const pollTimer = window.setInterval(() => {
      if (!popup.closed) return;
      window.clearInterval(pollTimer);
      closeTimer = window.setTimeout(() => settle(null), 400);
    }, 300);
    function cleanup() {
      window.clearInterval(pollTimer);
      if (closeTimer !== undefined) window.clearTimeout(closeTimer);
      window.removeEventListener("message", onMessage);
    }
    window.addEventListener("message", onMessage);
  });
}

/**
 * Encerra a sessão local, limpa o bearer do preview e redireciona. Não use `authClient.signOut()`.
 * No deploy, rejeita se o servidor não confirmar: só ele apaga o cookie HttpOnly.
 * No preview, limpar o local basta.
 */
export async function signOut(redirectTo = "/"): Promise<void> {
  await runSignOut({
    livePreview: inLivePreview(),
    hasBearer: Boolean(getBearerToken()),
    // Better Auth devolve `{ error }` em vez de rejeitar; aqui vira throw.
    requestSignOut: async () => {
      const { error } = await authClient.signOut();
      if (error) throw new Error(error.message ?? "Sign-out failed");
    },
    clearToken: () => setBearerToken(null),
    redirect: () => {
      soltarTemaDaConta();
      liberarProximoAcesso();
      window.location.href = redirectTo;
    },
  });
}
