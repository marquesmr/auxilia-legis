import { del, get, head, list, put } from "@vercel/blob";

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

const PREFIXO_TRAVA = `auxilia-legis/${PASTA}/restricao/`;

function caminhoTrava(email: string) {
  return `${PREFIXO_TRAVA}${encodeURIComponent(email.trim().toLowerCase())}.json`;
}

export type TravaEmail = { email: string; nascimento: string; ate: string };

export async function lerTravaEmail(email: string): Promise<TravaEmail | null> {
  const chave = token();
  if (!chave) return null;
  try {
    const resposta = await get(caminhoTrava(email), { access: "private", token: chave, useCache: false });
    if (!resposta?.stream) return null;
    const dados = JSON.parse(await new Response(resposta.stream).text()) as Partial<TravaEmail>;
    if (!dados.ate || !dados.email) return null;
    return { email: dados.email, nascimento: dados.nascimento ?? "", ate: dados.ate };
  } catch (err) {
    if (naoAchei(err)) return null;
    throw err;
  }
}

export async function gravarTravaEmail(email: string, nascimento: string, ate: string) {
  const chave = token();
  if (!chave) return;
  const corpo = JSON.stringify({ email: email.trim().toLowerCase(), nascimento, ate });
  await put(caminhoTrava(email), corpo, {
    access: "private",
    token: chave,
    allowOverwrite: true,
    addRandomSuffix: false,
    contentType: "application/json",
    cacheControlMaxAge: 60,
  });
}

export async function apagarTravaEmail(email: string) {
  const chave = token();
  if (!chave) return;
  try {
    await del(caminhoTrava(email), { token: chave });
  } catch (err) {
    if (!naoAchei(err)) throw err;
  }
}

export async function listarTravasEmail(): Promise<TravaEmail[]> {
  const chave = token();
  if (!chave) return [];
  const achados = await list({ prefix: PREFIXO_TRAVA, token: chave });
  const lista: TravaEmail[] = [];
  for (const item of achados.blobs) {
    try {
      const resposta = await get(item.pathname, { access: "private", token: chave, useCache: false });
      if (!resposta?.stream) continue;
      const dados = JSON.parse(await new Response(resposta.stream).text()) as Partial<TravaEmail>;
      if (!dados.email || !dados.ate) continue;
      if (new Date(dados.ate).getTime() <= Date.now()) continue;
      lista.push({ email: dados.email, nascimento: dados.nascimento ?? "", ate: dados.ate });
    } catch {
      /* um arquivo ruim não esconde os outros */
    }
  }
  return lista;
}
