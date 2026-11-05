// @ts-check
/**
 * Sequência de logout de `src/lib/auth/client.ts`, pura para o `node --test`
 * (só cobre `scripts/`).
 *
 * Preview e publicado respondem diferente se o servidor não responde:
 * - Preview: iframe particionado, sessão no bearer do sessionStorage. Apagar
 *   o token É sair; a chamada é melhor esforço e não pode travar o botão.
 * - Publicado: cookie HttpOnly `__Host-` que o JS não apaga. Só a resposta
 *   concluída limpa, e `cookieCache` (maxAge 300) faria `/get-session`
 *   mentir por minutos. Timeout aqui falha alto, não finge logout.
 */

/**
 * Preview: curto de propósito. O POST same-origin responde em dezenas de ms;
 * menos que isso largaria logout lento que ainda daria certo.
 */
export const PREVIEW_SIGN_OUT_TIMEOUT_MS = 1500;

/**
 * Publicado: só o servidor encerra a sessão, mas ainda com teto — pedido
 * preso avisa falha em vez de girar para sempre. Sem resposta em 10s, não chega.
 */
export const DEPLOYED_SIGN_OUT_TIMEOUT_MS = 10_000;

/**
 * Quanto esperar neste ambiente. Toda chamada de logout pega o teto aqui,
 * para o corte preview/publicado não divergir entre quem chama.
 * @param {boolean} livePreview
 * @returns {number}
 */
export function signOutTimeoutMs(livePreview) {
  return livePreview ? PREVIEW_SIGN_OUT_TIMEOUT_MS : DEPLOYED_SIGN_OUT_TIMEOUT_MS;
}

/**
 * Roda `start()` e desiste depois de `timeoutMs`. Nunca rejeita — quem chama
 * decide o que a falha significa, e um `try/catch` num `await` não pega
 * promessa que nunca resolve.
 * @param {() => unknown} start
 * @param {number} timeoutMs
 * @returns {Promise<"ok" | "failed" | "timeout">}
 */
export function settleWithin(start, timeoutMs) {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve("timeout"), timeoutMs);
    /** @param {"ok" | "failed"} outcome */
    const done = (outcome) => {
      clearTimeout(timer);
      resolve(outcome);
    };
    try {
      Promise.resolve(start()).then(
        () => done("ok"),
        () => done("failed"),
      );
    } catch {
      done("failed");
    }
  });
}

/**
 * @typedef {object} SignOutSteps
 * @property {boolean} livePreview
 * @property {boolean} hasBearer
 * @property {() => unknown} requestSignOut Precisa rejeitar se a resposta falhar.
 * @property {() => void} clearToken
 * @property {() => void} redirect
 * @property {number} [timeoutMs]
 */

/**
 * Encerra a sessão, limpa o token local e redireciona.
 *
 * No preview ao vivo os dois últimos sempre rodam. Publicado, só se o
 * servidor confirmou — mais nada apaga o cookie. Falha ou timeout lança,
 * em vez de reportar um logout que não aconteceu.
 * @param {SignOutSteps} steps
 * @returns {Promise<void>}
 */
export async function runSignOut({
  livePreview,
  hasBearer,
  requestSignOut,
  clearToken,
  redirect,
  timeoutMs,
}) {
  if (livePreview) {
    // Sem bearer é um iframe particionado, sem o que invalidar; com um,
    // invalida no servidor, mas não espera a resposta.
    if (hasBearer) {
      await settleWithin(requestSignOut, timeoutMs ?? signOutTimeoutMs(livePreview));
    }
    clearToken();
    redirect();
    return;
  }

  const outcome = await settleWithin(requestSignOut, timeoutMs ?? signOutTimeoutMs(livePreview));
  if (outcome !== "ok") {
    throw new Error(
      outcome === "timeout"
        ? "Sign-out timed out — you are still signed in. Please try again."
        : "Sign-out failed — you are still signed in. Please try again.",
    );
  }
  clearToken();
  redirect();
}

/**
 * @typedef {object} PreSignInSteps
 * @property {boolean} livePreview
 * @property {boolean} hasBearer
 * @property {() => unknown} requestSignOut
 * @property {() => void} clearToken
 * @property {number} [timeoutMs]
 */

/**
 * Derruba a sessão anterior antes de um login novo, para trocar de provedor
 * trocar a identidade.
 *
 * De propósito melhor esforço — ao contrário de `runSignOut`, nunca lança.
 * Também roda quando não há sessão, então tratar falha como fatal bloquearia
 * o primeiro login num soluço de rede. O OAuth seguinte emite sessão nova
 * de qualquer jeito. Só a espera tem teto, o mesmo de `runSignOut`: sessão
 * publicada morre no servidor, então ganha a janela cheia, não a do preview.
 * @param {PreSignInSteps} steps
 * @returns {Promise<void>}
 */
export async function runPreSignInSignOut({
  livePreview,
  hasBearer,
  requestSignOut,
  clearToken,
  timeoutMs,
}) {
  // No preview, sem bearer não há o que limpar.
  if (hasBearer || !livePreview) {
    await settleWithin(requestSignOut, timeoutMs ?? signOutTimeoutMs(livePreview));
  }
  clearToken();
}
