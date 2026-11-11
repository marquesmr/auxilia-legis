import JSZip from "jszip";
import { jsPDF } from "jspdf";
import type { BlocoTermo, ParteTermo } from "@/lib/termo-docx";

const margem = 30;
const largura = 210;
const altura = 297;
const util = largura - margem * 2;
const recuoMm = 12.5;
const linhaMm = 5;
const azul: [number, number, number] = [31, 56, 100];

function depoisDoBloco(bloco: BlocoTermo) {
  if (bloco.titulo) return 9.2;
  if (bloco.junto) return 0;
  return 4.2;
}

async function timbreDoArquivo(arquivo: string) {
  const base64 = arquivo.includes(",") ? arquivo.slice(arquivo.indexOf(",") + 1) : arquivo;
  const zip = await JSZip.loadAsync(base64, { base64: true });
  const linhas: string[] = [];
  const imagens: string[] = [];
  const vistas = new Set<string>();
  const cabecalhos = Object.keys(zip.files).filter((nome) => /word\/header\d+\.xml$/.test(nome));
  for (const nome of cabecalhos) {
    const xml = await zip.file(nome)?.async("string");
    if (xml) {
      for (const parte of xml.split(/<w:p[ >]/).slice(1)) {
        const texto = [...parte.matchAll(/<w:t[^>]*>([^<]*)<\/w:t>/g)]
          .map((item) => item[1].replace(/&/g, "&").replace(/</g, "<").replace(/>/g, ">"))
          .join("")
          .replace(/\s+/g, " ")
          .trim();
        if (texto) linhas.push(texto);
      }
    }
    const rels = await zip.file(nome.replace("word/", "word/_rels/") + ".rels")?.async("string");
    if (!rels) continue;
    for (const alvo of rels.matchAll(/Target="([^"]+\.png)"/gi)) {
      const caminho = `word/${alvo[1].replace(/^\//, "").replace(/^word\//, "")}`;
      const arquivoImagem = zip.file(caminho);
      if (!arquivoImagem) continue;
      const dados = await arquivoImagem.async("base64");
      if (vistas.has(dados)) continue;
      vistas.add(dados);
      imagens.push(dados);
    }
  }
  const rodape: string[] = [];
  for (const nome of Object.keys(zip.files).filter((item) => /word\/footer\d+\.xml$/.test(item))) {
    const xml = await zip.file(nome)?.async("string");
    if (!xml) continue;
    for (const parte of xml.split(/<w:p[ >]/).slice(1)) {
      const texto = [...parte.matchAll(/<w:t[^>]*>([^<]*)<\/w:t>/g)]
        .map((item) => item[1].replace(/&/g, "&").replace(/</g, "<").replace(/>/g, ">"))
        .join("")
        .replace(/\s+/g, " ")
        .trim();
      if (texto) rodape.push(texto);
    }
  }
  return { imagens, linhas, rodape };
}

function palavras(partes: ParteTermo[], forcarNegrito: boolean) {
  const lista: { texto: string; negrito: boolean }[] = [];
  for (const parte of partes) {
    const negrito = forcarNegrito || Boolean(parte.negrito);
    for (const token of parte.texto.split(/(\s+)/)) {
      if (!token || /^\s+$/.test(token)) continue;
      lista.push({ texto: token, negrito });
    }
  }
  return lista;
}

function desenharLinha(
  pdf: jsPDF,
  itens: { texto: string; negrito: boolean }[],
  x: number,
  y: number,
  larguraLinha: number,
  justificar: boolean,
) {
  const larguras = itens.map((item) => {
    pdf.setFont("helvetica", item.negrito ? "bold" : "normal");
    return pdf.getTextWidth(item.texto);
  });
  const ocupado = larguras.reduce((soma, valor) => soma + valor, 0);
  const espacos = Math.max(itens.length - 1, 1);
  const extra = justificar && itens.length > 1 ? Math.max(0, larguraLinha - ocupado) / espacos : 0;
  const espacoBase = justificar ? 0 : pdf.getTextWidth(" ");
  let cursor = x;
  itens.forEach((item, indice) => {
    pdf.setFont("helvetica", item.negrito ? "bold" : "normal");
    pdf.text(item.texto, cursor, y);
    cursor += larguras[indice] + (indice < itens.length - 1 ? (justificar ? extra : espacoBase) : 0);
  });
}

