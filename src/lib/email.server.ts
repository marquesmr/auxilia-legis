import { connect } from "node:tls";
import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "node:crypto";

export const EMAIL_ENVIO = "auxilialegis@marquestecnologies.com";
const SMTP_HOST = "smtp.titan.email";
const SMTP_PORT = 465;

function chaveCifra() {
  const segredo = process.env.BETTER_AUTH_SECRET || process.env.AUTH_SECRET || "auxilia-legis";
  return scryptSync(segredo, "smtp-auxilia-legis", 32);
}

export function cifrarSenhaCaixa(senha: string) {
  const iv = randomBytes(12);
  const cifra = createCipheriv("aes-256-gcm", chaveCifra(), iv);
  const dado = Buffer.concat([cifra.update(senha, "utf8"), cifra.final()]);
  const tag = cifra.getAuthTag();
  return `${iv.toString("hex")}.${tag.toString("hex")}.${dado.toString("hex")}`;
}

export function decifrarSenhaCaixa(guardado: string) {
  const [ivHex, tagHex, dadoHex] = guardado.split(".");
  if (!ivHex || !tagHex || !dadoHex) return "";
  const cifra = createDecipheriv("aes-256-gcm", chaveCifra(), Buffer.from(ivHex, "hex"));
  cifra.setAuthTag(Buffer.from(tagHex, "hex"));
  return Buffer.concat([cifra.update(Buffer.from(dadoHex, "hex")), cifra.final()]).toString("utf8");
}

function comando(socket: import("node:tls").TLSSocket, texto: string) {
  socket.write(texto.endsWith("\r\n") ? texto : `${texto}\r\n`);
}

