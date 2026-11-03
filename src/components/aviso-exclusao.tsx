import { useRef, useState } from "react";
import { motivoExclusao } from "@/lib/motivos-exclusao";

export function AvisoContaExcluida({ motivo, onEntendi }: { motivo: string; onEntendi: () => void }) {
  const [mais, setMais] = useState(false);
  const [tentativas, setTentativas] = useState(0);
  const encerrou = useRef(false);
  const contagem = useRef(0);
  const item = motivoExclusao(motivo);

  function encerrar() {
    if (encerrou.current) return;
    encerrou.current = true;
    onEntendi();
  }

  function tentarSair() {
    if (encerrou.current) return;
    contagem.current += 1;
    setTentativas(contagem.current);
    if (contagem.current >= 5) encerrar();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 px-4" onClick={tentarSair}>
      <div
        className="w-full max-w-md rounded-2xl border border-line bg-sheet p-5"
        onClick={(evento) => {
          evento.stopPropagation();
          tentarSair();
        }}
      >
        <h2 className="font-display text-3xl text-ink">Conta excluída</h2>
        <p className="mt-2 text-justify text-sm leading-relaxed text-ink">Sua conta foi excluída porque você infringiu as diretrizes do sistema.</p>
        <p className="mt-2 text-justify text-sm leading-relaxed text-muted">{item ? item.resumo : "O motivo fica registrado na exclusão."}</p>
        {mais && (
          <div className="mt-3 rounded-xl bg-paper p-3" onClick={(evento) => evento.stopPropagation()}>
            <p className="text-sm font-medium text-ink">{item?.titulo ?? "Motivo"}</p>
            <p className="mt-1 text-justify text-sm leading-relaxed text-ink">{item?.fundamento ?? "A exclusão segue as diretrizes de uso do sistema."}</p>
          </div>
        )}
        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={(evento) => {
              evento.stopPropagation();
              encerrar();
            }}
            className="inline-flex h-11 flex-1 items-center justify-center rounded-xl bg-pine text-sm font-medium text-sheet"
          >
            ENTENDI
          </button>
          <button
            type="button"
            onClick={(evento) => {
              evento.stopPropagation();
              setMais((aberto) => !aberto);
            }}
            className="inline-flex h-11 flex-1 items-center justify-center rounded-xl border border-line text-sm font-medium text-ink"
          >
            Saiba mais
          </button>
        </div>
        <p className="mt-2 text-center text-xs text-muted">
          Tentativas de sair: {Math.min(tentativas, 5)} de 5. Na quinta, vale como entendi.
        </p>
      </div>
    </div>
  );
}
