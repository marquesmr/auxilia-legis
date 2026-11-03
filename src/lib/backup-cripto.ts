import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "node:crypto";

const PREFIXO = "ALENC1.";

function chave() {
  const direta = process.env.BACKUP_CRIPTO_CHAVE?.trim() ?? "";
  if (/^[a-f0-9]{64}$/i.test(direta)) return Buffer.from(direta, "hex");
  const segredo = process.env.BETTER_AUTH_SECRET?.trim() ?? "";
  if (segredo.length < 16) throw new Error("O sistema não tem chave para cifrar o backup.");
  return scryptSync(segredo, "auxilia-legis-backup-v1", 32);
}

export function cifrarBackup(texto: string) {
  const iv = randomBytes(12);
  const cifra = createCipheriv("aes-256-gcm", chave(), iv);
  const dados = Buffer.concat([cifra.update(texto, "utf8"), cifra.final()]);
  const tag = cifra.getAuthTag();
  return `${PREFIXO}${Buffer.concat([iv, tag, dados]).toString("base64url")}`;
}

export function abrirBackup(texto: string) {
  const limpo = texto.trim();
  if (!limpo.startsWith(PREFIXO)) return limpo;
  try {
    const bloco = Buffer.from(limpo.slice(PREFIXO.length), "base64url");
    const iv = bloco.subarray(0, 12);
    const tag = bloco.subarray(12, 28);
    const dados = bloco.subarray(28);
    const decifrador = createDecipheriv("aes-256-gcm", chave(), iv);
    decifrador.setAuthTag(tag);
    return Buffer.concat([decifrador.update(dados), decifrador.final()]).toString("utf8");
  } catch {
    throw new Error("Não foi possível abrir este backup.");
  }
}
