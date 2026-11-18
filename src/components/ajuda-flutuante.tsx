import { useEffect, useRef, useState, type FormEvent, type PointerEvent as ReactPointerEvent } from "react";
import { perguntarAjuda } from "@/lib/ajuda.functions";
import { ExternalLink, MessageCircle, Send, StickyNote, X } from "lucide-react";

type Mensagem = { de: "pessoa" | "ajuda"; texto: string };

const SUGESTOES = ["Oi, o que você faz?", "Como lanço um prazo?", "E a equipe?", "Me explica o relatório"];
const CHAVE_NOTAS = "auxilia-notas";
const CHAVE_NOTAS_TAMANHO = "auxilia-notas-tamanho";
const CANAL_NOTAS = "auxilia-notas";
const NOTA_LARGURA = 352;
const NOTA_ALTURA = 292;

function limitar(valor: number, minimo: number, maximo: number) {
  return Math.round(Math.min(maximo, Math.max(minimo, valor)));
}

function lerTamanho() {
  if (typeof window === "undefined") return { largura: NOTA_LARGURA, altura: NOTA_ALTURA };
  try {
    const bruto = sessionStorage.getItem(CHAVE_NOTAS_TAMANHO);
    if (!bruto) return { largura: NOTA_LARGURA, altura: NOTA_ALTURA };
    const lido = JSON.parse(bruto) as { largura?: unknown; altura?: unknown };
    const largura = typeof lido.largura === "number" ? lido.largura : NOTA_LARGURA;
    const altura = typeof lido.altura === "number" ? lido.altura : NOTA_ALTURA;
    return {
      largura: limitar(largura, 260, window.innerWidth - 32),
      altura: limitar(altura, 200, window.innerHeight - 120),
    };
  } catch {
    return { largura: NOTA_LARGURA, altura: NOTA_ALTURA };
  }
}

function lerNota() {
  if (typeof window === "undefined") return "";
  try {
    return sessionStorage.getItem(CHAVE_NOTAS) ?? "";
  } catch {
    return "";
  }
}

function corTema(nome: string, padrao: string) {
  return getComputedStyle(document.documentElement).getPropertyValue(nome).trim() || padrao;
}

