import JSZip from "jszip";

export type ParteTermo = { texto: string; negrito?: boolean };
export type BlocoTermo = { partes: ParteTermo[]; centro?: boolean; titulo?: boolean };

function escaparXml(texto: string) {
  return texto.replace(/&/g, "&").replace(/</g, "<").replace(/>/g, ">");
}

function blocoXml(bloco: BlocoTermo) {
  const tamanho = bloco.titulo ? 28 : 24;
  const alinhamento = bloco.centro || bloco.titulo ? "center" : "both";
  const runs = bloco.partes
    .map((parte) => {
      const negrito = parte.negrito || bloco.titulo ? "<w:b/>" : "";
      const pedacos = parte.texto.split("\n");
      const texto = pedacos.map((pedaco, indice) => `${indice ? "<w:br/>" : ""}<w:t xml:space="preserve">${escaparXml(pedaco)}</w:t>`).join("");
      return `<w:r><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/>${negrito}<w:sz w:val="${tamanho}"/><w:szCs w:val="${tamanho}"/></w:rPr>${texto}</w:r>`;
    })
    .join("");
  return `<w:p><w:pPr><w:jc w:val="${alinhamento}"/><w:spacing w:after="160"/><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:sz w:val="${tamanho}"/><w:szCs w:val="${tamanho}"/></w:rPr></w:pPr>${runs}</w:p>`;
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
