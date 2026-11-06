import { useState } from "react";

const PASSOS = [
  {
    titulo: "Bem-vindo ao Auxilia Legis",
    texto:
      "Este é o assistente do Poder Legislativo. O essencial cabe em poucos passos: onde entrar, como lançar um processo, como acompanhar o prazo e onde pedir ajuda.",
  },
  {
    titulo: "Dois módulos",
    texto:
      "Há duas áreas. Processos Legislativos reúne requerimento, indicação, projeto de lei e os demais. Processos Administrativo reúne as contratações, da dispensa ao encerramento. O botão Módulos troca de área quando você quiser.",
  },
  {
    titulo: "Lançar um processo",
    texto:
      "No legislativo, Novo processo pede número, parte, assunto e prazo. No administrativo, o lançamento pede a modalidade, o número do processo, o status e a data da etapa. Doação e Outros pedem menos campos. O que for obrigatório o sistema não deixa em branco.",
  },
  {
    titulo: "Cards, andamento e prazo",
    texto:
      "Cada processo vira um card. Andamento registra o que aconteceu sem apagar o histórico. Detalhes abre o resumo. Prazo vencido e o que está perto da data sobem nos avisos. No administrativo, a antecedência do aviso é escolhida no lançamento.",
  },
  {
    titulo: "Equipe",
    texto:
      "Quem está na mesma equipe vê a mesma lista. Para passar um processo, use Mover ou arraste o card até a equipe. Adicionar pessoa pede o nome e o e-mail. O convite chega por e-mail e vale 24 horas.",
  },
  {
    titulo: "Lexis, calendário e a lei",
    texto:
      "A Lexis, no canto da tela, responde dúvidas sobre o sistema e usa o seu nome. O calendário marca feriado e ponto facultativo. No administrativo, a aba Lei de Licitações traz a Lei 14.133 para consulta por artigo ou termo.",
  },
  {
    titulo: "Pode começar",
    texto:
      "Perfil muda o nome e a senha. Configurações muda o tema, a cor e em qual módulo a conta abre. Este aviso aparece só neste primeiro acesso. Quando fechar, ele não volta.",
  },
];

export function TutorialInicio({
  nome,
  aberto,
  onFechar,
}: {
  nome: string;
  aberto: boolean;
  onFechar: () => void;
}) {
  const [passo, setPasso] = useState(0);
  if (!aberto) return null;
  const atual = PASSOS[passo];
  const ultimo = passo === PASSOS.length - 1;
  const primeiro = nome.trim().split(/\s+/)[0] || "você";

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 p-4 sm:items-center">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="tutorial-titulo"
        className="w-full max-w-lg rounded-2xl border border-line bg-sheet p-5 shadow-lg"
      >
        <p className="text-xs font-medium text-muted">
          Primeiro acesso · {passo + 1} de {PASSOS.length}
        </p>
        <div className="mt-3 h-1 overflow-hidden rounded-full bg-paper">
          <div className="h-full rounded-full bg-pine" style={{ width: `${((passo + 1) / PASSOS.length) * 100}%` }} />
        </div>
        <h2 id="tutorial-titulo" className="mt-4 font-display text-2xl text-ink">
          {passo === 0 ? `Olá, ${primeiro}` : atual.titulo}
        </h2>
        {passo === 0 && <p className="mt-1 text-sm font-medium text-pine">{atual.titulo}</p>}
        <p className="mt-3 text-justify text-sm leading-relaxed text-ink">{atual.texto}</p>
        <div className="mt-5 flex items-center justify-between gap-3">
          <button type="button" onClick={onFechar} className="text-sm font-medium text-muted">
            Pular
          </button>
          <div className="flex gap-2">
            {passo > 0 && (
              <button
                type="button"
                onClick={() => setPasso((valor) => valor - 1)}
                className="h-11 rounded-xl border border-line bg-sheet px-4 text-sm font-medium text-ink"
              >
                Anterior
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                if (ultimo) onFechar();
                else setPasso((valor) => valor + 1);
              }}
              className="h-11 rounded-xl bg-pine px-4 text-sm font-medium text-sheet"
            >
              {ultimo ? "Começar" : "Próximo"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
