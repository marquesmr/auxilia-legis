import { createHmac, randomBytes } from "node:crypto";
import { getSql, copiarBancoAgora, puxarNuvem } from "@/lib/db";
import { botaoEmail, emailHtml, enviarEmail, urlDoSite } from "@/lib/email.server";
import { senhaDaCaixa } from "@/lib/senha-email.server";

function escapar(texto: string) {
  return texto
    .replace(/&/g, "&" + "amp;")
    .replace(/</g, "&" + "lt;")
    .replace(/>/g, "&" + "gt;")
    .replace(/"/g, "&" + "quot;");
}

function hashToken(token: string) {
  return createHmac("sha256", "convite-equipe").update(token).digest("hex");
}

async function garantirTabela() {
  const sql = await getSql();
  await sql`
    create table if not exists convite_link (
      token_hash text primary key,
      equipe_id text not null,
      email text not null,
      nome text not null,
      expira_em timestamptz not null
    )
  `;
  await sql`alter table convite_link add column if not exists token text`;
  await sql`alter table convite_link add column if not exists expira_iso text`;
  return sql;
}

function origemPublica(origem: string) {
  if (!origem || /localhost|127\.0\.0\.1|vercel\.app/i.test(origem)) return "https://auxilialegis.online";
  return origem.replace(/\/$/, "");
}

export async function enviarConviteEquipe(dados: { equipeId: string; email: string; nome: string; convidou: string }) {
  const sql = await garantirTabela();
  const equipe = await sql<{ nome: string }>`select nome from equipes where id = ${dados.equipeId}`;
  const nomeEquipe = equipe[0]?.nome?.trim() || "sua equipe";
  const senhaCaixa = await senhaDaCaixa();
  if (!senhaCaixa) {
    throw new Error("A caixa auxilialegis@marquestecnologies.com ainda não tem senha. Guarde-a na área restrita.");
  }
  const token = randomBytes(32).toString("hex");
  const tokenHash = hashToken(token);
  const expiraIso = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  await sql`delete from convite_link where equipe_id = ${dados.equipeId} and lower(email) = ${dados.email}`;
  await sql`
    insert into convite_link (token_hash, token, equipe_id, email, nome, expira_em, expira_iso)
    values (${tokenHash}, ${token}, ${dados.equipeId}, ${dados.email}, ${dados.nome}, ${expiraIso}, ${expiraIso})
  `;
  await copiarBancoAgora();
  const origem = origemPublica(await urlDoSite());
  const link = `${origem}/convite?token=${token}`;
  const convidou = escapar(dados.convidou.trim() || "um responsável da equipe");
  const corpo = `<p>Você acabou de ser adicionado(a) à equipe <strong>${escapar(nomeEquipe)}</strong> por <strong>${convidou}</strong> no Auxilia Legis.</p>
<p>A partir de agora, você tem acesso ao ambiente de trabalho compartilhado para acompanhar processos, gerenciar fluxos, colaborar e centralizar a rotina da sua equipe.</p>
<p>O que você pode fazer na plataforma:</p>
<ul>
<li><strong>Colaboração em tempo real:</strong> acesse documentos, notas técnicas e projetos compartilhados pela equipe.</li>
<li><strong>Acompanhamento integrado:</strong> monitore o andamento de processos administrativos e legislativos.</li>
<li><strong>Histórico centralizado:</strong> mantenha a comunicação e os registros de decisões seguros e organizados.</li>
</ul>
<p>Para ativar seu acesso e entrar no painel da equipe, clique no botão abaixo:</p>
${botaoEmail(link, "Acessar Minha Equipe")}
<p>Se o botão não funcionar, copie e cole este link no seu navegador:<br><a href="${escapar(link)}">${escapar(link)}</a></p>
<p>Este convite é válido por <strong>24 horas</strong>. Depois desse prazo, peça um novo à sua equipe.</p>
<p>Primeira vez no Auxilia Legis? Se você ainda não tem uma senha cadastrada, o link acima permitirá que você crie seus dados de acesso em menos de um minuto.</p>
<p>Caso tenha dúvidas ou não reconheça este convite, basta responder a este e-mail ou falar diretamente com o administrador da sua equipe.</p>`;
  await enviarEmail(
    dados.email,
    `Você foi adicionado à equipe ${nomeEquipe} no Auxilia Legis`,
    emailHtml(dados.nome, corpo, origem, "Atenciosamente"),
    senhaCaixa,
  );
  return { enviado: true as const };
}

async function acharConvite(token: string) {
  if (!/^[a-f0-9]{64}$/.test(token)) throw new Error("Este convite não é válido.");
  await puxarNuvem();
  const sql = await garantirTabela();
  const linhas = await sql<{ equipe_id: string; email: string; nome: string; expira_iso: string | null; expira_em: string }>`
    select equipe_id, email, nome, expira_iso, expira_em from convite_link
    where token = ${token} or token_hash = ${hashToken(token)}
    limit 1
  `;
  const convite = linhas[0];
  if (!convite) throw new Error("Este convite não foi encontrado. Peça um novo à sua equipe.");
  const limite = new Date(convite.expira_iso || convite.expira_em).getTime();
  if (!Number.isFinite(limite) || limite <= Date.now()) throw new Error("Este convite expirou. Peça um novo à sua equipe.");
  const equipe = await sql<{ nome: string }>`select nome from equipes where id = ${convite.equipe_id}`;
  return { sql, convite, equipe: equipe[0]?.nome?.trim() || "sua equipe" };
}

export async function lerConvite(token: string) {
  const { convite, equipe } = await acharConvite(token);
  return { nome: convite.nome, email: convite.email, equipe };
}

export async function abrirConvite(token: string) {
  const { sql, convite } = await acharConvite(token);
  const usuarios = await sql<{ id: string }>`select id from "user" where lower(email) = ${convite.email.toLowerCase()}`;
  if (usuarios[0]) {
    await sql`
      insert into equipe_membros (equipe_id, user_id, papel)
      values (${convite.equipe_id}, ${usuarios[0].id}, 'membro')
      on conflict (equipe_id, user_id) do nothing
    `;
    await sql`delete from equipe_convites where equipe_id = ${convite.equipe_id} and lower(email) = ${convite.email.toLowerCase()}`;
    await sql`delete from convite_link where token = ${token} or token_hash = ${hashToken(token)}`;
    await copiarBancoAgora();
    const { abrirSessaoConta } = await import("./cadastro-email.server");
    await abrirSessaoConta(usuarios[0].id);
    return { destino: "painel" as const, email: "", nome: "" };
  }
  return { destino: "criar" as const, email: convite.email, nome: convite.nome };
}

export async function listarConvitesPendentes() {
  const sql = await garantirTabela();
  const links = await sql<{ email: string; nome: string; equipe_id: string; equipe: string; expira_iso: string | null; expira_em: string }>`
    select c.email, c.nome, c.equipe_id, e.nome as equipe, c.expira_iso, c.expira_em
    from convite_link c
    join equipes e on e.id = c.equipe_id
    order by e.nome, c.email
  `;
  const guardados = await sql<{ email: string; nome: string | null; equipe_id: string; equipe: string }>`
    select c.email, c.nome, c.equipe_id, e.nome as equipe
    from equipe_convites c
    join equipes e on e.id = c.equipe_id
    order by e.nome, c.email
  `;
  const vistos = new Set(links.map((item) => `${item.equipe_id}:${item.email}`));
  const agora = Date.now();
  const lista = links.map((item) => {
    const limite = new Date(item.expira_iso || item.expira_em).getTime();
    return {
      email: item.email,
      nome: item.nome,
      equipeId: item.equipe_id,
      equipe: item.equipe,
      expiraEm: Number.isFinite(limite) ? new Date(limite).toISOString() : "",
      valido: Number.isFinite(limite) && limite > agora,
    };
  });
  for (const item of guardados) {
    if (vistos.has(`${item.equipe_id}:${item.email}`)) continue;
    lista.push({
      email: item.email,
      nome: item.nome?.trim() || item.email,
      equipeId: item.equipe_id,
      equipe: item.equipe,
      expiraEm: "",
      valido: true,
    });
  }
  return lista;
}

export async function cancelarConvitePendente(equipeId: string, email: string) {
  const sql = await garantirTabela();
  const limpo = email.trim().toLowerCase();
  await sql`delete from convite_link where equipe_id = ${equipeId} and lower(email) = ${limpo}`;
  await sql`delete from equipe_convites where equipe_id = ${equipeId} and lower(email) = ${limpo}`;
  await copiarBancoAgora();
  return { ok: true };
}
