import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { abrirConviteEquipe, lerConviteEquipe } from "@/lib/convite-equipe.functions";

export const Route = createFileRoute("/convite")({
  head: () => ({ meta: [{ title: "Convite · Auxilia Legis" }] }),
  component: Convite,
});

function Convite() {
  const [token, setToken] = useState("");
  const [erro, setErro] = useState("");
  const [dados, setDados] = useState<{ nome: string; email: string; equipe: string } | null>(null);
  const [entrando, setEntrando] = useState(false);

  useEffect(() => {
    const valor = new URLSearchParams(window.location.search).get("token") ?? "";
    setToken(valor);
    void lerConviteEquipe({ data: { token: valor } })
      .then((convite) => setDados(convite))
      .catch((err: unknown) => setErro(err instanceof Error ? err.message : "Este convite não é válido."));
  }, []);

  function entrar() {
    setEntrando(true);
    setErro("");
    void abrirConviteEquipe({ data: { token } })
      .then((resultado) => {
        if (resultado.destino === "painel") {
          window.location.replace("/");
          return;
        }
        const params = new URLSearchParams({ convite: "1", email: resultado.email, nome: resultado.nome });
        window.location.replace(`/login?${params.toString()}`);
      })
      .catch((err: unknown) => {
        setEntrando(false);
        setErro(err instanceof Error ? err.message : "Este convite não é válido.");
      });
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4 py-16">
      <p className="font-display text-3xl text-ink">Auxilia Legis</p>
      {dados ? (
        <>
          <p className="mt-4 text-justify text-sm leading-relaxed text-ink">
            {dados.nome}, você foi convidado para a equipe <strong>{dados.equipe}</strong>. Este convite vale 24 horas. Clique no botão para entrar.
          </p>
          <button
            type="button"
            onClick={entrar}
            disabled={entrando}
            className="mt-4 inline-flex h-12 items-center justify-center rounded-xl bg-pine text-sm font-medium text-sheet disabled:opacity-60"
          >
            {entrando ? "Abrindo…" : "Acessar minha equipe"}
          </button>
        </>
      ) : (
        <p className={`mt-4 text-justify text-sm leading-relaxed ${erro ? "text-seal" : "text-muted"}`}>
          {erro || "Conferindo o convite…"}
        </p>
      )}
      {dados && erro && <p className="mt-3 text-justify text-sm leading-relaxed text-seal">{erro}</p>}
    </main>
  );
}
