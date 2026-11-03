export type FeriadoLido = {
  nome: string;
  inicio: string;
  fim: string;
  tipo: "feriado" | "facultativo" | "recesso";
};

const MESES: Record<string, number> = {
  janeiro: 1,
  fevereiro: 2,
  marco: 3,
  março: 3,
  abril: 4,
  maio: 5,
  junho: 6,
  julho: 7,
  agosto: 8,
  setembro: 9,
  outubro: 10,
  novembro: 11,
  dezembro: 12,
};

function dataValida(ano: number, mes: number, dia: number) {
  if (mes < 1 || mes > 12 || dia < 1 || dia > 31) return "";
  const data = new Date(ano, mes - 1, dia);
  if (data.getFullYear() !== ano || data.getMonth() !== mes - 1 || data.getDate() !== dia) return "";
  const m = String(mes).padStart(2, "0");
  const d = String(dia).padStart(2, "0");
  return `${ano}-${m}-${d}`;
}

function tipoDoNome(nome: string): "feriado" | "facultativo" {
  return /facultativo|carnaval|cinzas|v[eé]spera/i.test(nome) ? "facultativo" : "feriado";
}

function limparNome(nome: string) {
  return nome.replace(/\s+/g, " ").replace(/^[\s:–-]+|[\s:–-]+$/g, "").slice(0, 80);
}

export function anoDoTexto(texto: string) {
  const achado = texto.match(/20\d{2}/);
  return achado ? Number(achado[0]) : new Date().getFullYear();
}

export function lerTextoCalendario(texto: string, ano = anoDoTexto(texto)): FeriadoLido[] {
  const itens: FeriadoLido[] = [];
  const vistos = new Set<string>();
  const guardar = (item: FeriadoLido) => {
    const nome = limparNome(item.nome);
    if (nome.length < 3 || !item.inicio) return;
    const chave = `${item.inicio}|${nome.toLocaleLowerCase("pt-BR")}`;
    if (vistos.has(chave)) return;
    vistos.add(chave);
    itens.push({ ...item, nome });
  };

  const linhas = texto.replace(/\r/g, "\n");
  for (const trecho of linhas.matchAll(/(\d{1,2})\s*[\/.\-]\s*(\d{1,2})\s*[:\-–]\s*([^\n]{3,90})/g)) {
    const dia = Number(trecho[1]);
    const mes = Number(trecho[2]);
    const inicio = dataValida(ano, mes, dia);
    guardar({ nome: trecho[3], inicio, fim: inicio, tipo: tipoDoNome(trecho[3]) });
  }

  for (const trecho of linhas.matchAll(/de\s+(\d{1,2})\s+a\s+(\d{1,2})\s+de\s+([a-zçãéõáíóúâêô]+)/gi)) {
    const mes = MESES[trecho[3].toLocaleLowerCase("pt-BR")];
    if (!mes) continue;
    const inicio = dataValida(ano, mes, Number(trecho[1]));
    const fim = dataValida(ano, mes, Number(trecho[2]));
    if (!inicio || !fim || fim < inicio) continue;
    const nomeMes = trecho[3].charAt(0).toLocaleUpperCase("pt-BR") + trecho[3].slice(1);
    guardar({ nome: `Recesso de ${nomeMes}`, inicio, fim, tipo: "recesso" });
  }

  return itens.sort((a, b) => a.inicio.localeCompare(b.inicio));
}

export function lerJsonCalendario(bruto: string): FeriadoLido[] {
  const inicio = bruto.indexOf("{");
  const fim = bruto.lastIndexOf("}");
  if (inicio < 0 || fim <= inicio) return [];
  try {
    const dados = JSON.parse(bruto.slice(inicio, fim + 1)) as {
      itens?: { nome?: unknown; inicio?: unknown; fim?: unknown; tipo?: unknown }[];
    };
    if (!Array.isArray(dados.itens)) return [];
    const itens: FeriadoLido[] = [];
    const vistos = new Set<string>();
    for (const item of dados.itens) {
      const nome = limparNome(typeof item.nome === "string" ? item.nome : "");
      const comeco = typeof item.inicio === "string" ? item.inicio.slice(0, 10) : "";
      const termino = typeof item.fim === "string" ? item.fim.slice(0, 10) : comeco;
      if (nome.length < 3 || !/^\d{4}-\d{2}-\d{2}$/.test(comeco)) continue;
      const fimOk = /^\d{4}-\d{2}-\d{2}$/.test(termino) && termino >= comeco ? termino : comeco;
      const tipo = item.tipo === "recesso" || item.tipo === "facultativo" ? item.tipo : tipoDoNome(nome);
      const chave = `${comeco}|${nome.toLocaleLowerCase("pt-BR")}`;
      if (vistos.has(chave)) continue;
      vistos.add(chave);
      itens.push({ nome, inicio: comeco, fim: fimOk, tipo });
    }
    return itens.sort((a, b) => a.inicio.localeCompare(b.inicio));
  } catch {
    return [];
  }
}
