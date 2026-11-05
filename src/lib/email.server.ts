import { connect as conectarTls, type TLSSocket } from "node:tls";
import { connect as conectarTcp } from "node:net";
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

function escapar(texto: string) {
  return texto
    .replace(/&/g, "&" + "amp;")
    .replace(/</g, "&" + "lt;")
    .replace(/>/g, "&" + "gt;")
    .replace(/"/g, "&" + "quot;");
}

export function emailHtml(nome: string, corpo: string, origem = "", fecho = "Abraço") {
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
<p style="margin:24px 0 0;">${escapar(fecho)},<br><strong>Equipe Auxilia Legis</strong></p>
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
  const limpo = assunto.replace(/[\r\n]+/g, " ").trim();
  if (/^[\x20-\x7E]*$/.test(limpo)) return limpo;
  const bytes = Buffer.from(limpo, "utf8");
  const partes: string[] = [];
  let inicio = 0;
  while (inicio < bytes.length) {
    let fim = Math.min(bytes.length, inicio + 45);
    while (fim > inicio && (bytes[fim] & 0xc0) === 0x80) fim -= 1;
    if (fim === inicio) fim = Math.min(bytes.length, inicio + 1);
    partes.push(`=?UTF-8?B?${bytes.subarray(inicio, fim).toString("base64")}?=`);
    inicio = fim;
  }
  return partes.join("\r\n ");
}

function quebrar(base64: string) {
  return base64.replace(/.{1,76}/g, (trecho) => `${trecho}\r\n`).trimEnd();
}

function textoPlano(html: string) {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<\/(h\d|li|tr|div)>/gi, "\n")
    .replace(/<li>/gi, "- ")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&/g, "&")
    .replace(/</g, "<")
    .replace(/>/g, ">")
    .replace(/"/g, '"')
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function montarMensagem(destino: string, assunto: string, html: string) {
  const limite = `auxilia-${randomBytes(12).toString("hex")}`;
  const texto = textoPlano(html);
  const miolo = [
    `--${limite}`,
    "Content-Type: text/plain; charset=UTF-8",
    "Content-Transfer-Encoding: base64",
    "",
    quebrar(Buffer.from(texto, "utf8").toString("base64")),
    `--${limite}`,
    "Content-Type: text/html; charset=UTF-8",
    "Content-Transfer-Encoding: base64",
    "",
    quebrar(Buffer.from(html, "utf8").toString("base64")),
    `--${limite}--`,
    "",
  ].join("\r\n");
  return [
    `From: Auxilia Legis <${EMAIL_ENVIO}>`,
    `To: ${destino}`,
    `Reply-To: ${EMAIL_ENVIO}`,
    `Date: ${new Date().toUTCString()}`,
    `Message-ID: <${randomBytes(16).toString("hex")}@auxilialegis.online>`,
    `Subject: ${assuntoCodificado(assunto)}`,
    "MIME-Version: 1.0",
    `Content-Type: multipart/alternative; boundary="${limite}"`,
    "",
    miolo,
  ].join("\r\n");
}

function rechearPontos(mensagem: string) {
  return mensagem
    .replace(/\r?\n/g, "\n")
    .split("\n")
    .map((linha) => (linha.startsWith(".") ? `.${linha}` : linha))
    .join("\r\n");
}

function lerResposta(buffer: string) {
  let cursor = 0;
  const linhas: string[] = [];
  while (cursor < buffer.length) {
    const fim = buffer.indexOf("\n", cursor);
    if (fim < 0) return null;
    const linha = buffer.slice(cursor, fim).replace(/\r$/, "");
    cursor = fim + 1;
    linhas.push(linha);
    if (linha.length >= 4 && linha[3] === " ") {
      const codigo = Number(linha.slice(0, 3));
      if (!Number.isFinite(codigo)) return null;
      return { codigo, texto: linhas.join(" | ").slice(0, 220), resto: buffer.slice(cursor) };
    }
    if (linha.length < 4 || linha[3] !== "-") return null;
  }
  return null;
}

function sessaoSmtp(socket: TLSSocket, destino: string, mensagem: string, senhaCaixa: string) {
  const dados = `${rechearPontos(mensagem)}\r\n.\r\n`;
  return new Promise<void>((resolve, reject) => {
    let etapa = 0;
    let buffer = "";
    let resolvido = false;
    const acabar = (erro?: Error) => {
      if (resolvido) return;
      resolvido = true;
      clearTimeout(tempo);
      socket.destroy();
      if (erro) reject(erro);
      else resolve();
    };
    const tempo = setTimeout(() => acabar(new Error("O servidor de e-mail não respondeu.")), 20000);
    const enviar = (texto: string) => {
      socket.write(texto.endsWith("\r\n") ? texto : `${texto}\r\n`);
    };
    const falha = (mensagemErro: string) => {
      console.error("[email]", mensagemErro);
      acabar(new Error(mensagemErro));
    };
    const consumir = () => {
      while (!resolvido) {
        const resposta = lerResposta(buffer);
        if (!resposta) return;
        buffer = resposta.resto;
        const { codigo, texto } = resposta;
        if (etapa === 0 && codigo === 220) {
          enviar("EHLO auxilialegis.online");
          etapa = 1;
          continue;
        }
        if (etapa === 1 && codigo === 250) {
          enviar("AUTH LOGIN");
          etapa = 2;
          continue;
        }
        if (etapa === 2 && codigo === 334) {
          enviar(Buffer.from(EMAIL_ENVIO).toString("base64"));
          etapa = 3;
          continue;
        }
        if (etapa === 3 && codigo === 334) {
          enviar(Buffer.from(senhaCaixa).toString("base64"));
          etapa = 4;
          continue;
        }
        if (etapa === 4 && codigo === 235) {
          enviar(`MAIL FROM:<${EMAIL_ENVIO}>`);
          etapa = 5;
          continue;
        }
        if (etapa === 4) return falha("A senha da caixa auxilialegis@marquestecnologies.com foi recusada.");
        if (etapa === 5 && codigo === 250) {
          enviar(`RCPT TO:<${destino}>`);
          etapa = 6;
          continue;
        }
        if (etapa === 6 && (codigo === 250 || codigo === 251)) {
          enviar("DATA");
          etapa = 7;
          continue;
        }
        if (etapa === 7 && codigo === 354) {
          enviar(dados);
          etapa = 8;
          continue;
        }
        if (etapa === 8 && codigo === 250) {
          resolvido = true;
          clearTimeout(tempo);
          enviar("QUIT");
          socket.end();
          resolve();
          return;
        }
        falha(`O e-mail não foi aceito pelo servidor (${codigo}).`);
        return;
      }
    };
    socket.on("error", () => falha("Não foi possível falar com o servidor de e-mail."));
    socket.on("data", (pedaço) => {
      buffer += pedaço.toString("utf8");
      consumir();
    });
  });
}

function enviarNaPorta465(destino: string, mensagem: string, senhaCaixa: string) {
  return new Promise<void>((resolve, reject) => {
    let resolvido = false;
    const socket = conectarTls({ host: SMTP_HOST, port: SMTP_PORT, servername: SMTP_HOST });
    const acabar = (erro?: Error) => {
      if (resolvido) return;
      resolvido = true;
      clearTimeout(tempo);
      if (erro) {
        socket.destroy();
        reject(erro);
        return;
      }
      resolve();
    };
    const tempo = setTimeout(() => acabar(new Error("O servidor de e-mail não respondeu.")), 20000);
    socket.once("secureConnect", () => {
      clearTimeout(tempo);
      sessaoSmtp(socket, destino, mensagem, senhaCaixa).then(
        () => acabar(),
        (erro: unknown) => acabar(erro instanceof Error ? erro : new Error("Não foi possível falar com o servidor de e-mail.")),
      );
    });
    socket.once("error", () => acabar(new Error("Não foi possível falar com o servidor de e-mail.")));
  });
}

function enviarNaPorta587(destino: string, mensagem: string, senhaCaixa: string) {
  return new Promise<void>((resolve, reject) => {
    const cru = conectarTcp({ host: SMTP_HOST, port: 587 });
    let buffer = "";
    let etapa = 0;
    let resolvido = false;
    const acabar = (erro?: Error) => {
      if (resolvido) return;
      resolvido = true;
      clearTimeout(tempo);
      cru.destroy();
      if (erro) reject(erro);
      else resolve();
    };
    const tempo = setTimeout(() => acabar(new Error("O servidor de e-mail não respondeu.")), 20000);
    const enviar = (texto: string) => cru.write(`${texto}\r\n`);
    cru.on("error", () => acabar(new Error("Não foi possível falar com o servidor de e-mail.")));
    cru.on("data", (pedaço) => {
      if (resolvido) return;
      buffer += pedaço.toString("utf8");
      const resposta = lerResposta(buffer);
      if (!resposta) return;
      buffer = resposta.resto;
      if (etapa === 0 && resposta.codigo === 220) {
        enviar("EHLO auxilialegis.online");
        etapa = 1;
        return;
      }
      if (etapa === 1 && resposta.codigo === 250) {
        enviar("STARTTLS");
        etapa = 2;
        return;
      }
      if (etapa === 2 && resposta.codigo === 220) {
        resolvido = true;
        clearTimeout(tempo);
        cru.removeAllListeners("data");
        cru.removeAllListeners("error");
        const seguro = conectarTls({ socket: cru, servername: SMTP_HOST });
        let entregue = false;
        const fechar = (erro?: Error) => {
          if (entregue) return;
          entregue = true;
          clearTimeout(tempoTls);
          if (erro) {
            seguro.destroy();
            reject(erro);
            return;
          }
          resolve();
        };
        const tempoTls = setTimeout(() => fechar(new Error("O servidor de e-mail não respondeu.")), 20000);
        seguro.once("secureConnect", () => {
          clearTimeout(tempoTls);
          sessaoSmtp(seguro, destino, mensagem, senhaCaixa).then(
            () => fechar(),
            (erro: unknown) => fechar(erro instanceof Error ? erro : new Error("Não foi possível falar com o servidor de e-mail.")),
          );
        });
        seguro.once("error", () => fechar(new Error("Não foi possível falar com o servidor de e-mail.")));
        return;
      }
      acabar(new Error("O e-mail não foi aceito pelo servidor."));
    });
  });
}

export function enviarEmail(destino: string, assunto: string, html: string, senhaCaixa: string) {
  const mensagem = montarMensagem(destino, assunto, html);
  return enviarNaPorta465(destino, mensagem, senhaCaixa).catch((erro: unknown) => {
    const texto = erro instanceof Error ? erro.message : "";
    if (!/falar com o servidor|não respondeu/i.test(texto)) throw erro;
    return enviarNaPorta587(destino, mensagem, senhaCaixa);
  });
}
