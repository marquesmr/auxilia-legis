import { createCipheriv, createDecipheriv, createHash, randomBytes, scryptSync } from "node:crypto";
import { getSql, type Sql } from "@/lib/db";
import { marcado } from "@/lib/gestao.server";

const RETORNO = "https://www.auxilialegis.online/api/spotify/callback";
const ESCOPOS = "user-read-private user-read-email playlist-read-private playlist-read-collaborative user-read-currently-playing";

function chave() {
  const segredo = process.env.BETTER_AUTH_SECRET?.trim() ?? "";
  if (segredo.length < 16) throw new Error("O sistema não tem chave para guardar a conta do Spotify.");
  return scryptSync(segredo, "auxilia-legis-spotify-v1", 32);
}

function cifrar(texto: string) {
  const iv = randomBytes(12);
  const cifra = createCipheriv("aes-256-gcm", chave(), iv);
  const dados = Buffer.concat([cifra.update(texto, "utf8"), cifra.final()]);
  return Buffer.concat([iv, cifra.getAuthTag(), dados]).toString("base64url");
}

function abrir(texto: string) {
  const bloco = Buffer.from(texto, "base64url");
  const decifrador = createDecipheriv("aes-256-gcm", chave(), bloco.subarray(0, 12));
  decifrador.setAuthTag(bloco.subarray(12, 28));
  return Buffer.concat([decifrador.update(bloco.subarray(28)), decifrador.final()]).toString("utf8");
}

async function tabelas(sql: Sql) {
  await sql`
    create table if not exists spotify_app (
      id text primary key,
      client_id text not null
    )
  `;
  await sql`
    create table if not exists spotify_oauth (
      state text primary key,
      user_id text not null,
      verifier text not null,
      expira_em timestamptz not null
    )
  `;
  await sql`
    create table if not exists spotify_conta (
      user_id text primary key,
      spotify_id text not null,
      nome text not null,
      refresh_token text not null,
      access_token text not null,
      expira_em timestamptz not null
    )
  `;
}

async function exigirAdmin(userId: string) {
  const sql = await getSql();
  await tabelas(sql);
  const perfil = await sql<{ papel: string; bloqueado: boolean }>`
    select papel, bloqueado from usuario_perfil where user_id = ${userId}
  `;
  if (perfil[0]?.papel !== "administrador" || marcado(perfil[0]?.bloqueado)) {
    throw new Error("Só o administrador vincula o Spotify.");
  }
  return sql;
}

export async function clientIdSpotify(sql: Sql) {
  const ambiente = process.env.SPOTIFY_CLIENT_ID?.trim() ?? "";
  if (/^[a-f0-9]{32}$/i.test(ambiente)) return ambiente;
  const linhas = await sql<{ client_id: string }>`select client_id from spotify_app where id = 'principal'`;
  return linhas[0]?.client_id ?? "";
}

export async function estadoSpotify(userId: string) {
  const sql = await exigirAdmin(userId);
  const clientId = await clientIdSpotify(sql);
  const conta = await sql<{ nome: string }>`select nome from spotify_conta where user_id = ${userId}`;
  let tocando = "";
  if (conta[0]) {
    try {
      const token = await tokenDaConta(sql, userId);
      const resposta = await fetch("https://api.spotify.com/v1/me/player/currently-playing", {
        headers: { authorization: `Bearer ${token}` },
      });
      if (resposta.status === 200) {
        const corpo = (await resposta.json()) as { item?: { name?: string; artists?: { name?: string }[] } };
        const artista = corpo.item?.artists?.map((item) => item.name).filter(Boolean).join(", ") ?? "";
        tocando = [corpo.item?.name, artista].filter(Boolean).join(" · ");
      }
    } catch {
      tocando = "";
    }
  }
  return {
    configurado: Boolean(clientId),
    retorno: RETORNO,
    vinculado: Boolean(conta[0]),
    nome: conta[0]?.nome ?? "",
    tocando,
  };
}

export async function guardarClientIdSpotify(userId: string, clientId: string) {
  const limpo = clientId.trim();
  if (!/^[a-f0-9]{32}$/i.test(limpo)) throw new Error("O Client ID do Spotify tem 32 caracteres.");
  const sql = await exigirAdmin(userId);
  await sql`
    insert into spotify_app (id, client_id) values ('principal', ${limpo})
    on conflict (id) do update set client_id = ${limpo}
  `;
  return { ok: true, retorno: RETORNO };
}

