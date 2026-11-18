export type Tema = "claro" | "escuro" | "auto";
export type Cor = "padrao" | "verde" | "vinho" | "azul" | "laranja" | "roxo";
export type AreaInicial = "legislativo" | "administrativo";

export type Preferencias = {
  tema: Tema;
  cor: Cor;
  area: AreaInicial;
  escopo: "meus" | "equipe";
  equipeId: string | null;
};

const CHAVE = "prazos.preferencias";
const CONTA_TEMA = "prazos.conta-tema";
const CORES: Cor[] = ["padrao", "verde", "vinho", "azul", "laranja", "roxo"];

export const PREFERENCIAS_PADRAO: Preferencias = {
  tema: "auto",
  cor: "padrao",
  area: "legislativo",
  escopo: "meus",
  equipeId: null,
};

function chaveDaConta(userId: string) {
  return `${CHAVE}.${userId}`;
}

function lerGuardado(bruto: string | null): Preferencias {
  try {
    const lido = JSON.parse(bruto || "");
    const tema: Tema = lido?.tema === "claro" || lido?.tema === "escuro" || lido?.tema === "auto" ? lido.tema : "auto";
    const cor: Cor = CORES.includes(lido?.cor) ? lido.cor : "padrao";
    const area: AreaInicial = lido?.area === "administrativo" ? "administrativo" : "legislativo";
    const escopo = lido?.escopo === "equipe" ? "equipe" : "meus";
    const equipeId = typeof lido?.equipeId === "string" && lido.equipeId.trim() ? lido.equipeId.trim() : null;
    return { tema, cor, area, escopo, equipeId };
  } catch {
    return PREFERENCIAS_PADRAO;
  }
}

export function lerPreferencias(userId?: string | null): Preferencias {
  if (!userId) return PREFERENCIAS_PADRAO;
  return lerGuardado(localStorage.getItem(chaveDaConta(userId)));
}

export function gravarPreferencias(preferencias: Preferencias, userId: string) {
  localStorage.setItem(chaveDaConta(userId), JSON.stringify(preferencias));
  localStorage.setItem(CONTA_TEMA, userId);
  aplicarTema(preferencias.tema, preferencias.cor);
}

export function assumirTemaDaConta(userId: string) {
  const chave = chaveDaConta(userId);
  if (!localStorage.getItem(chave)) {
    const legado = localStorage.getItem(CHAVE);
    if (legado && !localStorage.getItem("prazos.preferencias.legado")) {
      localStorage.setItem(chave, legado);
      localStorage.setItem("prazos.preferencias.legado", userId);
    }
  }
  localStorage.setItem(CONTA_TEMA, userId);
  const prefs = lerPreferencias(userId);
  aplicarTema(prefs.tema, prefs.cor);
}

export function soltarTemaDaConta() {
  localStorage.removeItem(CONTA_TEMA);
  aplicarTema(PREFERENCIAS_PADRAO.tema, PREFERENCIAS_PADRAO.cor);
}

export function temaDaContaAtiva(): string | null {
  return localStorage.getItem(CONTA_TEMA);
}

export function aplicarTema(tema: Tema, _cor: Cor = "padrao") {
  const raiz = document.documentElement;
  raiz.dataset.tema = tema;
  delete raiz.dataset.cor;
  const escuro = tema === "escuro" || (tema === "auto" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", escuro ? "#12110e" : "#f3efe6");
}
