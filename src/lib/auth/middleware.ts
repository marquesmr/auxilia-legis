import { createMiddleware } from "@tanstack/react-start";

/**
 * Entrega o `userId` verificado. No deploy o cookie vai junto; no preview o hook
 * `.client` manda o bearer (cookies particionados).
 * Deslogado com auth ligado: `UnauthorizedError`. Auth desligado: usuário de dev,
 * mas lança se houver `DATABASE_URL`. Em dados por usuário, filtre por `context.userId`.
 */
export const authMiddleware = createMiddleware({ type: "function" })
  .client(async ({ next }) => {
    // Preview (iframe particionado): sessão é bearer, não cookie. No deploy é null.
    const { getBearerToken } = await import("./client");
    return next({ sendContext: { bearerToken: getBearerToken() ?? undefined } });
  })
  .server(async ({ next, context }) => {
    // Só importe `*.server` aqui: o arquivo também roda no cliente. Sem o sufixo o Vite manda o servidor ao browser.
    const { assertSameSiteRequest } = await import("./isolation.server");
    const { requireUserId } = await import("./verify.server");
    // Recusa request scripted de irmão/cross-site antes de ler dados do usuário.
    assertSameSiteRequest();
    const userId = await requireUserId(context.bearerToken);
    return next({ context: { userId } });
  });
