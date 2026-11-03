import { createHmac, randomBytes, randomInt, scrypt as scryptCb, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { idadeEm } from "@/lib/idade";
import { copiarBancoAgora, getSql, puxarNuvem } from "@/lib/db";
import { gravarTravaEmail, lerTravaEmail } from "@/lib/banco-nuvem";
import { botaoEmail, codigoEmail, emailHtml, enviarEmail, urlDoSite } from "@/lib/email.server";
import { senhaDaCaixa } from "@/lib/senha-email.server";

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

async function tabela(sql: Awaited<ReturnType<typeof getSql>>) {
  await sql`
    create table if not exists codigo_cadastro (
      email text primary key,
      codigo_hash text not null,
      expira_em timestamptz not null,
      tentativas int not null default 0,
      criado_em timestamptz not null default now()
    )
  `;
}

async function tabelaRestricao(sql: Awaited<ReturnType<typeof getSql>>) {
  await sql`
    create table if not exists email_restrito (
      email text primary key,
      nascimento date,
      restrito_ate timestamptz not null,
      criado_em timestamptz not null default now()
    )
  `;
}

function textoAte(ate: string) {
  const quando = new Date(ate).toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
  return `Este e-mail está restrito até ${quando}. Se errou a data, escreva para auxilialegis@marquestecnologies.com e envie um comprovante de que você tem 18 anos ou mais. A liberação antes do prazo só ocorre depois desse contato.`;
}

export async function barrarEmailRestrito(email: string, nascimento: string) {
  const idade = idadeEm(nascimento);
  if (idade == null || idade > 120) throw new Error("Escolha a data de nascimento.");
  const normal = email.trim().toLowerCase();
  const trava = await lerTravaEmail(normal);
  if (trava && new Date(trava.ate).getTime() > Date.now()) throw new Error(textoAte(trava.ate));
  const sql = await getSql();
  await puxarNuvem();
  await tabelaRestricao(sql);
  const ativo = await sql<{ restrito_ate: string }>`
    select restrito_ate from email_restrito where lower(email) = ${normal} and restrito_ate > now()
  `;
  if (ativo[0]) {
    const ate = new Date(ativo[0].restrito_ate).toISOString();
    await gravarTravaEmail(normal, nascimento, ate);
    throw new Error(textoAte(ate));
  }
  if (idade < 18) {
    const ate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    await gravarTravaEmail(normal, nascimento, ate);
    await sql`
      insert into email_restrito (email, nascimento, restrito_ate)
      values (${normal}, ${nascimento}, ${ate}::timestamptz)
      on conflict (email) do update
      set nascimento = excluded.nascimento,
          restrito_ate = greatest(email_restrito.restrito_ate, excluded.restrito_ate)
    `;
    await copiarBancoAgora();
    throw new Error(`Menor de 18 anos não cria conta. ${textoAte(ate)}`);
  }
}

export async function pedirCodigoCadastro(email: string, nome: string, nascimento: string) {
  const sql = await getSql();
  await tabela(sql);
  const existente = await sql<{ id: string }>`select id from "user" where lower(email) = ${email}`;
  if (existente[0]) throw new Error("Já existe uma conta com este e-mail.");
  await barrarEmailRestrito(email, nascimento);
  const senhaCaixa = await senhaDaCaixa();
  if (!senhaCaixa) {
    throw new Error("A caixa auxilialegis@marquestecnologies.com ainda não tem senha. Guarde-a na área restrita.");
  }
  const recente = await sql<{ recente: boolean }>`
    select criado_em > now() - interval '40 seconds' as recente
    from codigo_cadastro
    where email = ${email}
  `;
  if (recente[0]?.recente) throw new Error("Aguarde 40 segundos para pedir outro código.");
  const codigo = String(randomInt(0, 1_000_000)).padStart(6, "0");
  const hash = await hashCodigo(codigo);
  await sql`
    insert into codigo_cadastro (email, codigo_hash, expira_em, tentativas, criado_em)
    values (${email}, ${hash}, now() + interval '24 hours', 0, now())
    on conflict (email) do update
    set codigo_hash = excluded.codigo_hash, expira_em = excluded.expira_em, tentativas = 0, criado_em = now()
  `;
  await enviarEmail(
    email,
    "Quase lá! Confirme seu e-mail no Auxilia Legis",
    emailHtml(
      nome,
      `<p>Que bom ter você por aqui.</p>
<p>Para finalizar seu cadastro no <strong>Auxilia Legis</strong> e começar a usar a plataforma, é só confirmar seu e-mail usando o código abaixo:</p>
${codigoEmail(codigo)}
<p>O código fica válido por <strong>24 horas</strong>.</p>
<p>Se você não fez esse cadastro, pode ignorar este e-mail sem problemas.</p>
<p>Qualquer dúvida, estamos por aqui.</p>`,
      await urlDoSite(),
    ),
    senhaCaixa,
  );
  return { enviado: true };
}

export async function abrirSessaoConta(userId: string) {
  const { auth, SESSION_TOKEN_COOKIE } = await import("./auth/server");
  const ctx = await auth.$context;
  const session = await ctx.internalAdapter.createSession(userId);
  const bruto = session?.token;
  if (!bruto) throw new Error("Não foi possível entrar na conta criada.");
  const assinatura = createHmac("sha256", ctx.secret).update(bruto).digest("base64");
  const { setCookie } = await import("@tanstack/react-start/server");
  const maxAge = typeof ctx.sessionConfig?.expiresIn === "number" ? ctx.sessionConfig.expiresIn : 60 * 60 * 24 * 7;
  setCookie(SESSION_TOKEN_COOKIE, `${bruto}.${assinatura}`, {
    path: "/",
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge,
  });
  setCookie("__Host-grok-auth.session_data", "", {
    path: "/",
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: 0,
  });
}

export async function criarContaComCodigo(nome: string, email: string, senha: string, codigo: string, idade: number, nascimento: string) {
  const sql = await getSql();
  await tabela(sql);
  await barrarEmailRestrito(email, nascimento);
  const linhas = await sql<{ codigo_hash: string; tentativas: number; valido: boolean }>`
    select codigo_hash, tentativas, expira_em > now() as valido
    from codigo_cadastro
    where email = ${email}
  `;
  const item = linhas[0];
  if (!item || !item.valido) throw new Error("O código expirou. Peça outro.");
  if (item.tentativas >= 5) throw new Error("Muitas tentativas. Peça um código novo.");
  const ok = await codigoConfere(codigo, item.codigo_hash);
  if (!ok) {
    await sql`update codigo_cadastro set tentativas = tentativas + 1 where email = ${email}`;
    throw new Error("Código incorreto.");
  }
  const ja = await sql<{ id: string }>`select id from "user" where lower(email) = ${email}`;
  if (ja[0]) throw new Error("Já existe uma conta com este e-mail.");
  const { auth } = await import("./auth/server");
  const ctx = await auth.$context;
  const hash = await ctx.password.hash(senha);
  const usuario = await ctx.internalAdapter.createUser({
    email,
    name: nome,
    emailVerified: true,
  });
  if (!usuario?.id) throw new Error("Não foi possível criar a conta.");
  await sql`alter table "user" add column if not exists idade smallint`;
  await sql`alter table "user" add column if not exists nascimento date`;
  await sql`update "user" set idade = ${idade}, nascimento = ${nascimento} where id = ${usuario.id}`;
  await ctx.internalAdapter.linkAccount({
    userId: usuario.id,
    providerId: "credential",
    accountId: usuario.id,
    password: hash,
  });
  await sql`
    insert into termo_aceite (user_id, versao)
    values (${usuario.id}, '2026-10-29')
    on conflict (user_id) do update set versao = excluded.versao, aceito_em = now()
  `;
  await sql`delete from conta_excluida where lower(email) = ${email}`;
  await sql`delete from codigo_cadastro where email = ${email}`;
  await abrirSessaoConta(usuario.id);
  try {
    const senhaCaixa = await senhaDaCaixa();
    const origem = await urlDoSite();
    if (senhaCaixa) {
      let link = "";
      if (origem) {
        const token = randomBytes(32).toString("hex");
        const tokenHash = createHmac("sha256", "acesso-direto").update(token).digest("hex");
        await sql`
          create table if not exists acesso_direto (
            token_hash text primary key,
            user_id text not null,
            expira_em timestamptz not null
          )
        `;
        await sql`
          insert into acesso_direto (token_hash, user_id, expira_em)
          values (${tokenHash}, ${usuario.id}, now() + interval '24 hours')
        `;
        link = `${origem}/?acesso=${token}`;
      }
      await enviarEmail(
        email,
        "Sua conta no Auxilia Legis está pronta!",
        emailHtml(
          nome,
          `<p>Sua conta no <strong>Auxilia Legis</strong> foi criada com sucesso. Agora é só entrar e começar a usar.</p>
${link ? botaoEmail(link, "Abrir o Auxilia Legis") : "<p>Entre com o e-mail e a senha que você acabou de criar.</p>"}
<p>Lembre-se:</p>
<ul>
<li>Defina uma senha segura</li>
<li>Explore o que a plataforma tem para oferecer</li>
<li>Dê feedback do que podemos melhorar ou implementar</li>
</ul>
<p>Se precisar de ajuda com qualquer coisa, é só chamar. Estamos por aqui para te apoiar.</p>
<p>Bem-vindo(a)!</p>`,
          origem,
        ),
        senhaCaixa,
      );
    }
  } catch {
    /* a conta já existe; o aviso por e-mail não desfaz o cadastro */
  }
  return { ok: true };
}

export async function entrarPeloLink(token: string) {
  if (!/^[a-f0-9]{64}$/.test(token)) throw new Error("Este link não é válido. Entre com seu e-mail e senha.");
  const sql = await getSql();
  const tokenHash = createHmac("sha256", "acesso-direto").update(token).digest("hex");
  const linhas = await sql<{ user_id: string }>`
    select user_id from acesso_direto
    where token_hash = ${tokenHash} and expira_em > now()
    limit 1
  `;
  if (!linhas[0]) throw new Error("Este link expirou. Entre com seu e-mail e senha.");
  await sql`delete from acesso_direto where token_hash = ${tokenHash}`;
  await abrirSessaoConta(linhas[0].user_id);
  return { ok: true };
}
