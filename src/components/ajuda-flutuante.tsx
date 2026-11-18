import { useEffect, useRef, useState, type FormEvent } from "react";
import { perguntarAjuda } from "@/lib/ajuda.functions";
import { MessageCircle, Send, StickyNote, X } from "lucide-react";

type Mensagem = { de: "pessoa" | "ajuda"; texto: string };

const SUGESTOES = ["Oi, o que você faz?", "Como lanço um prazo?", "E a equipe?", "Me explica o relatório"];
const CHAVE_NOTAS = "auxilia-notas";

function lerNota() {
  if (typeof window === "undefined") return "";
  try {
    return sessionStorage.getItem(CHAVE_NOTAS) ?? "";
  } catch {
    return "";
  }
}

function primeiroNome(nome: string) {
  const limpo = nome.trim();
  if (!limpo || limpo.toLowerCase() === "sem nome") return "";
  return limpo.split(/\s+/)[0] ?? "";
}

function TextoAjuda({ texto }: { texto: string }) {
  const partes = texto.split(/(\*\*[\s\S]+?\*\*)/g);
  return partes.map((parte, indice) => {
    if (parte.startsWith("**") && parte.endsWith("**") && parte.length > 4) {
      return (
        <span key={indice} className="text-pine">
          {parte.slice(2, -2)}
        </span>
      );
    }
    return <span key={indice}>{parte}</span>;
  });
}

