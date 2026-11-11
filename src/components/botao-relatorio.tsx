import { useState } from "react";
import { createPortal } from "react-dom";
import { Printer, Share2 } from "lucide-react";

function ehMovel() {
  return window.matchMedia("(max-width: 767px)").matches;
}

function cssDeImpressao() {
  let impressao = "";
  const visitar = (regras: CSSRuleList) => {
    for (const regra of Array.from(regras)) {
      if (regra instanceof CSSMediaRule && /\bprint\b/.test(regra.conditionText || "")) {
        impressao += Array.from(regra.cssRules).map((item) => item.cssText).join("\n") + "\n";
        continue;
      }
      if ("cssRules" in regra && !(regra instanceof CSSStyleRule)) visitar((regra as CSSGroupingRule).cssRules);
    }
  };
  for (const folha of Array.from(document.styleSheets)) {
    try {
      visitar(folha.cssRules);
    } catch {
      /* folha de outro site */
    }
  }
  return impressao;
}

const LARGURA = 794;
const ALTURA = 1122;

function criarPagina() {
  const pagina = document.createElement("section");
  pagina.className = "relatorio-folha pdf-captura";
  pagina.style.cssText = `width:${LARGURA}px;max-width:${LARGURA}px;box-sizing:border-box;background:#fff;`;
  return pagina;
}

function montarTabela(original: HTMLTableElement, cabeca: Element | null) {
  const caixa = document.createElement("div");
  caixa.className = "relatorio-tabela-wrap";
  const tabela = document.createElement("table");
  tabela.className = original.className;
  if (cabeca) tabela.appendChild(cabeca.cloneNode(true));
  const corpo = document.createElement("tbody");
  tabela.appendChild(corpo);
  caixa.appendChild(tabela);
  return { caixa, corpo };
}

function fatiarTabela(paginas: HTMLElement[], bloco: HTMLElement) {
  const tabela = bloco.querySelector("table");
  const corpo = tabela?.querySelector("tbody");
  if (!tabela || !corpo) return;
  const cabeca = tabela.querySelector("thead");
  const linhas = Array.from(corpo.querySelectorAll("tr"));
  bloco.remove();
  let pagina = paginas[paginas.length - 1];
  if (!pagina.childElementCount && paginas.length > 1) {
    pagina.remove();
    paginas.pop();
    pagina = paginas[paginas.length - 1];
  }
  let atual = montarTabela(tabela, cabeca);
  pagina.appendChild(atual.caixa);
  for (const linha of linhas) {
    atual.corpo.appendChild(linha);
    if (pagina.scrollHeight > ALTURA && atual.corpo.rows.length > 1) {
      atual.corpo.removeChild(linha);
      pagina = criarPagina();
      paginas.push(pagina);
      document.body.appendChild(pagina);
      atual = montarTabela(tabela, cabeca);
      pagina.appendChild(atual.caixa);
      atual.corpo.appendChild(linha);
    }
  }
}

function encaixar(paginas: HTMLElement[], no: Element) {
  let pagina = paginas[paginas.length - 1];
  pagina.appendChild(no);
  if (pagina.scrollHeight <= ALTURA) return;
  if (pagina.childElementCount > 1) {
    pagina.removeChild(no);
    pagina = criarPagina();
    paginas.push(pagina);
    document.body.appendChild(pagina);
    pagina.appendChild(no);
    if (pagina.scrollHeight <= ALTURA) return;
  }
  if (no.querySelectorAll("tbody tr").length > 1) fatiarTabela(paginas, no as HTMLElement);
}

async function pdfDaImpressao(artigo: HTMLElement) {
  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([import("html2canvas-pro"), import("jspdf")]);
  const copia = artigo.cloneNode(true) as HTMLElement;
  copia.querySelectorAll(".no-print").forEach((item) => item.remove());
  const estilo = document.createElement("style");
  estilo.textContent = `${cssDeImpressao().replace(/body\.imprimindo\s*>\s*:not\(\.relatorio-folha\)\s*\{[^}]*\}/g, "")}
    body.imprimindo > .pdf-captura { display:block !important; width:${LARGURA}px !important; max-width:${LARGURA}px !important; }`;
  const paginas: HTMLElement[] = [];
  document.head.appendChild(estilo);
  document.body.classList.add("imprimindo");
  try {
    const primeira = criarPagina();
    paginas.push(primeira);
    document.body.appendChild(primeira);
    for (const no of Array.from(copia.children)) encaixar(paginas, no);
    if (document.fonts) await document.fonts.ready;
    await new Promise((resolver) => requestAnimationFrame(() => requestAnimationFrame(() => resolver(null))));
    const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
    const visiveis = paginas.filter((pagina) => pagina.childElementCount > 0);
    if (!visiveis.length) throw new Error("Relatório vazio.");
    for (let indice = 0; indice < visiveis.length; indice += 1) {
      const pagina = visiveis[indice];
      const quadro = await html2canvas(pagina, {
        scale: 1,
        backgroundColor: "#ffffff",
        width: LARGURA,
        windowWidth: LARGURA,
        logging: false,
        useCORS: true,
      });
      if (indice > 0) pdf.addPage();
      const alturaMm = Math.min(297, (quadro.height / quadro.width) * 210);
      pdf.addImage(quadro.toDataURL("image/jpeg", 0.86), "JPEG", 0, 0, 210, alturaMm);
    }
    return new Blob([pdf.output("arraybuffer")], { type: "application/pdf" });
  } finally {
    paginas.forEach((pagina) => pagina.remove());
    estilo.remove();
    document.body.classList.remove("imprimindo");
  }
}