function pintarJanela(janela: Window, texto: string) {
  const sheet = corTema("--color-sheet", "#fffdf8");
  const ink = corTema("--color-ink", "#1b1915");
  const paper = corTema("--color-paper", "#f3efe6");
  const line = corTema("--color-line", "#e3dcd0");
  const muted = corTema("--color-muted", "#6d665c");
  janela.document.open();
  janela.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>Notas</title><style>
    html,body{margin:0;height:100%;background:${sheet};color:${ink};font-family:Outfit,ui-sans-serif,system-ui,sans-serif}
    body{display:flex;flex-direction:column}
    header{padding:12px 14px;border-bottom:1px solid ${line}}
    p{margin:0;font-size:14px;font-weight:600}
    small{color:${muted};font-size:12px}
    textarea{flex:1;margin:12px;border:1px solid ${line};border-radius:12px;background:${paper};color:${ink};padding:10px 12px;font:inherit;resize:none}
  </style></head><body>
    <header><p>Notas</p><small>Arraste esta janela. Ela continua se o sistema for minimizado.</small></header>
    <textarea id="nota" spellcheck="true" lang="pt-BR" placeholder="Anota aqui."></textarea>
    <script>
      const campo = document.getElementById("nota");
      campo.value = ${JSON.stringify(texto).replace(/</g, "\\u003c")};
      const canal = new BroadcastChannel(${JSON.stringify(CANAL_NOTAS)});
      campo.addEventListener("input", () => {
        const valor = campo.value.slice(0, 4000);
        if (valor !== campo.value) campo.value = valor;
        canal.postMessage({ texto: valor, origem: "janela" });
      });
      canal.onmessage = (evento) => {
        const dados = evento.data || {};
        if (dados.fechar) { window.close(); return; }
        if (dados.origem !== "app" || typeof dados.texto !== "string" || dados.texto === campo.value) return;
        campo.value = dados.texto;
      };
      window.addEventListener("pagehide", () => {
        canal.postMessage({ origem: "janela", fechou: true });
        canal.close();
      });
    <\/script>
  </body></html>`);
  janela.document.close();
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
  const [medida, setMedida] = useState({ largura: NOTA_LARGURA, altura: NOTA_ALTURA });
  const [posicao, setPosicao] = useState<{ x: number; y: number } | null>(null);
  const [fora, setFora] = useState(false);
  const notaPronta = useRef(false);
  const tamanhoPronto = useRef(false);
  const notaAtual = useRef("");
  const arraste = useRef<{ x: number; y: number; largura: number; altura: number; esquerda: number; topo: number } | null>(null);
  const mover = useRef<{ x: number; y: number; esquerda: number; topo: number } | null>(null);
  const painelNota = useRef<HTMLElement>(null);
  const janelaNota = useRef<Window | null>(null);
  const canalNota = useRef<BroadcastChannel | null>(null);
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
    const salva = lerNota();
    notaAtual.current = salva;
    setNota(salva);
    setMedida(lerTamanho());
    tamanhoPronto.current = true;
  }, []);

  useEffect(() => {
    const canal = new BroadcastChannel(CANAL_NOTAS);
    canalNota.current = canal;
    canal.onmessage = (evento) => {
      const dados = evento.data as { texto?: unknown; origem?: unknown; fechou?: unknown };
      if (dados.origem === "janela" && dados.fechou) {
        janelaNota.current = null;
        setFora(false);
      }
      if (dados.origem === "janela" && typeof dados.texto === "string" && dados.texto !== notaAtual.current) {
        setNota(dados.texto.slice(0, 4000));
      }
    };
    return () => {
      canal.close();
      canalNota.current = null;
    };
  }, []);

  useEffect(() => {
    if (!tamanhoPronto.current) return;
    try {
      sessionStorage.setItem(CHAVE_NOTAS_TAMANHO, JSON.stringify(medida));
    } catch {
      /* o tamanho volta ao padrão */
    }
  }, [medida]);

  useEffect(() => {
    if (!notaPronta.current) {
      if (nota === notaAtual.current) notaPronta.current = true;
      return;
    }
    notaAtual.current = nota;
    try {
      sessionStorage.setItem(CHAVE_NOTAS, nota);
    } catch {
      /* o recado fica só nesta visita */
    }
    canalNota.current?.postMessage({ texto: nota, origem: "app" });
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

  function aoRedimensionar(evento: ReactPointerEvent<HTMLButtonElement>) {
    if (evento.type === "pointerdown") {
      evento.preventDefault();
      evento.currentTarget.setPointerCapture(evento.pointerId);
      const quadro = painelNota.current?.getBoundingClientRect();
      arraste.current = {
        x: evento.clientX,
        y: evento.clientY,
        largura: medida.largura,
        altura: medida.altura,
        esquerda: quadro?.left ?? posicao?.x ?? 0,
        topo: quadro?.top ?? posicao?.y ?? 0,
      };
      return;
    }
    const inicio = arraste.current;
    if (!inicio) return;
    if (evento.type === "pointerup" || evento.type === "pointercancel") {
      arraste.current = null;
      return;
    }
    setMedida({
      largura: limitar(inicio.largura + inicio.x - evento.clientX, 260, window.innerWidth - 32),
      altura: limitar(inicio.altura + inicio.y - evento.clientY, 200, window.innerHeight - 120),
    });
    if (posicao) {
      setPosicao({
        x: inicio.esquerda + evento.clientX - inicio.x,
        y: inicio.topo + evento.clientY - inicio.y,
      });
    }
  }

  function ponteiroFora(evento: ReactPointerEvent) {
    return evento.clientX < 0 || evento.clientY < 0 || evento.clientX > window.innerWidth || evento.clientY > window.innerHeight;
  }

  function assumirJanela(janela: Window) {
    pintarJanela(janela, notaAtual.current);
    janelaNota.current = janela;
    setFora(true);
    setNotasAbertas(false);
    setPosicao(null);
  }

  function abrirPopup() {
    const aberta = janelaNota.current;
    if (aberta && !aberta.closed) {
      aberta.focus();
      setFora(true);
      setNotasAbertas(false);
      return;
    }
    const largura = limitar(medida.largura, 260, 1200);
    const altura = limitar(medida.altura, 200, 900);
    const janela = window.open("", "auxilia-notas", `popup=yes,width=${largura},height=${altura}`);
    if (!janela) return;
    assumirJanela(janela);
  }

  async function soltarNota() {
    const aberta = janelaNota.current;
    if (aberta && !aberta.closed) {
      aberta.focus();
      setFora(true);
      setNotasAbertas(false);
      return;
    }
    const largura = limitar(medida.largura, 260, 1200);
    const altura = limitar(medida.altura, 200, 900);
    const pip = (window as Window & { documentPictureInPicture?: { requestWindow: (opcoes: { width: number; height: number }) => Promise<Window> } }).documentPictureInPicture;
    if (pip) {
      try {
        assumirJanela(await pip.requestWindow({ width: largura, height: altura }));
        return;
      } catch {
        return;
      }
    }
    abrirPopup();
  }

  function aoMover(evento: ReactPointerEvent<HTMLDivElement>) {
    if (evento.type === "pointerdown") {
      if ((evento.target as HTMLElement).closest("button")) return;
      evento.preventDefault();
      const quadro = painelNota.current?.getBoundingClientRect();
      if (!quadro) return;
      evento.currentTarget.setPointerCapture(evento.pointerId);
      mover.current = { x: evento.clientX, y: evento.clientY, esquerda: quadro.left, topo: quadro.top };
      setPosicao({ x: quadro.left, y: quadro.top });
      return;
    }
    const inicio = mover.current;
    if (!inicio) return;
    if (evento.type === "pointerup" || evento.type === "pointercancel") {
      mover.current = null;
      if (ponteiroFora(evento)) abrirPopup();
      return;
    }
    setPosicao({
      x: inicio.esquerda + evento.clientX - inicio.x,
      y: inicio.topo + evento.clientY - inicio.y,
    });
    if (ponteiroFora(evento)) {
      mover.current = null;
      abrirPopup();
    }
  }

  return (
    <div className="no-print fixed bottom-4 right-4 z-30 flex flex-col items-end gap-2">
      {notasAbertas && (
        <section
          ref={painelNota}
          className="relative flex max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-2xl border border-line bg-sheet shadow-lg"
          style={{
            width: medida.largura,
            height: medida.altura,
            ...(posicao ? { position: "fixed", left: posicao.x, top: posicao.y, zIndex: 40 } : {}),
          }}
          aria-label="Notas temporárias"
        >
          <button
            type="button"
            aria-label="Redimensionar notas"
            onPointerDown={aoRedimensionar}
            onPointerMove={aoRedimensionar}
            onPointerUp={aoRedimensionar}
            onPointerCancel={aoRedimensionar}
            className="absolute left-1.5 top-1.5 z-10 grid size-7 cursor-nw-resize touch-none place-items-center text-muted"
          >
            <span className="block size-3 border-l-2 border-t-2 border-current" />
          </button>
          <div
            className="flex cursor-grab touch-none items-center justify-between gap-3 border-b border-line py-3 pl-9 pr-2 active:cursor-grabbing"
            onPointerDown={aoMover}
            onPointerMove={aoMover}
            onPointerUp={aoMover}
            onPointerCancel={aoMover}
          >
            <div>
              <p className="text-sm font-medium text-ink">Notas</p>
              <p className="text-xs text-muted">Arraste para fora para soltar</p>
            </div>
            <div className="flex items-center">
              <button type="button" onClick={() => void soltarNota()} className="grid size-9 place-items-center rounded-lg text-muted" aria-label="Abrir as notas em outra janela" title="Abrir em outra janela">
                <ExternalLink className="size-4" />
              </button>
              <button type="button" onClick={() => setNotasAbertas(false)} className="grid size-9 place-items-center rounded-lg text-muted" aria-label="Fechar as notas">
                <X className="size-4" />
              </button>
            </div>
          </div>
          <textarea
            value={nota}
            onChange={(evento) => setNota(evento.target.value.slice(0, 4000))}
            placeholder="Anota aqui. Recarregar a página não apaga."
            className="m-3 min-h-0 flex-1 resize-none rounded-xl border border-line bg-paper px-3 py-2 text-sm text-ink"
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
          const aberta = janelaNota.current;
          if (fora && aberta && !aberta.closed) {
            aberta.focus();
            return;
          }
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
