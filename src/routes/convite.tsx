import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { abrirConviteEquipe } from "@/lib/convite-equipe.functions";

export const Route = createFileRoute("/convite")({
  head: () => ({ meta: [{ title: "Convite · Auxilia Legis" }] }),
  component: Convite,
});

function Convite() {
  const [erro, setErro] = useState("");

  useEffect(() => {
    const token = new URLSearchParams(window.location.search).get("token") ?? "";
    void abrirConviteEquipe({ data: { token } })
      .then((resultado) => {
        if (resultado.destino === "painel") {
          window.location.replace("/");
          return;
        }
        const params = new URLSearchParams({
          convite: "1",
          email: resultado.email,
          nome: resultado.nome,
        });
        window.location.replace(`/login?${params.toString()}`);
      })
      .catch((err: unknown) => {
        setErro(err instanceof Error ? err.message : "Este convite não é válido.");
      });
  }, []);

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4 py-16">
      <p className="font-display text-3xl text-ink">Auxilia Legis</p>
      {erro ? (
        <p className="mt-4 text-justify text-sm leading-relaxed text-seal">{erro}</p>
      ) : (
        <p className="mt-4 text-sm text-muted">Abrindo o convite da equipe…</p>
      )}
    </main>
  );
}
