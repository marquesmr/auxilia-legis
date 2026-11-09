import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/spotify/callback")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const destino = new URL("https://www.auxilialegis.online/");
        const code = url.searchParams.get("code") ?? "";
        const state = url.searchParams.get("state") ?? "";
        if (url.searchParams.get("error") || !code || !state) {
          destino.searchParams.set("spotify", "negado");
          return Response.redirect(destino, 302);
        }
        try {
          const { concluirSpotify } = await import("@/lib/spotify.server");
          await concluirSpotify(state, code);
          destino.searchParams.set("spotify", "vinculada");
        } catch {
          destino.searchParams.set("spotify", "erro");
        }
        return Response.redirect(destino, 302);
      },
    },
  },
});
