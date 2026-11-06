import { getSql } from "@/lib/db";
import { nomeBackupAutomatico, nomeBackupManual } from "@/lib/google-drive-backup";

const PASTA_MANUAL = "Auxilia Legis";
const PASTA_AUTO = "Auxilia Legis - Automático";
const ESCOPO = "https://www.googleapis.com/auth/drive.file";

type TokenGoogle = {
  access_token?: string;
  refresh_token?: string;
  error?: string;
  error_description?: string;
};

function erroGoogle(dados: TokenGoogle) {
  if (dados.error === "access_denied") {
    return "O Google bloqueou o acesso porque o aplicativo ainda está em teste. Publique a tela de consentimento ou adicione o e-mail como usuário de teste, no projeto do client ID do login.";
  }
  return dados.error_description || "O Google não autorizou o Drive.";
}

async function pedirToken(corpo: URLSearchParams) {
  const resposta = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: corpo,
  });
  const dados = (await resposta.json()) as TokenGoogle;
  if (!resposta.ok || !dados.access_token) throw new Error(erroGoogle(dados));
  return dados;
}

function credenciais() {
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim() || "";
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim() || "";
  if (!clientId || !clientSecret) throw new Error("O login do Google ainda não está configurado.");
  return { clientId, clientSecret };
}

async function colunaRefresh() {
  const sql = await getSql();
  await sql`alter table gestao_config add column if not exists drive_refresh text`;
  return sql;
}

async function driveJson<T>(token: string, url: string, init?: RequestInit): Promise<T> {
  const resposta = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(init?.headers ?? {}),
    },
  });
  if (!resposta.ok) {
    let detalhe = "";
    try {
      const corpo = (await resposta.json()) as { error?: { message?: string } };
      detalhe = corpo.error?.message ?? "";
    } catch {
      detalhe = "";
    }
    throw new Error(detalhe || "O Google Drive não aceitou o backup.");
  }
  return (await resposta.json()) as T;
}

async function pastaDoSistema(token: string, nome: string) {
  const consulta = encodeURIComponent(
    `name = '${nome}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
  );
  const achada = await driveJson<{ files?: { id: string }[] }>(
    token,
    `https://www.googleapis.com/drive/v3/files?q=${consulta}&fields=files(id)&spaces=drive&pageSize=1`,
  );
  if (achada.files?.[0]?.id) return achada.files[0].id;
  const criada = await driveJson<{ id: string }>(token, "https://www.googleapis.com/drive/v3/files", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: nome, mimeType: "application/vnd.google-apps.folder" }),
  });
  return criada.id;
}

async function enviar(token: string, pastaNome: string, nome: string, conteudo: string) {
  const pasta = await pastaDoSistema(token, pastaNome);
  const consulta = encodeURIComponent(`name = '${nome}' and '${pasta}' in parents and trashed = false`);
  const achado = await driveJson<{ files?: { id: string }[] }>(
    token,
    `https://www.googleapis.com/drive/v3/files?q=${consulta}&fields=files(id)&spaces=drive&pageSize=1`,
  );
  const existente = achado.files?.[0]?.id;
  const limite = "auxilia_backup";
  const metadados = existente
    ? { name: nome, mimeType: "application/json" }
    : { name: nome, mimeType: "application/json", parents: [pasta] };
  const corpo = [
    `--${limite}`,
    "Content-Type: application/json; charset=UTF-8",
    "",
    JSON.stringify(metadados),
    `--${limite}`,
    "Content-Type: application/json",
    "",
    conteudo,
    `--${limite}--`,
    "",
  ].join("\r\n");
  const url = existente
    ? `https://www.googleapis.com/upload/drive/v3/files/${existente}?uploadType=multipart`
    : "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart";
  await driveJson(token, url, {
    method: existente ? "PATCH" : "POST",
    headers: { "Content-Type": `multipart/related; boundary=${limite}` },
    body: corpo,
  });
}

export async function autorizarDriveEEnviarManual(codigo: string, conteudo: string) {
  const { clientId, clientSecret } = credenciais();
  const dados = await pedirToken(
    new URLSearchParams({
      code: codigo,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: "postmessage",
      grant_type: "authorization_code",
    }),
  );
  if (dados.refresh_token) {
    const sql = await colunaRefresh();
    await sql`update gestao_config set drive_refresh = ${dados.refresh_token} where id = 'principal'`;
  }
  const nome = nomeBackupManual();
  await enviar(dados.access_token!, PASTA_MANUAL, nome, conteudo);
  return { nome, pasta: PASTA_MANUAL };
}

export async function enviarBackupAutomaticoDrive(conteudo: string) {
  const sql = await colunaRefresh();
  const linhas = await sql<{ drive_refresh: string | null }>`
    select drive_refresh from gestao_config where id = 'principal'
  `;
  const refresh = linhas[0]?.drive_refresh?.trim();
  if (!refresh) return;
  const { clientId, clientSecret } = credenciais();
  const dados = await pedirToken(
    new URLSearchParams({
      refresh_token: refresh,
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "refresh_token",
      scope: ESCOPO,
    }),
  );
  await enviar(dados.access_token!, PASTA_AUTO, nomeBackupAutomatico(), conteudo);
}
