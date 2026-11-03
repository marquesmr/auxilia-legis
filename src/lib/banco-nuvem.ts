import { get, head, put } from "@vercel/blob";

/**
 * Cópia durável do PGLite. Sem DATABASE_URL cada função da Vercel nascia com o
 * banco vazio, então o backup restaurado (e o login) desaparecia no pedido seguinte.
 * Produção, prévia e o computador local usam pastas diferentes para não se apagarem.
 */
const PASTA =
  process.env.VERCEL_ENV === "production"
    ? "prod"
    : process.env.VERCEL_ENV === "preview"
      ? "preview"
      : "local";
const CAMINHO = `auxilia-legis/${PASTA}/banco.tgz`;

function token() {
  const valor = process.env.BLOB_READ_WRITE_TOKEN?.trim();
  return valor || undefined;
}

export function nuvemConfigurada() {
  return Boolean(token());
}

function classeDoErro(err: unknown) {
  if (!err || typeof err !== "object") return "";
  return (err as { constructor?: { name?: string } }).constructor?.name ?? "";
}

function statusDoErro(err: unknown) {
  return err && typeof err === "object" && "status" in err ? Number(err.status) : 0;
}

function mensagemDoErro(err: unknown) {
  if (!err || typeof err !== "object" || !("message" in err)) return "";
  return String((err as { message: unknown }).message);
}

function naoAchei(err: unknown) {
  const classe = classeDoErro(err);
  if (classe === "BlobNotFoundError" || statusDoErro(err) === 404) return true;
  const msg = mensagemDoErro(err).toLowerCase();
  return msg.includes("does not exist") || msg.includes("not found");
}

export function conflitoDeGravacao(err: unknown) {
  const classe = classeDoErro(err);
  if (classe === "BlobPreconditionFailedError" || statusDoErro(err) === 412) return true;
  const msg = mensagemDoErro(err).toLowerCase();
  return msg.includes("precondition failed") || msg.includes("etag mismatch");
}

/** O ETag do download HTTP vem entre aspas (e às vezes com W/) e não serve no ifMatch. */
function nucleoEtag(valor: string | null | undefined) {
  if (!valor) return "";
  let s = valor.trim();
  if (/^W\//i.test(s)) s = s.slice(2).trim();
  if (s.length >= 2 && s.startsWith('"') && s.endsWith('"')) s = s.slice(1, -1);
  return s;
}

export function mesmoEtag(a: string | null | undefined, b: string | null | undefined) {
  const esquerda = nucleoEtag(a);
  const direita = nucleoEtag(b);
  return Boolean(esquerda) && esquerda === direita;
}

/** ETag da API (head/put). O do GET é de CDN e faz a Vercel recusar a escrita. */
export async function etagAtual(): Promise<string | null> {
  const chave = token();
  if (!chave) return null;
  try {
    const meta = await head(CAMINHO, { token: chave });
    const valor = meta.etag?.trim();
    return valor || null;
  } catch (err) {
    if (naoAchei(err)) return null;
    console.warn("[banco] não li o etag oficial", mensagemDoErro(err));
    return null;
  }
}

export type CopiaNuvem =
  | { tipo: "ausente" }
  | { tipo: "igual" }
  | { tipo: "nova"; etag: string; blob: Blob };

export async function buscarCopia(etag: string | null): Promise<CopiaNuvem> {
  const chave = token();
  if (!chave) return { tipo: "ausente" };
  const atual = await etagAtual();
  if (atual && mesmoEtag(etag, atual)) return { tipo: "igual" };
  try {
    const resposta = await get(CAMINHO, {
      access: "private",
      token: chave,
      useCache: false,
    });
    if (!resposta?.stream) return { tipo: "ausente" };
    const bytes = new Uint8Array(await new Response(resposta.stream).arrayBuffer());
    if (!bytes.byteLength) return { tipo: "ausente" };
    const etagHttp = resposta.blob.etag?.trim() || "";
    return { tipo: "nova", etag: atual || etagHttp, blob: new Blob([bytes]) };
  } catch (err) {
    if (naoAchei(err)) return { tipo: "ausente" };
    throw err;
  }
}

export async function gravarCopia(arquivo: Blob, etag: string | null): Promise<string> {
  const chave = token();
  if (!chave) throw new Error("Armazenamento não configurado.");
  const condicao = etag?.trim() || "";
  const salvo = await put(CAMINHO, arquivo, {
    access: "private",
    token: chave,
    allowOverwrite: true,
    addRandomSuffix: false,
    contentType: "application/gzip",
    cacheControlMaxAge: 60,
    ...(condicao ? { ifMatch: condicao } : {}),
  });
  return salvo.etag;
}

const CAMINHO_TRAVAS = `auxilia-legis/${PASTA}/emails-restritos.json`;

export type TravaEmail = { email: string; nascimento: string; ate: string };

type MapaTravas = Record<string, { nascimento: string; ate: string }>;

async function lerMapaTravas(): Promise<MapaTravas> {
  const chave = token();
  if (!chave) return {};
  try {
    const resposta = await get(CAMINHO_TRAVAS, { access: "private", token: chave, useCache: false });
    if (!resposta?.stream) return {};
    const dados = JSON.parse(await new Response(resposta.stream).text()) as MapaTravas;
    return dados && typeof dados === "object" ? dados : {};
  } catch (err) {
    if (naoAchei(err)) return {};
    throw err;
  }
}

async function gravarMapaTravas(mapa: MapaTravas) {
  const chave = token();
  if (!chave) return;
  await put(CAMINHO_TRAVAS, JSON.stringify(mapa), {
    access: "private",
    token: chave,
    allowOverwrite: true,
    addRandomSuffix: false,
    contentType: "application/json",
    cacheControlMaxAge: 60,
  });
}

export async function lerTravaEmail(email: string): Promise<TravaEmail | null> {
  const normal = email.trim().toLowerCase();
  const item = (await lerMapaTravas())[normal];
  if (!item?.ate || new Date(item.ate).getTime() <= Date.now()) return null;
  return { email: normal, nascimento: item.nascimento ?? "", ate: item.ate };
}

export async function gravarTravaEmail(email: string, nascimento: string, ate: string) {
  const normal = email.trim().toLowerCase();
  const mapa = await lerMapaTravas();
  const atual = mapa[normal]?.ate;
  const ateFinal = atual && new Date(atual).getTime() > new Date(ate).getTime() ? atual : ate;
  mapa[normal] = { nascimento, ate: ateFinal };
  await gravarMapaTravas(mapa);
}

export async function apagarTravaEmail(email: string) {
  const normal = email.trim().toLowerCase();
  const mapa = await lerMapaTravas();
  if (!mapa[normal]) return;
  delete mapa[normal];
  await gravarMapaTravas(mapa);
}

export async function listarTravasEmail(): Promise<TravaEmail[]> {
  const mapa = await lerMapaTravas();
  return Object.entries(mapa)
    .filter(([, item]) => item?.ate && new Date(item.ate).getTime() > Date.now())
    .map(([email, item]) => ({ email, nascimento: item.nascimento ?? "", ate: item.ate }));
}
