import { getRequest } from "@tanstack/react-start/server";

/**
 * Isolamento Fetch-Metadata. Sufixo `.server` obrigatório: senão o Vite
 * leva `AsyncLocalStorage` ao browser e quebra.
 * Apps `*.grok.me` são same-site e não se confiam; `SameSite=Lax` iria na sessão.
 * Só passa same-origin, request sem header (SSR) e GET de navegação (callback OAuth).
 * Scripted cross/same-site: 403. Com `__Host-` e `trustedOrigins`, fecha o ataque.
 */
export class CrossSiteRequestError extends Error {
  readonly status = 403;
  constructor() {
    super("Forbidden: cross-site request blocked");
    this.name = "CrossSiteRequestError";
  }
}

export function assertSameSiteRequest(): void {
  const request = getRequest();
  if (!request) return; // sem request (ex.: build) — nada a barrar
  const h = request.headers;
  const site = h.get("sec-fetch-site");
  // Sem header (não-browser), mesma origem ou carga direta: ok.
  if (!site || site === "same-origin" || site === "none") return;
  // GET de topo (ex.: callback OAuth) passa mesmo cross-site; script nunca usa navigate.
  const dest = h.get("sec-fetch-dest");
  const isTopLevelGet =
    h.get("sec-fetch-mode") === "navigate" &&
    request.method === "GET" &&
    dest !== "object" &&
    dest !== "embed";
  if (isTopLevelGet) return;
  throw new CrossSiteRequestError();
}
