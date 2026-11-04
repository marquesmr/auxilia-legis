import { createHmac, randomBytes } from "node:crypto";
import { getSql } from "@/lib/db";
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
  await sql`delete from convite_link where equipe_id = ${dados.equipeId} and lower(email) = ${dados.email}`;
  await sql`
    insert into convite_link (token_hash, equipe_id, email, nome, expira_em)
    values (${tokenHash}, ${dados.equipeId}, ${dados.email}, ${dados.nome}, now() + interval '14 days')
  `;
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

export async function abrirConvite(token: string) {
  if (!/^[a-f0-9]{64}$/.test(token)) throw new Error("Este convite não é válido.");
  const sql = await garantirTabela();
  const linhas = await sql<{ equipe_id: string; email: string; nome: string }>`
    select equipe_id, email, nome from convite_link
    where token_hash = ${hashToken(token)} and expira_em > now()
    limit 1
  `;
  const convite = linhas[0];
  if (!convite) throw new Error("Este convite expirou. Peça um novo à sua equipe.");
  const usuarios = await sql<{ id: string }>`select id from "user" where lower(email) = ${convite.email.toLowerCase()}`;
  if (usuarios[0]) {
    await sql`
      insert into equipe_membros (equipe_id, user_id, papel)
      values (${convite.equipe_id}, ${usuarios[0].id}, 'membro')
      on conflict (equipe_id, user_id) do nothing
    `;
    await sql`delete from equipe_convites where equipe_id = ${convite.equipe_id} and lower(email) = ${convite.email.toLowerCase()}`;
    await sql`delete from convite_link where token_hash = ${hashToken(token)}`;
    const { abrirSessaoConta } = await import("./cadastro-email.server");
    await abrirSessaoConta(usuarios[0].id);
    return { destino: "painel" as const, email: "", nome: "" };
  }
  return { destino: "criar" as const, email: convite.email, nome: convite.nome };
}
