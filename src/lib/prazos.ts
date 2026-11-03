import { encerraStatus, nomeStatus } from "@/lib/status-catalogo";

export const TIPOS = ["Requerimentos", "Projetos de Lei", "Indicações", "Outros"] as const;

export type TipoProcesso = (typeof TIPOS)[number] | (string & {});
export type StatusProcesso = string;
export type Urgencia = "vencido" | "hoje" | "proximo" | "ok" | "concluido";
export const TIPOS_LEI = ["Lei ordinária", "Lei complementar", "Decreto legislativo", "Resolução"] as const;
export type TipoLei = (typeof TIPOS_LEI)[number];
export type RetornoLegislativo = "veto" | "sancionada";
export type AlcanceVeto = "integral" | "parcial";

export type Andamento = {
  id: string;
  em: string;
  texto: string;
  autorNome: string;
  link?: string;
};

export type Processo = {
  id: string;
  numero: string;
  parte: string;
  assunto: string;
  tipo: TipoProcesso;
  dataLancamento: string;
  prazo: string;
  alertaDias: number;
  status: StatusProcesso;
  historico: Andamento[];
  equipeId: string | null;
  autorId: string | null;
  autorNome: string;
  retorno: RetornoLegislativo | null;
  vetoAlcance: AlcanceVeto | null;
  leiTipo: TipoLei | null;
  leiNumero: number | null;
  leiAno: number | null;
  apreciacaoPrazo: string | null;
};

const STORAGE_KEY = "prazos.processos.v1";
const SENT_KEY = "prazos.avisos.v1";

export function todayIso(now = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function addDaysIso(days: number, now = new Date()): string {
  const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + days);
  return todayIso(next);
}

export function parseDate(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y || 1970, (m || 1) - 1, d || 1);
}

const semExpediente = new Set<string>();

export type DiaMarcado = { data: string; nome: string; tipo: "feriado" | "facultativo" | "recesso"; municipio?: string };

/** Datas sem expediente (feriados e recesso), no formato AAAA-MM-DD. */
export function definirSemExpediente(datas: string[]) {
  semExpediente.clear();
  for (const data of datas) if (/^\d{4}-\d{2}-\d{2}$/.test(data)) semExpediente.add(data);
}

function ehDiaUtil(data: Date): boolean {
  const dia = data.getDay();
  if (dia === 0 || dia === 6) return false;
  return !semExpediente.has(todayIso(data));
}

export function daysUntil(iso: string, now = new Date()): number {
  const hoje = parseDate(todayIso(now));
  const alvo = parseDate(iso);
  if (Number.isNaN(alvo.getTime())) return 0;
  if (hoje.getTime() === alvo.getTime()) return 0;
  const sinal = alvo.getTime() > hoje.getTime() ? 1 : -1;
  const cursor = new Date(hoje);
  let total = 0;
  for (let passo = 0; passo < 4000; passo += 1) {
    cursor.setDate(cursor.getDate() + sinal);
    if (ehDiaUtil(cursor)) total += sinal;
    if (cursor.getTime() === alvo.getTime()) break;
  }
  return total;
}

export function formatDate(iso: string): string {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(parseDate(iso));
}

export function urgencia(p: Processo, now = new Date()): Urgencia {
  if (encerraStatus("legislativo", p.status)) return "concluido";
  const dias = daysUntil(p.prazo, now);
  if (dias < 0) return "vencido";
  if (dias === 0) return "hoje";
  if (dias <= p.alertaDias) return "proximo";
  return "ok";
}

export function prazoLabel(p: Processo, now = new Date()): string {
  if (encerraStatus("legislativo", p.status)) return nomeStatus("legislativo", p.status);
  const dias = daysUntil(p.prazo, now);
  if (dias < 0) {
    const n = Math.abs(dias);
    return n === 1 ? "Vencido há 1 dia" : `Vencido há ${n} dias`;
  }
  if (dias === 0) return "Vence hoje";
  if (dias === 1) return "Vence amanhã";
  return `Vence em ${dias} dias`;
}

export function precisaAviso(p: Processo, now = new Date()): boolean {
  const u = urgencia(p, now);
  return u === "vencido" || u === "hoje" || u === "proximo";
}

const RANK: Record<Urgencia, number> = {
  vencido: 0,
  hoje: 1,
  proximo: 2,
  ok: 3,
  concluido: 4,
};