function imprimirRelatorio(alvo: HTMLElement) {
  const artigo = alvo.closest("article");
  if (!artigo) {
    window.print();
    return;
  }
  const marca = document.createElement("span");
  artigo.before(marca);
  document.body.appendChild(artigo);
  document.body.classList.add("imprimindo");
  const titulo = document.title;
  document.title = "\u00a0";
  const voltar = () => {
    document.title = titulo;
    marca.replaceWith(artigo);
    document.body.classList.remove("imprimindo");
  };
  window.addEventListener("afterprint", voltar, { once: true });
  window.print();
}

function baixarPdf(blob: Blob) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "Auxilia Legis.pdf";
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

function abrirPdf(blob: Blob) {
  const url = URL.createObjectURL(blob);
  const aberto = window.open(url, "_blank");
  if (!aberto) {
    const link = document.createElement("a");
    link.href = url;
    link.target = "_blank";
    link.rel = "noopener";
    document.body.appendChild(link);
    link.click();
    link.remove();
  }
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

export function BotaoRelatorio({ rotulo }: { rotulo?: string } = {}) {
  const [ocupado, setOcupado] = useState(false);
  const [pdf, setPdf] = useState<Blob | null>(null);
  const [aviso, setAviso] = useState("");

  function compartilharAgora() {
    if (!pdf) return;
    const arquivo = new File([pdf], "Auxilia Legis.pdf", { type: "application/pdf" });
    if (typeof navigator.share !== "function" || pdf.size < 100) {
      if (pdf.size >= 100) abrirPdf(pdf);
      setAviso(pdf.size < 100 ? "Não consegui montar o PDF neste aparelho." : "Abri o PDF. Use o botão de compartilhar do visualizador.");
      return;
    }
    void navigator.share({ files: [arquivo], title: "Auxilia Legis" }).catch((erro: unknown) => {
      if (erro instanceof DOMException && erro.name === "AbortError") return;
      abrirPdf(pdf);
      setAviso("Abri o PDF. Use o botão de compartilhar do visualizador.");
    });
  }

  return (
    <>
      <button
        type="button"
        disabled={ocupado}
        onClick={(evento) => {
          const artigo = evento.currentTarget.closest("article");
          if (ehMovel() && artigo) {
            setOcupado(true);
            setPdf(null);
            setAviso("");
            void pdfDaImpressao(artigo)
              .then((blob) => setPdf(blob))
              .catch(() => setAviso("Não consegui montar o PDF neste aparelho."))
              .finally(() => setOcupado(false));
            return;
          }
          imprimirRelatorio(evento.currentTarget);
        }}
        className="no-print inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-line px-4 text-sm font-medium text-ink disabled:opacity-60 sm:w-auto"
      >
        <Printer className={rotulo ? "size-4" : "hidden size-4 md:block"} />
        {rotulo ? null : <Share2 className="size-4 md:hidden" />}
        <span className={rotulo ? undefined : "hidden md:inline"}>{rotulo && ocupado ? "Gerando…" : rotulo ?? "Imprimir ou salvar PDF"}</span>
        {rotulo ? null : <span className="md:hidden">{ocupado ? "Gerando PDF…" : "Compartilhar como"}</span>}
      </button>
      {(pdf || aviso) &&
        createPortal(
          <div className="fixed inset-0 z-[80] flex items-end justify-center bg-ink/40 p-4 sm:items-center" role="dialog" aria-modal="true">
            <div className="w-full max-w-sm rounded-2xl border border-line bg-sheet p-4">
              <p className="font-medium text-ink">Auxilia Legis.pdf</p>
              <p className="mt-1 text-sm text-muted">Toque em compartilhar para abrir as opções do aparelho.</p>
              {aviso && <p className="mt-2 text-sm text-brass">{aviso}</p>}
              <div className="mt-4 flex flex-col gap-2">
              {pdf && pdf.size > 100 && (
                <>
                  <button
                    type="button"
                    onClick={compartilharAgora}
                    className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-pine text-sm font-medium text-sheet"
                  >
                    <Share2 className="size-4" />
                    Compartilhar
                  </button>
                  <button
                    type="button"
                    onClick={() => baixarPdf(pdf)}
                    className="inline-flex h-11 items-center justify-center rounded-xl border border-line text-sm font-medium text-ink"
                  >
                    Salvar no aparelho
                  </button>
                </>
              )}
                <button type="button" onClick={() => { setPdf(null); setAviso(""); }} className="h-11 text-sm text-muted">
                  Fechar
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
