import JSZip from "jszip";

export type ParteTermo = { texto: string; negrito?: boolean };
export type BlocoTermo = {
  partes: ParteTermo[];
  centro?: boolean;
  titulo?: boolean;
  recuo?: boolean;
  junto?: boolean;
  antes?: boolean;
};

function escaparXml(texto: string) {
  return texto.replace(/&/g, "&").replace(/</g, "<").replace(/>/g, ">");
}

function blocoXml(bloco: BlocoTermo) {
  const tamanho = 24;
  const alinhamento = bloco.centro || bloco.titulo ? "center" : bloco.recuo ? "both" : "left";
  const recuo = bloco.recuo ? `<w:ind w:firstLine="709"/>` : "";
  const antes = bloco.antes ? "840" : "0";
  const depois = bloco.titulo ? "520" : bloco.junto ? "0" : "240";
  const runs = bloco.partes
    .map((parte) => {
      const negrito = parte.negrito || bloco.titulo ? "<w:b/>" : "";
      return `<w:r><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/>${negrito}<w:sz w:val="${tamanho}"/><w:szCs w:val="${tamanho}"/></w:rPr><w:t xml:space="preserve">${escaparXml(parte.texto)}</w:t></w:r>`;
    })
    .join("");
  return `<w:p><w:pPr><w:jc w:val="${alinhamento}"/>${recuo}<w:spacing w:before="${antes}" w:beforeAutospacing="0" w:after="${depois}" w:afterAutospacing="0" w:line="240" w:lineRule="auto"/><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:sz w:val="${tamanho}"/><w:szCs w:val="${tamanho}"/></w:rPr></w:pPr>${runs}</w:p>`;
}

function textoDoParagrafo(xml: string) {
  return [...xml.matchAll(/<w:t[^>]*>([^<]*)<\/w:t>/g)]
    .map((item) => item[1].replace(/&/g, "&").replace(/</g, "<").replace(/>/g, ">"))
    .join("")
    .replace(/\s+/g, " ")
    .trim();
}

export async function cidadeDoTimbrado(arquivo: string) {
  const base64 = arquivo.includes(",") ? arquivo.slice(arquivo.indexOf(",") + 1) : arquivo;
  const zip = await JSZip.loadAsync(base64, { base64: true });
  const nomes = Object.keys(zip.files).filter((nome) => /word\/header\d+\.xml$/.test(nome));
  const linhas: string[] = [];
  for (const nome of nomes) {
    const xml = await zip.file(nome)?.async("string");
    if (!xml) continue;
    for (const parte of xml.split(/<w:p[ >]/).slice(1)) {
      const texto = textoDoParagrafo(parte);
      if (texto) linhas.push(texto);
    }
  }
  const ultima = linhas.at(-1) ?? "";
  if (ultima && !/c[aâ]mara municipal/i.test(ultima)) return ultima;
  const junta = linhas.join(" ");
  return junta.match(/\bde\s+([^,]+)$/i)?.[1]?.trim() ?? "";
}

function linhasXml(xml: string) {
  const linhas: string[] = [];
  for (const parte of xml.split(/<w:p[ >]/).slice(1)) {
    const texto = textoDoParagrafo(parte);
    if (texto) linhas.push(texto);
  }
  return linhas;
}

async function imagensDaParte(zip: JSZip, rels: string) {
  const xml = await zip.file(rels)?.async("string");
  if (!xml) return [];
  const vistas = new Set<string>();
  const saida: string[] = [];
  for (const alvo of xml.matchAll(/Target="([^"]+\.(?:png|jpe?g|gif))"/gi)) {
    const relativo = alvo[1].replace(/^\//, "");
    const caminho = relativo.startsWith("word/") ? relativo : `word/${relativo}`;
    const arquivo = zip.file(caminho);
    if (!arquivo) continue;
    const base64 = await arquivo.async("base64");
    if (vistas.has(base64)) continue;
    vistas.add(base64);
    const ext = caminho.split(".").pop()?.toLowerCase();
    const mime = ext === "png" ? "image/png" : ext === "gif" ? "image/gif" : "image/jpeg";
    saida.push(`data:${mime};base64,${base64}`);
  }
  return saida;
}

export async function molduraDoTimbrado(arquivo: string) {
  const base64 = arquivo.includes(",") ? arquivo.slice(arquivo.indexOf(",") + 1) : arquivo;
  const zip = await JSZip.loadAsync(base64, { base64: true });
  const cabecalhos = Object.keys(zip.files).filter((nome) => /word\/header\d+\.xml$/.test(nome)).sort();
  const rodapes = Object.keys(zip.files).filter((nome) => /word\/footer\d+\.xml$/.test(nome)).sort();
  const linhas: string[] = [];
  const imagens: string[] = [];
  for (const nome of cabecalhos) {
    const xml = await zip.file(nome)?.async("string");
    if (xml) linhas.push(...linhasXml(xml));
    imagens.push(...(await imagensDaParte(zip, nome.replace("word/", "word/_rels/") + ".rels")));
  }
  const rodape: string[] = [];
  for (const nome of rodapes) {
    const xml = await zip.file(nome)?.async("string");
    if (xml) rodape.push(...linhasXml(xml));
  }
  return { imagens, linhas, rodape };
}

export async function termoNoTimbrado(arquivo: string, blocos: BlocoTermo[]) {
  const base64 = arquivo.includes(",") ? arquivo.slice(arquivo.indexOf(",") + 1) : arquivo;
  const zip = await JSZip.loadAsync(base64, { base64: true });
  const documento = zip.file("word/document.xml");
  if (!documento) throw new Error("Esse Word não tem o texto do documento.");
  const xml = await documento.async("string");
  const inicio = xml.indexOf("<w:body");
  const abre = xml.indexOf(">", inicio);
  const fecha = xml.lastIndexOf("</w:body>");
  if (inicio < 0 || abre < 0 || fecha < 0) throw new Error("Não foi possível ler o timbrado.");
  const corpo = xml.slice(abre + 1, fecha);
  const secaoEm = corpo.lastIndexOf("<w:sectPr");
  const secao = secaoEm >= 0 ? corpo.slice(secaoEm) : "";
  const novo = `${xml.slice(0, abre + 1)}${blocos.map(blocoXml).join("")}${secao}</w:body>${xml.slice(fecha + "</w:body>".length)}`;
  zip.file("word/document.xml", novo);
  return zip.generateAsync({ type: "blob", mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" });
}
