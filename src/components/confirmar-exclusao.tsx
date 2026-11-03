import { useState } from "react";
import { createPortal } from "react-dom";

export function useConfirmarExclusao() {
  const [pendente, setPendente] = useState<{ texto: string; agir: () => void } | null>(null);

  function pedir(texto: string, agir: () => void) {
    setPendente({ texto, agir });
  }

  const dialogo =
    pendente && typeof document !== "undefined"
      ? createPortal(
          <div className="fixed inset-0 z-[90] grid place-items-center bg-ink/40 px-4" role="alertdialog" aria-modal="true">
            <div className="w-full max-w-sm rounded-2xl border border-line bg-sheet p-5 shadow-lg">
              <p className="font-display text-2xl text-ink">Excluir?</p>
              <p className="mt-2 text-sm leading-relaxed text-ink">{pendente.texto}</p>
              <div className="mt-4 flex gap-2">
                <button
                  type="button"
                  onClick={() => setPendente(null)}
                  className="inline-flex h-11 flex-1 items-center justify-center rounded-xl border border-line text-sm font-medium text-ink"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const agir = pendente.agir;
                    setPendente(null);
                    agir();
                  }}
                  className="inline-flex h-11 flex-1 items-center justify-center rounded-xl bg-ink text-sm font-medium text-sheet"
                >
                  Excluir
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )
      : null;

  return { pedir, dialogo };
}
