import { randomBytes, randomInt, scrypt as scryptCb, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { copiarBancoAgora, getSql, semPersistencia } from "@/lib/db";
import { decifrarSenhaCaixa, botaoEmail, codigoEmail, emailHtml, enviarEmail, urlDoSite } from "@/lib/email.server";

const scrypt = promisify(scryptCb);

async function hashCodigo(codigo: string) {
  const sal = randomBytes(16).toString("hex");
  const buf = (await scrypt(codigo, sal, 32)) as Buffer;
  return `scrypt$${sal}$${buf.toString("hex")}`;
}

async function codigoConfere(codigo: string, hash: string) {
  const partes = hash.split("$");
  if (partes.length !== 3 || partes[0] !== "scrypt") return false;
  const buf = (await scrypt(codigo, partes[1], 32)) as Buffer;
  const alvo = Buffer.from(partes[2], "hex");
  if (buf.length !== alvo.length) return false;
  return timingSafeEqual(buf, alvo);
}

export async function senhaDaCaixa() {
  const doAmbiente = process.env.SMTP_PASS?.trim();
  if (doAmbiente) return doAmbiente;
  const sql = await getSql();
  await sql`alter table gestao_config add column if not exists smtp_senha text`;
  const linhas = await sql<{ smtp_senha: string | null }>`
    select smtp_senha from gestao_config where id = 'principal'
  `;
  const guardado = linhas[0]?.smtp_senha;
  if (!guardado) return "";
  try {
    return decifrarSenhaCaixa(guardado);
  } catch {
    return "";
  }
}

export async function pedirCodigoSenha(email: string) {
  const sql = await getSql();
  await sql`alter table gestao_config add column if not exists smtp_senha text`;
  const senhaCaixa = await senhaDaCaixa();
  if (!senhaCaixa) {
    throw new Error("A caixa auxilialegis@marquestecnologies.com ainda não tem senha. Guarde-a na área restrita.");
  }
  const usuarios = await sql<{ id: string; name: string | null }>`
    select id, name from "user" where lower(email) = ${email}
  `;
  if (!usuarios[0]) return { enviado: true };
  const codigo = String(randomInt(0, 1_000_000)).padStart(6, "0");
  const hash = await hashCodigo(codigo);
  await semPersistencia(async () => {
    const recente = await sql<{ recente: boolean }>`
      select criado_em > now() - interval '40 seconds' as recente
      from codigo_senha
      where email = ${email}
    `;
    if (recente[0]?.recente) throw new Error("Aguarde 40 segundos para pedir outro código.");
    await sql`
      insert into codigo_senha (email, codigo_hash, expira_em, tentativas, criado_em)
      values (${email}, ${hash}, now() + interval '5 minutes', 0, now())
      on conflict (email) do update
      set codigo_hash = excluded.codigo_hash, expira_em = excluded.expira_em, tentativas = 0, criado_em = now()
    `;
  });
  const origem = await urlDoSite();
  const link = origem ? `${origem}/?senha=1&email=${encodeURIComponent(email)}&codigo=${codigo}` : "";
  await enviarEmail(
    email,
    "Vamos redefinir sua senha no Auxilia Legis",
    emailHtml(
      usuarios[0].name || "",
      `<p>Recebemos um pedido para redefinir a senha da sua conta no <strong>Auxilia Legis</strong>.</p>
<p>Para criar uma nova senha, é só clicar aqui:</p>
${link ? botaoEmail(link, "Redefinir minha senha") : ""}
<p>Caso não funcione, é só digitar o código:</p>
${codigoEmail(codigo)}
<p>O link e o código são válidos por <strong>5 minutos</strong> por segurança.</p>
<p>Se você não pediu essa alteração, pode ignorar este e-mail. Sua conta continua protegida.</p>
<p>Qualquer coisa, conte com a gente.</p>`,
      origem,
    ),
    senhaCaixa,
  );
  try {
    await copiarBancoAgora();
  } catch (err) {
    console.error("[senha] banco não copiado depois do e-mail", err);
  }
  return { enviado: true };
}

export async function redefinirComCodigo(email: string, codigo: string, senha: string) {
  const sql = await getSql();
  const linhas = await sql<{ codigo_hash: string; tentativas: number; valido: boolean }>`
    select codigo_hash, tentativas, expira_em > now() as valido
    from codigo_senha
    where email = ${email}
  `;
  const item = linhas[0];
  if (!item || !item.valido) throw new Error("O código expirou. Peça outro.");
  if (item.tentativas >= 5) throw new Error("Muitas tentativas. Peça um código novo.");
  const ok = await codigoConfere(codigo, item.codigo_hash);
  if (!ok) {
    await sql`update codigo_senha set tentativas = tentativas + 1 where email = ${email}`;
    throw new Error("Código incorreto.");
  }
  const usuarios = await sql<{ id: string }>`select id from "user" where lower(email) = ${email}`;
  const userId = usuarios[0]?.id;
  if (!userId) throw new Error("Não há conta com este e-mail.");
  const { auth } = await import("./auth/server");
  const ctx = await auth.$context;
  const hash = await ctx.password.hash(senha);
  const contas = await ctx.internalAdapter.findAccounts(userId);
  const credencial = contas?.find((conta) => conta.providerId === "credential");
  if (credencial) await ctx.internalAdapter.updatePassword(userId, hash);
  else {
    await ctx.internalAdapter.createAccount({
      userId,
      providerId: "credential",
      accountId: userId,
      password: hash,
    });
  }
  await sql`delete from "session" where "userId" = ${userId}`;
  await sql`delete from codigo_senha where email = ${email}`;
  return { ok: true };
}