export async function iniciarSpotify(userId: string) {
  const sql = await exigirAdmin(userId);
  const clientId = await clientIdSpotify(sql);
  if (!clientId) throw new Error("Informe o Client ID do aplicativo Spotify antes de vincular.");
  const state = randomBytes(24).toString("hex");
  const verifier = randomBytes(48).toString("base64url");
  const desafio = createHash("sha256").update(verifier).digest("base64url");
  const expira = new Date(Date.now() + 10 * 60 * 1000).toISOString();
  await sql`delete from spotify_oauth where expira_em < now()`;
  await sql`
    insert into spotify_oauth (state, user_id, verifier, expira_em)
    values (${state}, ${userId}, ${verifier}, ${expira})
  `;
  const url = new URL("https://accounts.spotify.com/authorize");
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", RETORNO);
  url.searchParams.set("scope", ESCOPOS);
  url.searchParams.set("state", state);
  url.searchParams.set("code_challenge_method", "S256");
  url.searchParams.set("code_challenge", desafio);
  url.searchParams.set("show_dialog", "true");
  return { url: url.toString() };
}

async function pedirToken(clientId: string, corpo: Record<string, string>) {
  const resposta = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: clientId, ...corpo }),
  });
  const json = (await resposta.json()) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
    error?: string;
  };
  if (!resposta.ok || !json.access_token) throw new Error("O Spotify não autorizou a conta.");
  return json;
}

export async function concluirSpotify(state: string, code: string) {
  const sql = await getSql();
  await tabelas(sql);
  const pendente = await sql<{ user_id: string; verifier: string }>`
    delete from spotify_oauth
    where state = ${state} and expira_em > now()
    returning user_id, verifier
  `;
  const item = pendente[0];
  if (!item) throw new Error("A autorização expirou. Tente vincular de novo.");
  const clientId = await clientIdSpotify(sql);
  const token = await pedirToken(clientId, {
    grant_type: "authorization_code",
    code,
    redirect_uri: RETORNO,
    code_verifier: item.verifier,
  });
  if (!token.refresh_token) throw new Error("O Spotify não devolveu a renovação da conta. Tente vincular de novo.");
  const perfil = await fetch("https://api.spotify.com/v1/me", {
    headers: { authorization: `Bearer ${token.access_token}` },
  });
  if (!perfil.ok) throw new Error("Não foi possível ler a conta do Spotify.");
  const eu = (await perfil.json()) as { id?: string; display_name?: string; email?: string };
  if (!eu.id) throw new Error("A conta do Spotify não trouxe um identificador.");
  const expira = new Date(Date.now() + Number(token.expires_in || 3600) * 1000).toISOString();
  const nome = (eu.display_name || eu.email || "Conta Spotify").slice(0, 80);
  await sql`
    insert into spotify_conta (user_id, spotify_id, nome, refresh_token, access_token, expira_em)
    values (
      ${item.user_id},
      ${eu.id},
      ${nome},
      ${cifrar(token.refresh_token)},
      ${cifrar(token.access_token!)},
      ${expira}
    )
    on conflict (user_id) do update set
      spotify_id = ${eu.id},
      nome = ${nome},
      refresh_token = ${cifrar(token.refresh_token)},
      access_token = ${cifrar(token.access_token!)},
      expira_em = ${expira}
  `;
}

async function tokenDaConta(sql: Sql, userId: string) {
  const linhas = await sql<{ refresh_token: string; access_token: string; expira_em: string }>`
    select refresh_token, access_token, expira_em from spotify_conta where user_id = ${userId}
  `;
  const conta = linhas[0];
  if (!conta) throw new Error("Nenhuma conta do Spotify vinculada.");
  if (new Date(conta.expira_em).getTime() > Date.now() + 60_000) return abrir(conta.access_token);
  const clientId = await clientIdSpotify(sql);
  const renovado = await pedirToken(clientId, {
    grant_type: "refresh_token",
    refresh_token: abrir(conta.refresh_token),
  });
  const expira = new Date(Date.now() + Number(renovado.expires_in || 3600) * 1000).toISOString();
  const refresh = cifrar(renovado.refresh_token || abrir(conta.refresh_token));
  await sql`
    update spotify_conta
    set access_token = ${cifrar(renovado.access_token!)}, refresh_token = ${refresh}, expira_em = ${expira}
    where user_id = ${userId}
  `;
  return renovado.access_token!;
}

export async function playlistsSpotify(userId: string) {
  const sql = await exigirAdmin(userId);
  const token = await tokenDaConta(sql, userId);
  const resposta = await fetch("https://api.spotify.com/v1/me/playlists?limit=20", {
    headers: { authorization: `Bearer ${token}` },
  });
  if (!resposta.ok) throw new Error("Não foi possível ler as playlists.");
  const json = (await resposta.json()) as { items?: { id?: string; name?: string; external_urls?: { spotify?: string } }[] };
  return (json.items ?? []).flatMap((item) => {
    const url = item.external_urls?.spotify ?? "";
    if (!item.id || !url) return [];
    return [{ id: item.id, nome: (item.name || "Playlist").slice(0, 80), url }];
  });
}

export async function desvincularSpotify(userId: string) {
  const sql = await exigirAdmin(userId);
  await sql`delete from spotify_conta where user_id = ${userId}`;
  return { ok: true };
}