export function AjudaFlutuante({ nome, area }: { nome: string; area: "legislativo" | "administrativo" }) {
  const pessoa = primeiroNome(nome);
  const [aberto, setAberto] = useState(false);
  const [notasAbertas, setNotasAbertas] = useState(false);
  const [nota, setNota] = useState("");
  const notaPronta = useRef(false);
  const [texto, setTexto] = useState("");
  const [digitando, setDigitando] = useState(false);
  const fim = useRef<HTMLDivElement>(null);
  const [mensagens, setMensagens] = useState<Mensagem[]>(() => [
    {
      de: "ajuda",
      texto: pessoa
        ? `Oi, ${pessoa}. Eu sou a Lexis. Pergunta qualquer coisa do sistema, do jeito que vier na cabeça.`
        : "Oi. Eu sou a Lexis. Pergunta qualquer coisa do sistema, do jeito que vier na cabeça.",
    },
  ]);

  useEffect(() => {
    setNota(lerNota());
    notaPronta.current = true;
  }, []);

  useEffect(() => {
    if (!notaPronta.current) return;
    try {
      sessionStorage.setItem(CHAVE_NOTAS, nota);
    } catch {
      /* o recado fica só nesta visita */
    }
  }, [nota]);

  useEffect(() => {
    fim.current?.scrollIntoView({ block: "end" });
  }, [mensagens, digitando, aberto]);

  async function enviar(valor: string) {
    const pergunta = valor.trim();
    if (!pergunta || digitando) return;
    const historico = mensagens.slice(-8).map((item) => ({
      papel: item.de === "pessoa" ? ("user" as const) : ("assistant" as const),
      texto: item.texto,
    }));
    setMensagens((lista) => [...lista, { de: "pessoa", texto: pergunta }]);
    setTexto("");
    setDigitando(true);
    let textoResposta = pessoa
      ? `${pessoa}, não consegui responder agora. Pergunta de novo daqui a pouco.`
      : "Não consegui responder agora. Pergunta de novo daqui a pouco.";
    try {
      const vinda = await perguntarAjuda({ data: { pergunta, area, nome, historico } });
      if (vinda.texto) textoResposta = vinda.texto;
    } catch {
      /* a frase de falha já está pronta */
    }
    setMensagens((lista) => [...lista, { de: "ajuda", texto: textoResposta }]);
    setDigitando(false);
  }

  function aoEnviar(evento: FormEvent) {
    evento.preventDefault();
    void enviar(texto);
  }

  return (
    <div className="no-print fixed bottom-4 right-4 z-30 flex flex-col items-end gap-2">
      {notasAbertas && (
        <section className="flex w-[min(22rem,calc(100vw-2rem))] flex-col overflow-hidden rounded-2xl border border-line bg-sheet shadow-lg" aria-label="Notas temporárias">
          <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
            <div>
              <p className="text-sm font-medium text-ink">Notas</p>
              <p className="text-xs text-muted">Somem ao sair da conta</p>
            </div>
            <button type="button" onClick={() => setNotasAbertas(false)} className="grid size-9 place-items-center rounded-lg text-muted" aria-label="Fechar as notas">
              <X className="size-4" />
            </button>
          </div>
          <textarea
            value={nota}
            onChange={(evento) => setNota(evento.target.value.slice(0, 4000))}
            placeholder="Anota aqui. Recarregar a página não apaga."
            className="m-3 h-48 resize-none rounded-xl border border-line bg-paper px-3 py-2 text-sm text-ink"
            spellCheck
            lang="pt-BR"
          />
        </section>
      )}
      {aberto && (
        <section
          className="flex h-[min(32rem,calc(100vh-6rem))] w-[min(22rem,calc(100vw-2rem))] flex-col overflow-hidden rounded-2xl border border-line bg-sheet shadow-lg"
          aria-label="Lexis"
        >
          <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
            <div>
              <p className="text-sm font-medium text-ink">Lexis</p>
              <p className="text-xs text-muted">{digitando ? "Digitando…" : pessoa ? `Para ${pessoa}` : "Sobre o sistema"}</p>
            </div>
            <button
              type="button"
              onClick={() => setAberto(false)}
              className="grid size-9 place-items-center rounded-lg text-muted"
              aria-label="Fechar a Lexis"
            >
              <X className="size-4" />
            </button>
          </div>
          <div className="flex flex-1 flex-col gap-2 overflow-y-auto px-3 py-3">
            {mensagens.map((mensagem, indice) => (
              <p
                key={indice}
                className={
                  "max-w-[92%] rounded-2xl px-3 py-2 text-sm leading-relaxed " +
                  (mensagem.de === "pessoa" ? "ml-auto bg-pine text-sheet" : "bg-paper text-ink")
                }
              >
                {mensagem.de === "ajuda" ? <TextoAjuda texto={mensagem.texto} /> : mensagem.texto}
              </p>
            ))}
            {digitando && (
              <p className="flex h-9 w-16 items-center gap-1 rounded-2xl bg-paper px-3" aria-label="Digitando">
                <i className="size-1.5 animate-bounce rounded-full bg-muted [animation-delay:0ms]" />
                <i className="size-1.5 animate-bounce rounded-full bg-muted [animation-delay:150ms]" />
                <i className="size-1.5 animate-bounce rounded-full bg-muted [animation-delay:300ms]" />
              </p>
            )}
            <div ref={fim} />
          </div>
          <div className="flex flex-wrap gap-1.5 px-3 pb-2">
            {SUGESTOES.map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => void enviar(item)}
                disabled={digitando}
                className="rounded-full border border-line px-2.5 py-1 text-xs text-ink disabled:opacity-50"
              >
                {item}
              </button>
            ))}
          </div>
          <form onSubmit={aoEnviar} className="flex gap-2 border-t border-line p-3">
            <input
              value={texto}
              onChange={(evento) => setTexto(evento.target.value)}
              placeholder={pessoa ? `Pergunte, ${pessoa}` : "Pergunte sobre o sistema"}
              className="h-11 min-w-0 flex-1 rounded-xl border border-line bg-paper px-3 text-sm text-ink"
              spellCheck
              lang="pt-BR"
              disabled={digitando}
            />
            <button
              type="submit"
              disabled={digitando}
              className="grid size-11 shrink-0 place-items-center rounded-xl bg-pine text-sheet disabled:opacity-50"
              aria-label="Enviar pergunta"
            >
              <Send className="size-4" />
            </button>
          </form>
        </section>
      )}
      <button
        type="button"
        onClick={() => {
          setNotasAbertas((valor) => !valor);
          setAberto(false);
        }}
        className="grid size-14 place-items-center rounded-full border border-line bg-sheet text-ink shadow-lg"
        aria-label={notasAbertas ? "Fechar as notas" : "Abrir as notas"}
        aria-expanded={notasAbertas}
      >
        {notasAbertas ? <X className="size-5" /> : <StickyNote className="size-6" />}
      </button>
      <button
        type="button"
        onClick={() => {
          setAberto((valor) => !valor);
          setNotasAbertas(false);
        }}
        className="grid size-14 place-items-center rounded-full bg-pine text-sheet shadow-lg"
        aria-label={aberto ? "Fechar a Lexis" : "Abrir a Lexis"}
        aria-expanded={aberto}
      >
        {aberto ? <X className="size-5" /> : <MessageCircle className="size-6" />}
      </button>
    </div>
  );
}