export function ordenar(lista: Processo[], now = new Date()): Processo[] {
  return [...lista].sort((a, b) => {
    const diff = RANK[urgencia(a, now)] - RANK[urgencia(b, now)];
    if (diff !== 0) return diff;
    return a.prazo.localeCompare(b.prazo);
  });
}

export function lerProcessosLocais(): Processo[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isProcesso).map(normalizarProcesso);
  } catch {
    return [];
  }
}

export function saveProcessos(lista: Processo[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(lista));
}

function isProcesso(value: unknown): value is Processo {
  if (!value || typeof value !== "object") return false;
  const p = value as Processo;
  return typeof p.id === "string" && typeof p.numero === "string" && typeof p.prazo === "string";
}

const EXEMPLO_TIPO: Record<string, TipoProcesso> = {
  "5001234-12.2026.8.13.0024": "Requerimentos",
  "0009876-33.2025.5.03.0028": "Projetos de Lei",
  "1004321-09.2026.4.01.3800": "Indicações",
  "ADM-2026/0412": "Outros",
};

function normalizarProcesso(p: Processo): Processo {
  const tipo = (TIPOS as readonly string[]).includes(p.tipo) ? p.tipo : (EXEMPLO_TIPO[p.numero] ?? "Outros");
  return {
    ...p,
    tipo,
    equipeId: p.equipeId ?? null,
    autorId: p.autorId ?? null,
    autorNome: p.autorNome ?? "",
    retorno: p.retorno ?? null,
    vetoAlcance: p.vetoAlcance ?? null,
    leiTipo: p.leiTipo ?? null,
    leiNumero: p.leiNumero ?? null,
    leiAno: p.leiAno ?? null,
    apreciacaoPrazo: p.apreciacaoPrazo ?? null,
    historico: (p.historico ?? []).map((item) => ({ ...item, autorNome: item.autorNome ?? "" })),
  };
}

export function numeroComAno(numero: string, dataLancamento?: string): string {
  const bruto = numero.trim();
  if (/\/\d{4}$/.test(bruto)) return bruto;
  const ano = dataLancamento?.slice(0, 4);
  const anoOk = ano && /^\d{4}$/.test(ano) ? ano : String(new Date().getFullYear());
  return `${bruto}/${anoOk}`;
}

export function separarNumero(numero: string, dataLancamento?: string): { numero: string; ano: number } {
  const completo = numeroComAno(numero, dataLancamento);
  const corte = completo.lastIndexOf("/");
  return { numero: completo.slice(0, corte), ano: Number(completo.slice(corte + 1)) };
}

export function juntarNumero(numero: string, ano: number): string {
  const base = numero.trim().replace(/\/\d{4}$/, "");
  return `${base}/${ano}`;
}

export function rotuloRetorno(p: Processo): string {
  if (p.retorno === "veto") return p.vetoAlcance === "parcial" ? "Veto parcial" : "Veto integral";
  if (p.retorno === "sancionada") return `Sancionada · ${p.leiTipo ?? "Lei"}`;
  return "Sem retorno";
}

export function dataRespostaIso(p: Processo): string | null {
  if (p.status !== "concluido") return null;
  const marca = [...p.historico].reverse().find((item) => /conclu[ií]do/i.test(item.texto));
  if (marca) return marca.em.slice(0, 10);
  return p.prazo;
}

export type ClasseResposta = "no-prazo" | "fora" | "aguardando";

export function classeResposta(p: Processo, now = new Date()): ClasseResposta {
  const resposta = dataRespostaIso(p);
  if (resposta) return resposta <= p.prazo ? "no-prazo" : "fora";
  if (daysUntil(p.prazo, now) < 0) return "fora";
  return "aguardando";
}

export function rotuloResposta(p: Processo, now = new Date()): string {
  const classe = classeResposta(p, now);
  if (classe === "no-prazo") return "Respondido no prazo";
  if (classe === "fora") return "Não respondido no prazo";
  return "Ainda no prazo";
}

export function avisoKey(p: Processo, now = new Date()): string {
  return `${p.id}|${urgencia(p, now)}|${todayIso(now)}`;
}

export function avisosJaEnviados(): string[] {
  try {
    const raw = JSON.parse(localStorage.getItem(SENT_KEY) || "[]") as unknown;
    return Array.isArray(raw) ? raw.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}

export function marcarAvisos(keys: string[]): void {
  const atual = avisosJaEnviados();
  const next = [...atual, ...keys].slice(-300);
  localStorage.setItem(SENT_KEY, JSON.stringify(next));
}
