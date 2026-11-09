import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";

export const estadoSpotifyConta = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const { estadoSpotify } = await import("./spotify.server");
    return estadoSpotify(context.userId);
  });

export const salvarClientIdSpotify = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => {
    const clientId = typeof input === "object" && input && "clientId" in input ? String((input as { clientId?: unknown }).clientId ?? "") : "";
    return { clientId: clientId.trim() };
  })
  .handler(async ({ data, context }) => {
    const { guardarClientIdSpotify } = await import("./spotify.server");
    return guardarClientIdSpotify(context.userId, data.clientId);
  });

export const vincularSpotify = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const { iniciarSpotify } = await import("./spotify.server");
    return iniciarSpotify(context.userId);
  });

export const listarPlaylistsSpotify = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const { playlistsSpotify } = await import("./spotify.server");
    return playlistsSpotify(context.userId);
  });

export const sairSpotify = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const { desvincularSpotify } = await import("./spotify.server");
    return desvincularSpotify(context.userId);
  });