function desenharBloco(pdf: jsPDF, bloco: BlocoTermo, y: number) {
  const itens = palavras(bloco.partes, Boolean(bloco.titulo));
  if (!itens.length) return y;
  pdf.setFontSize(12);
  pdf.setTextColor(17, 17, 17);
  y += bloco.antes ? 14.8 : 0;
  if (bloco.centro || bloco.titulo) {
    const texto = itens.map((item) => item.texto).join(" ");
    pdf.setFont("helvetica", bloco.titulo || bloco.partes.some((parte) => parte.negrito) ? "bold" : "normal");
    const larguraTexto = pdf.getTextWidth(texto);
    pdf.text(texto, (largura - larguraTexto) / 2, y);
    return y + linhaMm + depoisDoBloco(bloco);
  }
  const linhas: { texto: string; negrito: boolean }[][] = [];
  let atual: { texto: string; negrito: boolean }[] = [];
  let usado = 0;
  const limiteInicial = util - (bloco.recuo ? recuoMm : 0);
  let limite = limiteInicial;
  for (const item of itens) {
    pdf.setFont("helvetica", item.negrito ? "bold" : "normal");
    const medida = pdf.getTextWidth(item.texto);
    const espaco = atual.length ? pdf.getTextWidth(" ") : 0;
    if (atual.length && usado + espaco + medida > limite) {
      linhas.push(atual);
      atual = [item];
      usado = medida;
      limite = util;
      continue;
    }
    atual.push(item);
    usado += espaco + medida;
  }
  if (atual.length) linhas.push(atual);
  linhas.forEach((linha, indice) => {
    const primeira = indice === 0 && bloco.recuo;
    const ultima = indice === linhas.length - 1;
    desenharLinha(pdf, linha, margem + (primeira ? recuoMm : 0), y, primeira ? limiteInicial : util, Boolean(bloco.recuo) && !ultima);
    y += linhaMm;
  });
  return y + depoisDoBloco(bloco);
}

export async function pdfDoTermo(entrada: { arquivo?: string; imagem?: string; cabecalho: string[]; rodape: string[]; blocos: BlocoTermo[] }) {
  const timbre = entrada.arquivo ? await timbreDoArquivo(entrada.arquivo) : { imagens: [] as string[], linhas: entrada.cabecalho, rodape: entrada.rodape };
  const pdf = new jsPDF({ unit: "mm", format: "a4" });
  pdf.setFont("helvetica", "normal");
  let y = 16;
  const imagem = timbre.imagens[0] ?? (entrada.imagem?.startsWith("data:image/png") ? entrada.imagem.split(",")[1] : "");
  if (imagem) {
    pdf.addImage(imagem, "PNG", (largura - 16) / 2, y, 16, 21);
    y += 24;
  }
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(12);
  pdf.setTextColor(...azul);
  for (const linha of timbre.linhas.length ? timbre.linhas : entrada.cabecalho) {
    const larguraTexto = pdf.getTextWidth(linha);
    pdf.text(linha, (largura - larguraTexto) / 2, y);
    y += 5;
  }
  y += 2;
  pdf.setDrawColor(...azul);
  pdf.setLineWidth(0.4);
  pdf.line(margem, y, largura - margem, y);
  y += 10;
  for (const bloco of entrada.blocos) {
    if (y > altura - 28) {
      pdf.addPage();
      y = 20;
    }
    y = desenharBloco(pdf, bloco, y);
  }
  const rodape = timbre.rodape.length ? timbre.rodape : entrada.rodape;
  let yRodape = altura - 18;
  pdf.setDrawColor(...azul);
  pdf.line(margem, yRodape, largura - margem, yRodape);
  yRodape += 5;
  pdf.setFontSize(9);
  pdf.setTextColor(...azul);
  for (const linha of rodape) {
    pdf.setFont("helvetica", "normal");
    const larguraTexto = pdf.getTextWidth(linha);
    pdf.text(linha, (largura - larguraTexto) / 2, yRodape);
    yRodape += 4;
  }
  pdf.autoPrint();
  return pdf.output("blob");
}

export async function pdfDoDocx(arquivo: Blob) {
  const [{ renderAsync }, { default: html2canvas }, { jsPDF }] = await Promise.all([
    import("docx-preview"),
    import("html2canvas-pro"),
    import("jspdf"),
  ]);
  const host = document.createElement("div");
  host.style.cssText = "position:absolute;left:0;top:0;width:900px;background:#fff;z-index:-1;pointer-events:none;";
  document.body.appendChild(host);
  try {
    await renderAsync(arquivo, host, host, {
      inWrapper: true,
      breakPages: true,
      renderHeaders: true,
      renderFooters: true,
      useBase64URL: true,
      ignoreLastRenderedPageBreak: true,
    });
    if (document.fonts) await document.fonts.ready;
    const imagens = [...host.querySelectorAll("img")];
    await Promise.all(imagens.map((imagem) => (imagem.complete ? null : new Promise((resolver) => {
      imagem.onload = () => resolver(null);
      imagem.onerror = () => resolver(null);
    }))));
    const secoes = [...host.querySelectorAll("section.docx")] as HTMLElement[];
    if (!secoes.length || !host.innerText.trim()) throw new Error("Não foi possível montar o PDF a partir do timbrado.");
    const pdf = new jsPDF({ unit: "mm", format: "a4" });
    for (let indice = 0; indice < secoes.length; indice += 1) {
      const quadro = await html2canvas(secoes[indice], { scale: 2, backgroundColor: "#ffffff", useCORS: true });
      if (indice > 0) pdf.addPage();
      pdf.addImage(quadro.toDataURL("image/jpeg", 0.95), "JPEG", 0, 0, 210, 297);
    }
    pdf.autoPrint();
    return pdf.output("blob");
  } finally {
    host.remove();
  }
}
