import { useEffect, useRef, useState } from "react";

const MESES = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

export function CampoMes({ value, onChange }: { value: string; onChange: (valor: string) => void }) {
  const [aberto, setAberto] = useState(false);
  const raiz = useRef<HTMLDivElement>(null);
  const [anoTexto, mesTexto] = value.split("-");
  const ano = Number(anoTexto);
  const mes = Number(mesTexto);
  const anoAtual = Number.isFinite(ano) ? ano : new Date().getFullYear();
  const [anoVista, setAnoVista] = useState(anoAtual);

  useEffect(() => {
    if (!aberto) return;
    setAnoVista(anoAtual);
    function fechar(evento: MouseEvent) {
      if (!raiz.current?.contains(evento.target as Node)) setAberto(false);
    }
    function tecla(evento: KeyboardEvent) {
      if (evento.key === "Escape") setAberto(false);
    }
    document.addEventListener("mousedown", fechar);
    document.addEventListener("keydown", tecla);
    return () => {
      document.removeEventListener("mousedown", fechar);
      document.removeEventListener("keydown", tecla);
    };
  }, [aberto, anoAtual]);

  return (
    <div ref={raiz} className={"relative " + (aberto ? "z-30" : "")}>
      <button
        type="button"
        onClick={() => setAberto((atual) => !atual)}
        aria-label="Mês de referência"
        aria-expanded={aberto}
        className="flex h-11 w-full items-center rounded-xl border border-line bg-paper px-3 text-left text-sm text-ink"
      >
        {rotuloMes(value)}
      </button>
      {aberto ? (
        <div className="absolute top-12 left-0 z-30 w-64 rounded-xl border border-line bg-sheet p-3 shadow-lg">
          <div className="mb-2 flex items-center justify-between">
            <button type="button" onClick={() => setAnoVista((atual) => atual - 1)} className="grid size-8 place-items-center rounded-lg text-ink" aria-label="Ano anterior">
              ‹
            </button>
            <span className="text-sm font-medium text-ink">{anoVista}</span>
            <button type="button" onClick={() => setAnoVista((atual) => atual + 1)} className="grid size-8 place-items-center rounded-lg text-ink" aria-label="Próximo ano">
              ›
            </button>
          </div>
          <div className="grid grid-cols-3 gap-1">
            {MESES.map((nome, indice) => {
              const escolhido = anoVista === ano && indice + 1 === mes;
              return (
                <button
                  key={nome}
                  type="button"
                  onClick={() => {
                    onChange(`${anoVista}-${String(indice + 1).padStart(2, "0")}`);
                    setAberto(false);
                  }}
                  className={"h-9 rounded-lg text-sm " + (escolhido ? "bg-ink font-medium text-sheet" : "text-ink hover:bg-paper")}
                >
                  {nome.slice(0, 3)}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function rotuloMes(valor: string) {
  const [ano, mes] = valor.split("-");
  const data = new Date(Number(ano), Number(mes) - 1, 1);
  if (!ano || !mes || Number.isNaN(data.getTime())) return "Escolher mês";
  return data.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
}