function escapar(texto: string) {
  return texto
    .replace(/&/g, "&" + "amp;")
    .replace(/</g, "&" + "lt;")
    .replace(/>/g, "&" + "gt;")
    .replace(/"/g, "&" + "quot;");
}

export function emailHtml(nome: string, corpo: string, origem = "") {
  const tratamento = escapar(nome.trim() || "olá");
  const endereco = origem.replace(/\/$/, "");
  const banner = endereco
    ? `<tr><td><img src="${escapar(`${endereco}/x-banner.jpg`)}" alt="Auxilia Legis" width="600" style="display:block;width:100%;max-width:600px;height:auto;border:0;"></td></tr>`
    : "";
  return `<!DOCTYPE html><html lang="pt-BR"><body style="margin:0;background:#f4f1ea;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f1ea;padding:24px 12px;">
<tr><td align="center">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#fffdf8;border-radius:16px;overflow:hidden;">
${banner}
<tr><td style="padding:28px 32px;font-family:Georgia,'Times New Roman',serif;font-size:16px;line-height:1.6;color:#1c1915;text-align:justify;">
<p style="margin:0 0 16px;">Olá, <strong>${tratamento}</strong>!</p>
${corpo}
<p style="margin:24px 0 0;">Abraço,<br><strong>Equipe Auxilia Legis</strong></p>
</td></tr>
</table>
</td></tr>
</table>
</body></html>`;
}

export function botaoEmail(url: string, rotulo: string) {
  return `<p style="margin:20px 0;"><a href="${escapar(url)}" style="display:inline-block;background:#1e3d32;color:#fffdf8;text-decoration:none;padding:12px 18px;border-radius:10px;font-weight:700;">${escapar(rotulo)}</a></p>`;
}

export function codigoEmail(codigo: string) {
  return `<p style="margin:18px 0;font-size:32px;letter-spacing:6px;font-weight:700;color:#1e3d32;">${escapar(codigo)}</p>`;
}

export async function urlDoSite() {
  const ambiente = String(process.env.VITE_PUBLIC_HOSTNAME ?? "")
    .split(",")[0]
    .trim()
    .replace(/^https?:\/\//, "")
    .split("/")[0]
    .split(":")[0]
    .toLowerCase();
  if (ambiente && /^[a-z0-9.-]+$/.test(ambiente) && ambiente.includes(".") && !ambiente.endsWith("vercel.app")) {
    return `https://${ambiente}`;
  }
  try {
    const { getRequest } = await import("@tanstack/react-start/server");
    const pedido = getRequest();
    const host = (pedido.headers.get("x-forwarded-host") || pedido.headers.get("host") || "").split(",")[0].trim();
    if (!host) return "";
    const proto = pedido.headers.get("x-forwarded-proto") || (host.startsWith("localhost") || host.startsWith("127.") ? "http" : "https");
    return `${proto}://${host}`;
  } catch {
    return "";
  }
}

function assuntoCodificado(assunto: string) {
  if (/^[\x20-\x7E]*$/.test(assunto)) return assunto;
  return `=?UTF-8?B?${Buffer.from(assunto, "utf8").toString("base64")}?=`;
}

function quebrar(base64: string) {
  return base64.replace(/.{1,76}/g, (trecho) => `${trecho}\r\n`).trimEnd();
}

export function enviarEmail(destino: string, assunto: string, html: string, senhaCaixa: string) {
  const corpo = [
    `From: Auxilia Legis <${EMAIL_ENVIO}>`,
    `To: ${destino}`,
    `Subject: ${assuntoCodificado(assunto)}`,
    "MIME-Version: 1.0",
    "Content-Type: text/html; charset=UTF-8",
    "Content-Transfer-Encoding: base64",
    "",
    quebrar(Buffer.from(html, "utf8").toString("base64")),
    "",
  ].join("\r\n");

  return new Promise<void>((resolve, reject) => {
    const socket = connect({ host: SMTP_HOST, port: SMTP_PORT, servername: SMTP_HOST });
    let etapa = 0;
    let buffer = "";
    const falha = (mensagem: string) => {
      socket.destroy();
      reject(new Error(mensagem));
    };
    const tempo = setTimeout(() => falha("O servidor de e-mail não respondeu."), 20000);
    socket.on("error", () => falha("Não foi possível falar com o servidor de e-mail."));
    socket.on("data", (pedaço) => {
      buffer += pedaço.toString("utf8");
      const linhas = buffer.split(/\r?\n/).filter((linha) => linha.length > 0);
      const ultima = linhas.at(-1) ?? "";
      if (ultima.length < 4 || ultima[3] === "-") return;
      buffer = "";
      const codigo = Number(ultima.slice(0, 3));
      if (etapa === 0 && codigo === 220) {
        comando(socket, "EHLO auxilialegis");
        etapa = 1;
        return;
      }
      if (etapa === 1 && codigo === 250) {
        comando(socket, "AUTH LOGIN");
        etapa = 2;
        return;
      }
      if (etapa === 2 && codigo === 334) {
        comando(socket, Buffer.from(EMAIL_ENVIO).toString("base64"));
        etapa = 3;
        return;
      }
      if (etapa === 3 && codigo === 334) {
        comando(socket, Buffer.from(senhaCaixa).toString("base64"));
        etapa = 4;
        return;
      }
      if (etapa === 4 && codigo === 235) {
        comando(socket, `MAIL FROM:<${EMAIL_ENVIO}>`);
        etapa = 5;
        return;
      }
      if (etapa === 4) return falha("A senha da caixa auxilialegis@marquestecnologies.com foi recusada.");
      if (etapa === 5 && codigo === 250) {
        comando(socket, `RCPT TO:<${destino}>`);
        etapa = 6;
        return;
      }
      if (etapa === 6 && (codigo === 250 || codigo === 251)) {
        comando(socket, "DATA");
        etapa = 7;
        return;
      }
      if (etapa === 7 && codigo === 354) {
        comando(socket, `${corpo}\r\n.`);
        etapa = 8;
        return;
      }
      if (etapa === 8 && codigo === 250) {
        clearTimeout(tempo);
        comando(socket, "QUIT");
        socket.end();
        resolve();
        return;
      }
      falha("O e-mail não foi aceito pelo servidor.");
    });
  });
}
