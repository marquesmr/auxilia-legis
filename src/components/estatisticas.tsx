import { classeResposta, rotuloRetorno, TIPOS_LEI, type Processo, urgencia } from "@/lib/prazos";
import { encerraStatus } from "@/lib/status-catalogo";

const ORDEM_TIPO = ["Requerimentos", "Indicações", "Projetos de Lei", "Outros"] as const;

const CORES_TIPO = ["var(--color-pine)", "var(--color-brass)", "var(--color-seal)", "var(--color-muted)"];

const CORES_RETORNO = [
  "var(--color-muted)",
  "var(--color-seal)",
  "var(--color-brass)",
  "var(--color-pine)",
  "color-mix(in srgb, var(--color-pine) 55%, var(--color-ink))",
  "color-mix(in srgb, var(--color-brass) 55%, var(--color-ink))",
  "color-mix(in srgb, var(--color-seal) 55%, var(--color-ink))",
];

export function PainelEstatisticas({ processos, className }: { processos: Processo[]; className?: string }) {
  const porTipo = ORDEM_TIPO.map((tipo) => ({
    tipo,
    n: processos.filter((p) => p.tipo === tipo).length,
  }));
  const situacao = [
    { label: "Vencidos", n: processos.filter((p) => urgencia(p) === "vencido").length, cor: "var(--color-seal)" },
    { label: "Vencem hoje", n: processos.filter((p) => urgencia(p) === "hoje").length, cor: "var(--color-seal)" },
    { label: "Vencendo", n: processos.filter((p) => urgencia(p) === "proximo").length, cor: "var(--color-brass)" },
    { label: "No prazo", n: processos.filter((p) => urgencia(p) === "ok").length, cor: "var(--color-pine)" },
    { label: "Arquivados", n: processos.filter((p) => encerraStatus("legislativo", p.status)).length, cor: "var(--color-muted)" },
  ];
  const retornos = processos.filter((p) => p.retorno);
  const labelsRetorno = [
    "Veto integral",
    "Veto parcial",
    ...TIPOS_LEI.map((tipo) => `Sancionada · ${tipo}`),
  ];
  for (const item of retornos) {
    const rotulo = rotuloRetorno(item);
    if (!labelsRetorno.includes(rotulo)) labelsRetorno.push(rotulo);
  }
  const fatiasRetorno = labelsRetorno.map((label, i) => ({
    label,
    n: retornos.filter((p) => rotuloRetorno(p) === label).length,
    cor: CORES_RETORNO[(i + 1) % CORES_RETORNO.length],
  }));
  const resposta = [
    { label: "Respondido no prazo", id: "no-prazo" as const, cor: "var(--color-pine)" },
    { label: "Não respondido no prazo", id: "fora" as const, cor: "var(--color-seal)" },
    { label: "Ainda no prazo", id: "aguardando" as const, cor: "var(--color-brass)" },
  ].map((item) => ({ ...item, n: processos.filter((p) => classeResposta(p) === item.id).length }));
  const total = processos.length;
  const abertos = processos.filter((p) => !encerraStatus("legislativo", p.status)).length;

  if (total === 0) {
    return (
      <div className="mt-4 rounded-2xl border border-dashed border-line bg-sheet px-6 py-12 text-center">
        <p className="font-display text-2xl text-ink">Ainda sem números</p>
        <p className="mx-auto mt-2 max-w-sm text-sm text-muted">
          Lance um processo para ver a distribuição por tipo e por prazo.
        </p>
      </div>
    );
  }

  return (
    <div className={className ?? "mt-4 grid gap-4 lg:grid-cols-2"}>
      <section className="rounded-2xl border border-line bg-sheet p-4">
        <h2 className="font-display text-2xl text-ink">Situação</h2>
        <p className="mt-1 text-sm text-muted">
          {abertos} em aberto de {total}
        </p>
        <Donut fatias={situacao} total={total} />
        <ul className="mt-2 flex flex-col gap-2">
          {situacao.map((item) => (
            <li key={item.label} className="flex items-center justify-between gap-3 text-sm">
              <span className="flex items-center gap-2 text-ink">
                <span className="size-2.5 rounded-full" style={{ background: item.cor }} />
                {item.label}
              </span>
              <span className="font-medium text-ink">{item.n}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-2xl border border-line bg-sheet p-4">
        <h2 className="font-display text-2xl text-ink">Por tipo</h2>
        <Donut
          fatias={porTipo.map((item, i) => ({ label: item.tipo, n: item.n, cor: CORES_TIPO[i] }))}
          total={total}
        />
        <ul className="mt-2 flex flex-col gap-2">
          {porTipo.map((item, i) => (
            <li key={item.tipo} className="flex items-center justify-between gap-3 text-sm">
              <span className="flex items-center gap-2 text-ink">
                <span className="size-2.5 rounded-full" style={{ background: CORES_TIPO[i] }} />
                {item.tipo}
              </span>
              <span className="font-medium text-ink">{item.n}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-2xl border border-line bg-sheet p-4">
        <h2 className="font-display text-2xl text-ink">Retorno do andamento</h2>
        <p className="mt-1 text-sm text-muted">Veto integral, veto parcial ou sanção, pelo tipo de lei.</p>
        {retornos.length === 0 ? (
          <p className="mt-4 text-sm text-muted">Nenhum processo retornou do andamento ainda.</p>
        ) : (
          <>
            <Donut fatias={fatiasRetorno} total={retornos.length} centro="retornos" />
            <ul className="mt-2 flex flex-col gap-2">
              {fatiasRetorno.filter((item) => item.n > 0).map((item) => (
                <li key={item.label} className="flex items-center justify-between gap-3 text-sm">
                  <span className="flex items-center gap-2 text-ink">
                    <span className="size-2.5 shrink-0 rounded-full" style={{ background: item.cor }} />
                    {item.label}
                  </span>
                  <span className="font-medium text-ink">{item.n}</span>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      <section className="rounded-2xl border border-line bg-sheet p-4">
        <h2 className="font-display text-2xl text-ink">Resposta ao prazo</h2>
        <p className="mt-1 text-sm text-muted">Respondidos no prazo, fora dele, ou ainda dentro do prazo.</p>
        <Donut fatias={resposta} total={total} />
        <ul className="mt-2 flex flex-col gap-2">
          {resposta.map((item) => (
            <li key={item.label} className="flex items-center justify-between gap-3 text-sm">
              <span className="flex items-center gap-2 text-ink">
                <span className="size-2.5 shrink-0 rounded-full" style={{ background: item.cor }} />
                {item.label}
              </span>
              <span className="font-medium text-ink">{item.n}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function Donut({
  fatias,
  total,
  centro = "processos",
}: {
  fatias: { label: string; n: number; cor: string }[];
  total: number;
  centro?: string;
}) {
  const r = 46;
  const c = 2 * Math.PI * r;
  let offset = 0;
  const usadas = fatias.filter((f) => f.n > 0);
  return (
    <svg viewBox="0 0 140 140" className="mx-auto mt-2 size-40" role="img" aria-label={`${total} processos no gráfico`}>
      <circle cx="70" cy="70" r={r} fill="none" stroke="var(--color-line)" strokeWidth="16" />
      {usadas.map((fatia) => {
        const len = (fatia.n / total) * c;
        const el = (
          <circle
            key={fatia.label}
            cx="70"
            cy="70"
            r={r}
            fill="none"
            stroke={fatia.cor}
            strokeWidth="16"
            strokeLinecap="round"
            strokeDasharray={`${len} ${c - len}`}
            strokeDashoffset={-offset}
            transform="rotate(-90 70 70)"
          />
        );
        offset += len;
        return el;
      })}
      <text x="70" y="66" textAnchor="middle" fill="var(--color-ink)" fontSize="28" fontFamily="Fraunces, Georgia, serif">
        {total}
      </text>
      <text x="70" y="84" textAnchor="middle" fill="var(--color-muted)" fontSize="11" fontFamily="Outfit, sans-serif">
        {centro}
      </text>
    </svg>
  );
}
