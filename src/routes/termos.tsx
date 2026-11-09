import { createFileRoute, Link } from "@tanstack/react-router";
import { TextoDosTermos } from "@/components/termos-cadastro";

export const Route = createFileRoute("/termos")({
  head: () => ({
    meta: [
      { title: "Termos de Serviço · Auxilia Legis" },
      { name: "description", content: "Termos de Serviço do site e do aplicativo Auxilia Legis." },
    ],
  }),
  component: Termos,
});

function Termos() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      <p className="text-xs text-muted">Programa Auxilia Legis · Site e aplicativo · Atualizado em 9 de novembro de 2026</p>
      <h1 className="mt-2 font-display text-4xl text-ink">Termos de Serviço</h1>
      <div className="mt-6 space-y-3 text-sm leading-relaxed text-ink">
        <TextoDosTermos />
      </div>
      <Link to="/login" className="mt-8 inline-flex h-11 items-center text-sm font-medium text-pine">
        Voltar ao login
      </Link>
    </main>
  );
}
