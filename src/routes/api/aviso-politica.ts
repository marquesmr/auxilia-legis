import { createFileRoute } from "@tanstack/react-router";
import { urlDoSite } from "@/lib/email.server";
import { dispararAvisoPolitica } from "@/lib/politica-email.server";

export const Route = createFileRoute("/api/aviso-politica")({
  server: {
    handlers: {
      POST: async () => {
        const origem = (await urlDoSite()) || "https://auxilialegis.online";
        const resultado = await dispararAvisoPolitica(origem);
        return Response.json(resultado);
      },
    },
  },
});
