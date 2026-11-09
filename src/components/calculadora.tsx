import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Calculator, X } from "lucide-react";

type Operacao = "+" | "−" | "×" | "÷";

function lerNumero(texto: string) {
  const valor = Number(texto.replace(/\./g, "").replace(",", "."));
  return Number.isFinite(valor) ? valor : 0;
}

function mostrarNumero(valor: number) {
  if (!Number.isFinite(valor)) return "Erro";
  const texto = String(Math.round(valor * 1e10) / 1e10);
  return texto.replace(".", ",");
}

export function CalculadoraAbaixo() {
  const [aberta, setAberta] = useState(false);
  return (
    <>
      <div className="mt-2 flex justify-end">
        <button
          type="button"
          onClick={() => setAberta(true)}
          className="grid size-11 place-items-center rounded-xl border border-line bg-sheet text-ink"
          aria-label="Abrir calculadora"
        >
          <Calculator className="size-5" />
        </button>
      </div>
      {aberta ? <JanelaCalculadora onFechar={() => setAberta(false)} /> : null}
    </>
  );
}

function JanelaCalculadora({ onFechar }: { onFechar: () => void }) {
  const [pronta, setPronta] = useState(false);
  const [pos, setPos] = useState({ x: 16, y: 16 });
  const [tela, setTela] = useState("0");
  const [acumulado, setAcumulado] = useState<number | null>(null);
  const [operacao, setOperacao] = useState<Operacao | null>(null);
  const [substituir, setSubstituir] = useState(false);
  const arraste = useRef<{ dx: number; dy: number } | null>(null);

  useEffect(() => {
    const largura = 280;
    setPos({
      x: Math.max(12, window.innerWidth - largura - 16),
      y: Math.max(12, Math.round(window.innerHeight * 0.18)),
    });
    setPronta(true);
  }, []);

  function calcular(esquerda: number, sinal: Operacao, direita: number) {
    if (sinal === "+") return esquerda + direita;
    if (sinal === "−") return esquerda - direita;
    if (sinal === "×") return esquerda * direita;
    return direita === 0 ? Number.NaN : esquerda / direita;
  }

  function apertar(tecla: string) {
    if (tecla === "C") {
      setTela("0");
      setAcumulado(null);
      setOperacao(null);
      setSubstituir(false);
      return;
    }
    if (tecla === "⌫") {
      setTela((atual) => (atual.length <= 1 || atual === "Erro" ? "0" : atual.slice(0, -1)));
      setSubstituir(false);
      return;
    }
    if (tecla === "%") {
      setTela(mostrarNumero(lerNumero(tela) / 100));
      setSubstituir(true);
      return;
    }
    if (tecla === ",") {
      setTela((atual) => (substituir || atual === "Erro" ? "0," : atual.includes(",") ? atual : `${atual},`));
      setSubstituir(false);
      return;
    }
    if (/^\d$/.test(tecla)) {
      setTela((atual) => {
        if (substituir || atual === "0" || atual === "Erro") return tecla;
        if (atual.replace(/\D/g, "").length >= 12) return atual;
        return atual + tecla;
      });
      setSubstituir(false);
      return;
    }
    const atual = lerNumero(tela);
    const resultado = acumulado != null && operacao && !substituir ? calcular(acumulado, operacao, atual) : atual;
    setTela(mostrarNumero(resultado));
    if (tecla === "=") {
      setAcumulado(null);
      setOperacao(null);
    } else {
      setAcumulado(Number.isFinite(resultado) ? resultado : null);
      setOperacao(tecla as Operacao);
    }
    setSubstituir(true);
  }

  if (!pronta) return null;
  return createPortal(
    <div
      role="dialog"
      aria-label="Calculadora"
      className="no-print fixed z-[80] w-[17.5rem] rounded-2xl border border-line bg-sheet shadow-lg"
      style={{ left: pos.x, top: pos.y }}
    >
      <div
        className="flex cursor-grab touch-none items-center justify-between gap-2 rounded-t-2xl border-b border-line px-3 py-2 active:cursor-grabbing"
        onPointerDown={(evento) => {
          if ((evento.target as HTMLElement).closest("button")) return;
          arraste.current = { dx: evento.clientX - pos.x, dy: evento.clientY - pos.y };
          evento.currentTarget.setPointerCapture(evento.pointerId);
        }}
        onPointerMove={(evento) => {
          if (!arraste.current) return;
          const largura = 280;
          setPos({
            x: Math.min(window.innerWidth - 48, Math.max(48 - largura, evento.clientX - arraste.current.dx)),
            y: Math.min(window.innerHeight - 48, Math.max(0, evento.clientY - arraste.current.dy)),
          });
        }}
        onPointerUp={() => {
          arraste.current = null;
        }}
      >
        <p className="text-sm font-medium text-ink">Calculadora</p>
        <button type="button" onClick={onFechar} className="grid size-8 place-items-center rounded-lg text-muted" aria-label="Fechar calculadora">
          <X className="size-4" />
        </button>
      </div>
      <div className="px-3 pt-3">
        <p className="min-h-12 break-all text-right font-display text-3xl leading-tight text-ink">{tela}</p>
      </div>
      <div className="grid grid-cols-4 gap-2 p-3">
        {["C", "⌫", "%", "÷", "7", "8", "9", "×", "4", "5", "6", "−", "1", "2", "3", "+", "0", ",", "="].map((tecla) => (
          <button
            key={tecla}
            type="button"
            onClick={() => apertar(tecla)}
            className={
              "grid h-12 place-items-center rounded-xl text-base font-medium " +
              (tecla === "="
                ? "col-span-2 bg-pine text-sheet"
                : tecla === "+" || tecla === "−" || tecla === "×" || tecla === "÷"
                  ? "bg-pine-soft text-pine"
                  : "border border-line bg-paper text-ink")
            }
          >
            {tecla}
          </button>
        ))}
      </div>
    </div>,
    document.body,
  );
}
