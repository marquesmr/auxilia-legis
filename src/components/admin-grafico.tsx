import { useState } from "react";
import { formatarReais, MODALIDADES, rotuloNumero, statusAdminLabel, type ProcessoAdmin } from "@/lib/admin";
import { caminhoPizza, corGrafico } from "@/lib/cores-grafico";
import { listaCodigos } from "@/lib/status-catalogo";

type Vista = "situacao" | "tipo" | "anual" | "mensal" | "valorTipo";
type Fatia = { label: string; valor: number; texto: string };

const VISTAS: { id: Vista; label: string }[] = [
  { id: "situacao", label: "Situação" },
  { id: "tipo", label: "Por tipo" },
  { id: "anual", label: "Valor anual" },
  { id: "mensal", label: "Valor mensal" },
  { id: "valorTipo", label: "Valor por tipo" },
];

export function GraficoAdmin({ processos }: { processos: ProcessoAdmin[] }) {
  const [vista, setVista] = useState<Vista>("situacao");
  const total = processos.length;
  if (total === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-line bg-sheet px-6 py-12 text-center">
        <p className="font-display text-2xl text-ink">Ainda sem números</p>
        <p className="mx-auto mt-2 max-w-sm text-sm text-muted">Lance um processo administrativo para ver a estatística.</p>
      </div>
    );
  }

  return (
    <section className="rounded-2xl border border-line bg-sheet p-4 md:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="font-display text-2xl text-ink">{VISTAS.find((item) => item.id === vista)?.label}</h2>
          <p className="mt-1 text-sm text-muted">{total} {total === 1 ? "processo" : "processos"}</p>
        </div>
        <div className="no-print flex flex-wrap gap-2" role="tablist" aria-label="Visão da estatística">
          {VISTAS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setVista(item.id)}
              className={
                "h-9 rounded-full px-3 text-sm font-medium " +
                (vista === item.id ? "bg-ink text-sheet" : "border border-line text-ink")
              }
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>
      <div className="mt-4">
        {vista === "situacao" && <VistaSituacao processos={processos} />}
        {vista === "tipo" && <VistaTipo processos={processos} />}
        {vista === "anual" && <VistaValores processos={processos} mensal={false} />}
        {vista === "mensal" && <VistaValores processos={processos} mensal />}
        {vista === "valorTipo" && <VistaValorTipo processos={processos} />}
      </div>
    </section>
  );
}

function VistaSituacao({ processos }: { processos: ProcessoAdmin[] }) {
  const fatias = listaCodigos("administrativo").map((status) => {
    const n = processos.filter((p) => p.status === status).length;
    return { label: statusAdminLabel(status), valor: n, texto: String(n) };
  }).filter((item) => item.valor > 0);
  return <Rosca fatias={fatias} centro={String(processos.length)} legenda="processos" />;
}

function VistaTipo({ processos }: { processos: ProcessoAdmin[] }) {
  const fatias = MODALIDADES.map((tipo) => {
    const n = processos.filter((p) => p.tipo === tipo).length;
    return { label: tipo, valor: n, texto: String(n) };
  }).filter((item) => item.valor > 0);
  return <Rosca fatias={fatias} centro={String(processos.length)} legenda="processos" />;
}

function rotuloProcesso(p: ProcessoAdmin): string {
  const numero = p.numero ? rotuloNumero(p.numero, p.numeroAno) : "";
  const referencia = p.referencia.trim();
  if (numero && referencia) return `${numero} · ${referencia}`;
  return numero || referencia || p.tipo;
}

function valorAnualOuEstimado(p: ProcessoAdmin): { valor: number; texto: string } {
  if ((p.valorTotalCentavos ?? 0) > 0) return { valor: p.valorTotalCentavos ?? 0, texto: formatarReais(p.valorTotalCentavos) };
  if ((p.valorEstimadoCentavos ?? 0) > 0) return { valor: p.valorEstimadoCentavos ?? 0, texto: `${formatarReais(p.valorEstimadoCentavos)} estimado` };
  return { valor: 0, texto: formatarReais(null) };
}
function VistaValores({ processos, mensal }: { processos: ProcessoAdmin[]; mensal: boolean }) {
  const fatias = processos
    .map((p) => {
      const anual = valorAnualOuEstimado(p);
      const valor = mensal ? (p.valorMensalCentavos ?? 0) : anual.valor;
      const texto = mensal ? formatarReais(p.valorMensalCentavos) : anual.texto;
      return { label: rotuloProcesso(p), valor, texto };
    })
    .filter((item) => item.valor > 0)
    .sort((a, b) => b.valor - a.valor);
  const soma = fatias.reduce((total, item) => total + item.valor, 0);
  if (fatias.length === 0) return <p className="text-sm text-muted">Nenhum valor lançado neste recorte.</p>;
  return <Rosca fatias={fatias} centro={formatarReais(soma)} legenda={mensal ? "mensal" : "anual"} />;
}

function VistaValorTipo({ processos }: { processos: ProcessoAdmin[] }) {
  const fatias = MODALIDADES.map((tipo) => {
    const valor = processos.filter((p) => p.tipo === tipo).reduce((soma, p) => soma + valorAnualOuEstimado(p).valor, 0);
    return { label: tipo, valor, texto: formatarReais(valor) };
  }).filter((item) => item.valor > 0);
  const soma = fatias.reduce((total, item) => total + item.valor, 0);
  if (fatias.length === 0) return <p className="text-sm text-muted">Nenhum valor lançado neste recorte.</p>;
  return <Rosca fatias={fatias} centro={formatarReais(soma)} legenda="por tipo" />;
}

function Rosca({ fatias, centro, legenda }: { fatias: Fatia[]; centro: string; legenda: string }) {
  const pintadas = fatias.map((item, indice) => ({ ...item, cor: corGrafico(indice) }));
  return (
    <div className="grid items-center gap-6 md:grid-cols-[15rem_1fr]">
      <Donut fatias={pintadas} centro={centro} legenda={legenda} />
      <ul className="flex flex-col gap-2">
        {pintadas.map((item) => (
          <li key={item.label} className="flex items-start justify-between gap-3 text-sm">
            <span className="flex min-w-0 items-start gap-2 text-ink">
              <span className="mt-1.5 size-2.5 shrink-0 rounded-full" style={{ background: item.cor }} />
              <span className="break-words">{item.label}</span>
            </span>
            <span className="shrink-0 font-medium text-ink">{item.texto}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Donut({ fatias, centro, legenda }: { fatias: (Fatia & { cor: string })[]; centro: string; legenda: string }) {
  const total = fatias.reduce((soma, item) => soma + item.valor, 0);
  let angulo = -90;
  const miudo = centro.length > 14;
  return (
    <div className="mx-auto w-full max-w-52">
      <svg viewBox="0 0 160 160" className="mx-auto size-44 max-w-full sm:size-52" role="img" aria-label={legenda}>
        {fatias.map((fatia) => {
          const fim = angulo + (total > 0 ? (fatia.valor / total) * 360 : 0);
          const caminho = caminhoPizza(80, 80, 72, angulo, fim);
          angulo = fim;
          return <path key={fatia.label} d={caminho} fill={fatia.cor} stroke="var(--color-sheet)" strokeWidth="1" />;
        })}
      </svg>
      <p className="mt-1 text-center">
        <span className={"block font-display leading-tight text-ink " + (miudo ? "text-sm" : "text-xl")}>{centro}</span>
        <span className="text-xs text-muted">{legenda}</span>
      </p>
    </div>
  );
}
