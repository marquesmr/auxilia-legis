import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { DiaMarcado } from "@/lib/prazos";
import { CalculadoraAbaixo } from "@/components/calculadora";

const SEMANA = ["D", "S", "T", "Q", "Q", "S", "S"];

function isoDo(ano: number, mes: number, dia: number) {
  return `${ano}-${String(mes + 1).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
}

export function CalendarioExpediente({ dias, equipeId = null }: { dias: DiaMarcado[]; equipeId?: string | null }) {
  const [cursor, setCursor] = useState(() => {
    const hoje = new Date();
    return new Date(hoje.getFullYear(), hoje.getMonth(), 1);
  });
  const [escolhido, setEscolhido] = useState<string | null>(null);
  const mapa = useMemo(() => {
    const itens = new Map<string, DiaMarcado>();
    for (const dia of dias) itens.set(dia.data, dia);
    return itens;
  }, [dias]);

  const ano = cursor.getFullYear();
  const mes = cursor.getMonth();
  const titulo = new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" }).format(cursor);
  const primeiro = new Date(ano, mes, 1);
  const inicio = primeiro.getDay();
  const quantidade = new Date(ano, mes + 1, 0).getDate();
  const hoje = new Date();
  const hojeIso = isoDo(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
  const celulas: Array<number | null> = [...Array(inicio).fill(null), ...Array.from({ length: quantidade }, (_, i) => i + 1)];
  while (celulas.length % 7 !== 0) celulas.push(null);
  const doMes = dias.filter((dia) => dia.data.startsWith(`${ano}-${String(mes + 1).padStart(2, "0")}`));
  const aberto = escolhido ? mapa.get(escolhido) : undefined;

  return (
    <>
    <section className="rounded-2xl border border-line bg-sheet p-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-display text-lg capitalize leading-none text-ink">{titulo}</h2>
        <div className="flex gap-1">
          <button type="button" aria-label="Mês anterior" onClick={() => setCursor(new Date(ano, mes - 1, 1))} className="grid size-8 place-items-center rounded-lg text-ink">
            <ChevronLeft className="size-4" />
          </button>
          <button type="button" aria-label="Próximo mês" onClick={() => setCursor(new Date(ano, mes + 1, 1))} className="grid size-8 place-items-center rounded-lg text-ink">
            <ChevronRight className="size-4" />
          </button>
        </div>
      </div>
      <div className="mt-3 grid grid-cols-7 gap-1 text-center text-xs text-muted">
        {SEMANA.map((dia, indice) => (
          <span key={`${dia}-${indice}`}>{dia}</span>
        ))}
      </div>
      <div className="mt-1 grid grid-cols-7 gap-1">
        {celulas.map((dia, indice) => {
          if (!dia) return <span key={`vazio-${indice}`} />;
          const iso = isoDo(ano, mes, dia);
          const marca = mapa.get(iso);
          const atual = iso === hojeIso;
          const classe = marca
            ? marca.tipo === "feriado"
              ? "bg-pine text-sheet"
              : "bg-pine-soft text-pine"
            : atual
              ? "text-ink"
              : "text-ink";
          return (
            <button
              key={iso}
              type="button"
              onClick={() => setEscolhido(iso)}
              className={"relative grid h-9 place-items-center rounded-lg text-sm " + classe + (atual ? " ring-2 ring-pine" : "")}
            >
              {dia}
            </button>
          );
        })}
      </div>
      <div className="mt-3 flex flex-col gap-1 text-xs text-muted">
        <p className="flex items-center gap-2">
          <span className="size-3 rounded bg-pine" /> Feriado
        </p>
        <p className="flex items-center gap-2">
          <span className="size-3 rounded bg-pine-soft ring-1 ring-pine" /> Ponto facultativo e recesso
        </p>
      </div>
      {aberto && (
        <p className="mt-3 text-justify text-sm leading-relaxed text-ink">
          {aberto.nome} · {aberto.tipo === "feriado" ? "Feriado" : aberto.tipo === "facultativo" ? "Ponto facultativo" : "Recesso"}
          {aberto.municipio ? ` · ${aberto.municipio}` : ""}
        </p>
      )}
      {doMes.length > 0 && (
        <ul className="mt-3 flex flex-col gap-1">
          {doMes.map((dia) => (
            <li key={dia.data} className="text-xs text-muted">
              {dia.data.slice(8, 10)}/{dia.data.slice(5, 7)} · {dia.nome}
            </li>
          ))}
        </ul>
      )}
    </section>
    <CalculadoraAbaixo equipeId={equipeId} />
    </>
  );
}
