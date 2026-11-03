import { randomBytes, scrypt as scryptCb, timingSafeEqual } from "node:crypto";
import { readFileSync, statfsSync } from "node:fs";
import { cpus, freemem, totalmem } from "node:os";
import { promisify } from "node:util";
import { abrirBackup, cifrarBackup } from "@/lib/backup-cripto";
import { copiarBancoAgora, getSql, lerTrafego, puxarNuvem, semPersistencia, type Sql } from "@/lib/db";
import { motivoExclusao } from "@/lib/motivos-exclusao";

const scrypt = promisify(scryptCb);
const EMAIL_INICIAL = "gestor@auxilialegis.app";
const SENHA_INICIAL = "Legis-Gestao-4821";

export type AbaCatalogo = {
  id: string;
  area: "legislativo" | "administrativo";
  nome: string;
  ordem: number;
  ativa: boolean;
  fixa: boolean;
};

export type RegistroUso = {
  id: string;
  nome: string;
  email: string;
  acao: string;
  detalhe: string;
  em: string;
};

export type PessoaPainel = {
  id: string;
  nome: string;
  email: string;
  criadoEm: string;
  vistoEm: string | null;
  ativo: boolean;
  papel: string;
  bloqueado: boolean;
};

async function hashSenha(senha: string) {
  const sal = randomBytes(16).toString("hex");
  const buf = (await scrypt(senha, sal, 32)) as Buffer;
  return `scrypt$${sal}$${buf.toString("hex")}`;
}

async function senhaConfere(senha: string, hash: string) {
  const partes = hash.split("$");
  if (partes.length !== 3 || partes[0] !== "scrypt") return false;
  const buf = (await scrypt(senha, partes[1], 32)) as Buffer;
  const alvo = Buffer.from(partes[2], "hex");
  if (buf.length !== alvo.length) return false;
  return timingSafeEqual(buf, alvo);
}

export function nomeAbaOk(nome: string) {
  return nome.length >= 2 && nome.length <= 40 && /^[\p{L}\p{N}][\p{L}\p{N} .\/'-]*$/u.test(nome);
}

export async function garantirGestao(sql: Sql) {
  const existente = await sql<{ id: string }>`select id from gestao_acesso where id = 'principal'`;
  if (existente.length) return;
  const senhaHash = await hashSenha(SENHA_INICIAL);
  await sql`
    insert into gestao_acesso (id, email, senha_hash, troca_pendente)
    values ('principal', ${EMAIL_INICIAL}, ${senhaHash}, true)
    on conflict (id) do nothing
  `;
}

async function sessaoOk(sql: Sql, token: string) {
  if (!/^[a-f0-9]{64}$/.test(token)) return false;
  const linhas = await sql<{ ok: number }>`
    select 1 as ok from gestao_sessoes
    where token = ${token} and expira_em > now()
  `;
  return linhas.length > 0;
}

export async function exigirGestao(token: string) {
  const sql = await getSql();
  await garantirGestao(sql);
  if (!(await sessaoOk(sql, token))) throw new Error("Entre de novo na área restrita.");
  return sql;
}

async function abrirSessaoGestao(sql: Sql, userId: string | null = null) {
  const token = randomBytes(32).toString("hex");
  await sql`
    insert into gestao_sessoes (token, expira_em, user_id)
    values (${token}, now() + interval '12 hours', ${userId})
  `;
  await sql`delete from gestao_sessoes where expira_em <= now()`;
  return { token };
}

export async function entrarGestao(email: string, senha: string) {
  const sql = await getSql();
  await garantirGestao(sql);
  const linhas = await sql<{ email: string; senha_hash: string }>`
    select email, senha_hash from gestao_acesso where id = 'principal'
  `;
  const acesso = linhas[0];
  const mesmoGestor =
    Boolean(acesso) &&
    acesso.email.toLowerCase() === email.trim().toLowerCase() &&
    (await senhaConfere(senha, acesso.senha_hash));
  if (mesmoGestor) return abrirSessaoGestao(sql);
  const comoAdministrador = await entrarComoAdministrador(sql, email, senha);
  if (comoAdministrador) return comoAdministrador;
  throw new Error("E-mail ou senha não conferem.");
}

async function entrarComoAdministrador(sql: Sql, email: string, senha: string) {
  const usuarios = await sql<{ id: string }>`
    select u.id
    from "user" u
    join usuario_perfil p on p.user_id = u.id
    where lower(u.email) = ${email.trim().toLowerCase()}
      and p.papel = 'administrador'
      and p.bloqueado = false
  `;
  const userId = usuarios[0]?.id;
  if (!userId) return null;
  const contas = await sql<{ password: string | null }>`
    select password from "account" where "userId" = ${userId} and "providerId" = 'credential' limit 1
  `;
  const hash = contas[0]?.password;
  if (!hash) return null;
  const { auth } = await import("./auth/server");
  const ctx = await auth.$context;
  const ok = await ctx.password.verify({ password: senha, hash });
  if (!ok) return null;
  return abrirSessaoGestao(sql, userId);
}

export async function sairGestao(token: string) {
  const sql = await getSql();
  if (/^[a-f0-9]{64}$/.test(token)) await sql`delete from gestao_sessoes where token = ${token}`;
  return { ok: true };
}

export async function abrirGestaoPelaConta(userId: string) {
  const sql = await getSql();
  await garantirGestao(sql);
  await garantirConfig(sql);
  const cfg = await sql<{ manutencao: boolean }>`select manutencao from gestao_config where id = 'principal'`;
  if (!marcado(cfg[0]?.manutencao)) throw new Error("Fora da manutenção, a área restrita pede a senha.");
  const perfil = await sql<{ papel: string; bloqueado: boolean }>`
    select papel, bloqueado from usuario_perfil where user_id = ${userId}
  `;
  if (perfil[0]?.papel !== "administrador" || perfil[0]?.bloqueado) throw new Error("Só o administrador entra por aqui.");
  return abrirSessaoGestao(sql, userId);
}

export async function abrirSistemaPelaGestao(token: string) {
  const sql = await getSql();
  if (!/^[a-f0-9]{64}$/.test(token)) throw new Error("Sessão encerrada.");
  const sessoes = await sql<{ user_id: string | null }>`
    select user_id from gestao_sessoes where token = ${token} and expira_em > now()
  `;
  if (!sessoes.length) throw new Error("Sessão encerrada.");
  await garantirConfig(sql);
  const cfg = await sql<{ manutencao: boolean }>`select manutencao from gestao_config where id = 'principal'`;
  if (!marcado(cfg[0]?.manutencao)) return { ok: true };
  let userId = sessoes[0]?.user_id ?? null;
  if (!userId) {
    const acesso = await sql<{ email: string }>`select email from gestao_acesso where id = 'principal'`;
    const email = acesso[0]?.email?.toLowerCase() ?? "";
    if (email) {
      const usuarios = await sql<{ id: string }>`
        select u.id
        from "user" u
        join usuario_perfil p on p.user_id = u.id
        where lower(u.email) = ${email} and p.papel = 'administrador' and p.bloqueado = false
        limit 1
      `;
      userId = usuarios[0]?.id ?? null;
    }
  }
  if (!userId) {
    const { getSessionUser } = await import("./auth/verify.server");
    const atual = await getSessionUser().catch(() => null);
    if (atual?.id) {
      const sessao = await sql<{ papel: string; bloqueado: boolean }>`
        select papel, bloqueado from usuario_perfil where user_id = ${atual.id}
      `;
      if (sessao[0]?.papel === "administrador" && !sessao[0]?.bloqueado) return { ok: true };
    }
    throw new Error("Abra o sistema com a conta de administrador.");
  }
  const perfil = await sql<{ papel: string; bloqueado: boolean }>`
    select papel, bloqueado from usuario_perfil where user_id = ${userId}
  `;
  if (perfil[0]?.papel !== "administrador" || perfil[0]?.bloqueado) throw new Error("Abra o sistema com a conta de administrador.");
  await emitirSessaoAplicativo(userId);
  return { ok: true };
}

async function emitirSessaoAplicativo(userId: string) {
  const { createHmac } = await import("node:crypto");
  const { auth, SESSION_TOKEN_COOKIE } = await import("./auth/server");
  const ctx = await auth.$context;
  const session = await ctx.internalAdapter.createSession(userId);
  const bruto = session?.token;
  if (!bruto) throw new Error("Não foi possível abrir o sistema.");
  const segredo = ctx.secret;
  const assinatura = createHmac("sha256", segredo).update(bruto).digest("base64");
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

export async function anotarUso(userId: string, acao: string, detalhe: string) {
  const sql = await getSql();
  const eu = await sql<{ name: string | null; email: string | null }>`
    select name, email from "user" where id = ${userId}
  `;
  const nome = (eu[0]?.name || "Sem nome").slice(0, 80);
  const email = (eu[0]?.email || "").slice(0, 160);
  await sql`
    insert into uso_registros (id, user_id, nome, email, acao, detalhe)
    values (${crypto.randomUUID()}, ${userId}, ${nome}, ${email}, ${acao.slice(0, 80)}, ${detalhe.slice(0, 240)})
  `;
  await sql`
    delete from uso_registros
    where id in (
      select id from uso_registros order by criado_em desc offset 2000
    )
  `;
}

export async function marcarPresencaDe(userId: string) {
  const sql = await getSql();
  const eu = await sql<{ name: string | null; email: string | null }>`
    select name, email from "user" where id = ${userId}
  `;
  const nome = (eu[0]?.name || "Sem nome").slice(0, 80);
  const email = (eu[0]?.email || "").slice(0, 160);
  await sql`
    insert into presenca (user_id, nome, email, visto_em)
    values (${userId}, ${nome}, ${email}, now())
    on conflict (user_id) do update
      set nome = excluded.nome, email = excluded.email, visto_em = now()
      where presenca.visto_em < now() - interval '90 seconds'
  `;
}

export async function conferirAba(area: "legislativo" | "administrativo", nome: string) {
  const fixos =
    area === "legislativo"
      ? ["Requerimentos", "Projetos de Lei", "Indicações", "Outros"]
      : [
          "Pregão",
          "Concorrência",
          "Concurso",
          "Leilão",
          "Diálogo Competitivo",
          "Dispensa de Licitação",
          "Inexigibilidade de Licitação",
          "Pronto Pagamento",
          "Doação",
          "Outros",
        ];
  if (fixos.includes(nome)) return;
  const sql = await getSql();
  const linhas = await sql<{ ok: number }>`
    select 1 as ok from abas_catalogo
    where area = ${area} and nome = ${nome} and ativa = true
  `;
  if (!linhas.length) throw new Error("Tipo inválido");
}

export async function abasAtivas() {
  const sql = await getSql();
  const linhas = await sql<{ area: string; nome: string }>`
    select area, nome from abas_catalogo where ativa = true order by ordem asc, nome asc
  `;
  return {
    legislativo: linhas.filter((item) => item.area === "legislativo").map((item) => item.nome),
    administrativo: linhas.filter((item) => item.area === "administrativo").map((item) => item.nome),
  };
}

export async function lerPainel() {
  await puxarNuvem();
  const sql = await getSql();
  await garantirGestao(sql);
  await garantirConfig(sql);
  try {
    await backupAutomatico(sql);
  } catch {
    /* o painel abre mesmo se o backup automático falhar */
  }
  const acesso = await sql<{ email: string; troca_pendente: boolean }>`
    select email, troca_pendente from gestao_acesso where id = 'principal'
  `;
  const ativos = await sql<{ n: number }>`
    select count(*)::int as n from presenca where visto_em > now() - interval '2 minutes'
  `;
  const usuarios = await sql<{ n: number }>`select count(*)::int as n from "user"`;
  const sessoes = await sql<{ n: number }>`select count(*)::int as n from "session" where "expiresAt" > now()`;
  const legislativos = await sql<{ n: number }>`select count(*)::int as n from processos`;
  const administrativos = await sql<{ n: number }>`select count(*)::int as n from processos_admin`;
  const equipes = await sql<{ n: number }>`select count(*)::int as n from equipes`;
  const pessoas = await sql<{ id: string; nome: string; email: string; criado_em: string; visto_em: string | null; ativo: boolean; papel: string; bloqueado: boolean }>`
    select u.id, u.name as nome, u.email, u."createdAt" as criado_em, p.visto_em,
      (p.visto_em > now() - interval '2 minutes') as ativo,
      coalesce(up.papel, 'operador') as papel,
      coalesce(up.bloqueado, false) as bloqueado
    from "user" u
    left join presenca p on p.user_id = u.id
    left join usuario_perfil up on up.user_id = u.id
    order by p.visto_em desc nulls last, u."createdAt" desc
    limit 80
  `;
  const registros = await sql<{ id: string; nome: string; email: string; acao: string; detalhe: string; em: string }>`
    select id, nome, email, acao, detalhe, criado_em as em
    from uso_registros
    order by criado_em desc
    limit 40
  `;
  const abas = await sql<AbaCatalogo & { uso: number }>`
    select a.id, a.area, a.nome, a.ordem, a.ativa, a.fixa,
      (
        case when a.area = 'legislativo'
          then (select count(*) from processos p where p.tipo = a.nome)
          else (select count(*) from processos_admin p where p.tipo = a.nome)
        end
      )::int as uso
    from abas_catalogo a
    order by a.area asc, a.ordem asc, a.nome asc
  `;
  const presentes = await sql<{ nome: string; email: string; visto_em: string }>`
    select nome, email, visto_em from presenca
    where visto_em > now() - interval '2 minutes'
    order by visto_em desc
  `;
  const prazosLeg = await sql<{ hoje: number; atraso: number; semana: number }>`
    select
      count(*) filter (where prazo = current_date)::int as hoje,
      count(*) filter (where prazo < current_date)::int as atraso,
      count(*) filter (where prazo > current_date and prazo <= current_date + 7)::int as semana
    from processos
    where status <> 'concluido'
      and not exists (
        select 1 from status_catalogo sc
        where sc.area = 'legislativo' and sc.codigo = status and sc.encerra
      )
  `;
  const prazosAdm = await sql<{ hoje: number; atraso: number; semana: number }>`
    select
      count(*) filter (where ref = current_date)::int as hoje,
      count(*) filter (where ref < current_date)::int as atraso,
      count(*) filter (where ref > current_date and ref <= current_date + 7)::int as semana
    from (
      select case
        when status = 'execucao' then coalesce(vigencia_fim, previsao_etapa, encerramento)
        else coalesce(previsao_etapa, encerramento)
      end as ref
      from processos_admin
      where status not in ('encerrado', 'cancelado')
        and not exists (
          select 1 from status_catalogo sc
          where sc.area = 'administrativo' and sc.codigo = status and sc.encerra
        )
        and tipo not in ('Doação', 'Outros')
    ) p
    where ref is not null
  `;
  const gargalosEquipe = await sql<{ grupo: string; n: number }>`
    select grupo, sum(n)::int as n from (
      select coalesce(e.nome, 'Sem equipe') as grupo, count(*)::int as n
      from processos p
      left join equipes e on e.id = p.team_id
      where p.status <> 'concluido'
        and not exists (
          select 1 from status_catalogo sc
          where sc.area = 'legislativo' and sc.codigo = p.status and sc.encerra
        )
        and p.prazo < current_date
      group by 1
      union all
      select coalesce(e.nome, 'Sem equipe'), count(*)::int
      from processos_admin p
      left join equipes e on e.id = p.team_id
      where p.status not in ('encerrado', 'cancelado')
        and not exists (
          select 1 from status_catalogo sc
          where sc.area = 'administrativo' and sc.codigo = p.status and sc.encerra
        )
        and p.tipo not in ('Doação', 'Outros')
        and coalesce(case when p.status = 'execucao' then p.vigencia_fim else p.previsao_etapa end, p.encerramento) < current_date
      group by 1
    ) s
    group by grupo
    order by n desc
    limit 6
  `;
  const gargalosTipo = await sql<{ grupo: string; n: number }>`
    select grupo, sum(n)::int as n from (
      select tipo as grupo, count(*)::int as n
      from processos
      where status <> 'concluido'
        and not exists (
          select 1 from status_catalogo sc
          where sc.area = 'legislativo' and sc.codigo = status and sc.encerra
        )
        and prazo < current_date
      group by tipo
      union all
      select tipo, count(*)::int
      from processos_admin
      where status not in ('encerrado', 'cancelado')
        and not exists (
          select 1 from status_catalogo sc
          where sc.area = 'administrativo' and sc.codigo = status and sc.encerra
        )
        and tipo not in ('Doação', 'Outros')
        and coalesce(case when status = 'execucao' then vigencia_fim else previsao_etapa end, encerramento) < current_date
      group by tipo
    ) s
    group by grupo
    order by n desc
    limit 6
  `;
  const equipesLinhas = await sql<{ equipe_id: string; equipe: string; user_id: string | null; nome: string | null; email: string | null; papel: string | null }>`
    select e.id as equipe_id, e.nome as equipe, u.id as user_id, u.name as nome, u.email, m.papel
    from equipes e
    left join equipe_membros m on m.equipe_id = e.id
    left join "user" u on u.id = m.user_id
    order by e.nome asc, u.name asc
  `;
  const config = await sql<{ manutencao: boolean; backup_em: string | null; backup_auto_em: string | null; smtp_senha: string | null }>`
    select manutencao, backup_em, backup_auto_em, smtp_senha from gestao_config where id = 'principal'
  `;
  const feriados = await sql<{ id: string; inicio: string; fim: string; nome: string; tipo: string }>`
    select id, inicio, fim, nome, tipo from feriados order by inicio asc
  `;
  const equipesMapa = new Map<string, { id: string; nome: string; membros: { id: string; nome: string; email: string; papel: string }[] }>();
  for (const linha of equipesLinhas) {
    const equipe = equipesMapa.get(linha.equipe_id) ?? { id: linha.equipe_id, nome: linha.equipe, membros: [] };
    if (linha.user_id) {
      equipe.membros.push({
        id: linha.user_id,
        nome: linha.nome || "Sem nome",
        email: linha.email || "",
        papel: linha.papel || "membro",
      });
    }
    equipesMapa.set(linha.equipe_id, equipe);
  }
  const somar = (campo: "hoje" | "atraso" | "semana") => Number(prazosLeg[0]?.[campo] ?? 0) + Number(prazosAdm[0]?.[campo] ?? 0);
  return {
    email: acesso[0]?.email ?? EMAIL_INICIAL,
    trocaPendente: Boolean(acesso[0]?.troca_pendente),
    ativos: Number(ativos[0]?.n ?? 0),
    usuarios: Number(usuarios[0]?.n ?? 0),
    sessoes: Number(sessoes[0]?.n ?? 0),
    legislativos: Number(legislativos[0]?.n ?? 0),
    administrativos: Number(administrativos[0]?.n ?? 0),
    equipes: Number(equipes[0]?.n ?? 0),
    pessoas: pessoas.map((pessoa) => ({
      id: pessoa.id,
      nome: pessoa.nome,
      email: pessoa.email,
      criadoEm: pessoa.criado_em,
      vistoEm: pessoa.visto_em,
      ativo: Boolean(pessoa.ativo),
      papel: pessoa.papel || "operador",
      bloqueado: Boolean(pessoa.bloqueado),
    })) satisfies PessoaPainel[],
    registros: registros.map((item) => ({ ...item, em: String(item.em) })) satisfies RegistroUso[],
    presentes: presentes.map((item) => ({ nome: item.nome, email: item.email, vistoEm: String(item.visto_em) })),
    abas,
    maquina: lerMaquina(),
    prazos: { hoje: somar("hoje"), atraso: somar("atraso"), semana: somar("semana") },
    gargalosEquipe: gargalosEquipe.map((item) => ({ grupo: item.grupo, n: Number(item.n) })),
    gargalosTipo: gargalosTipo.map((item) => ({ grupo: item.grupo, n: Number(item.n) })),
    equipesPainel: [...equipesMapa.values()],
    config: {
      manutencao: marcado(config[0]?.manutencao),
      backupEm: config[0]?.backup_em ? String(config[0].backup_em) : null,
      backupAutoEm: config[0]?.backup_auto_em ? String(config[0].backup_auto_em) : null,
      emailPronto: Boolean(process.env.SMTP_PASS?.trim() || config[0]?.smtp_senha),
    },
    feriados: feriados.map((item) => ({ ...item, inicio: String(item.inicio).slice(0, 10), fim: String(item.fim).slice(0, 10) })),
    status: await listarStatusCatalogo(),
  };
}

export async function criarAba(area: "legislativo" | "administrativo", nome: string) {
  const sql = await getSql();
  const limpo = nome.trim().replace(/\s+/g, " ");
  if (!nomeAbaOk(limpo)) throw new Error("Use um nome curto, só com letras e números.");
  const ordem = await sql<{ n: number }>`select coalesce(max(ordem), 0)::int as n from abas_catalogo where area = ${area}`;
  await sql`
    insert into abas_catalogo (id, area, nome, ordem, ativa, fixa)
    values (${crypto.randomUUID()}, ${area}, ${limpo}, ${Number(ordem[0]?.n ?? 0) + 1}, true, false)
    on conflict (area, nome) do update set ativa = true
  `;
  return { nome: limpo };
}

function codigoDoNome(nome: string) {
  const base = nome
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
  return base.length >= 2 ? base : "";
}

export function marcado(valor: unknown) {
  return valor === true || valor === "t" || valor === "true" || valor === 1 || valor === "1";
}

export async function listarStatusCatalogo() {
  const sql = await getSql();
  const linhas = await sql<{
    id: string;
    area: string;
    codigo: string;
    nome: string;
    ordem: number;
    encerra: boolean;
    fixo: boolean;
    tramite_dias: number | null;
    tramite_codigo: string | null;
  }>`
    select id, area, codigo, nome, ordem, encerra, fixo, tramite_dias, tramite_codigo
    from status_catalogo
    order by area asc, ordem asc, nome asc
  `;
  return linhas.map((linha) => ({
    id: linha.id,
    area: linha.area === "administrativo" ? ("administrativo" as const) : ("legislativo" as const),
    codigo: linha.codigo,
    nome: linha.nome,
    ordem: Number(linha.ordem),
    encerra: marcado(linha.encerra),
    fixo: marcado(linha.fixo),
    tramiteDias: linha.tramite_dias == null ? null : Number(linha.tramite_dias),
    tramiteCodigo: linha.tramite_codigo,
  }));
}

export async function criarStatus(entrada: {
  area: "legislativo" | "administrativo";
  nome: string;
  encerra: boolean;
  tramiteDias: number | null;
  tramiteCodigo: string | null;
}) {
  const nome = entrada.nome.trim().replace(/\s+/g, " ").slice(0, 60);
  if (nome.length < 2) throw new Error("Dê um nome ao status.");
  const codigo = codigoDoNome(nome);
  if (!codigo) throw new Error("Use um nome com letras ou números.");
  const sql = await getSql();
  const existe = await sql<{ id: string }>`select id from status_catalogo where area = ${entrada.area} and codigo = ${codigo}`;
  if (existe.length) throw new Error("Já existe um status com esse nome.");
  const ordem = await sql<{ n: number }>`select coalesce(max(ordem), 0)::int as n from status_catalogo where area = ${entrada.area}`;
  const tramite = await tramiteOk(sql, entrada.area, codigo, entrada.tramiteDias, entrada.tramiteCodigo);
  await sql`
    insert into status_catalogo (id, area, codigo, nome, ordem, encerra, fixo, tramite_dias, tramite_codigo)
    values (
      ${crypto.randomUUID()}, ${entrada.area}, ${codigo}, ${nome}, ${Number(ordem[0]?.n ?? 0) + 1},
      ${entrada.encerra}, false, ${tramite.dias}, ${tramite.codigo}
    )
  `;
  return { codigo };
}

export async function editarStatus(entrada: {
  id: string;
  nome: string;
  encerra: boolean;
  tramiteDias: number | null;
  tramiteCodigo: string | null;
}) {
  const nome = entrada.nome.trim().replace(/\s+/g, " ").slice(0, 60);
  if (nome.length < 2) throw new Error("Dê um nome ao status.");
  const sql = await getSql();
  const atual = await sql<{ area: string; codigo: string; fixo: boolean }>`
    select area, codigo, fixo from status_catalogo where id = ${entrada.id}
  `;
  if (!atual.length) throw new Error("Status não encontrado.");
  const area = atual[0].area === "administrativo" ? "administrativo" : "legislativo";
  const encerraFixo = atual[0].codigo === "concluido" || atual[0].codigo === "encerrado" || atual[0].codigo === "cancelado";
  const tramite = await tramiteOk(sql, area, atual[0].codigo, entrada.tramiteDias, entrada.tramiteCodigo);
  await sql`
    update status_catalogo
    set nome = ${nome},
        encerra = ${encerraFixo ? true : entrada.encerra},
        tramite_dias = ${tramite.dias},
        tramite_codigo = ${tramite.codigo}
    where id = ${entrada.id}
  `;
  return { ok: true };
}

async function tramiteOk(
  sql: Awaited<ReturnType<typeof getSql>>,
  area: "legislativo" | "administrativo",
  codigo: string,
  dias: number | null,
  destino: string | null,
) {
  if (area !== "administrativo" || (dias == null && !destino)) return { dias: null, codigo: null };
  if (dias == null || !destino) throw new Error("Informe os dias e o status de destino do trâmite.");
  if (!Number.isInteger(dias) || dias < 1 || dias > 3650) throw new Error("Informe de 1 a 3650 dias para o trâmite.");
  if (destino === codigo) throw new Error("O trâmite precisa ir para outro status.");
  const existe = await sql<{ id: string }>`
    select id from status_catalogo where area = 'administrativo' and codigo = ${destino}
  `;
  if (!existe.length) throw new Error("Escolha o status de destino do trâmite.");
  return { dias, codigo: destino };
}

export async function alternarAba(id: string, ativa: boolean) {
  const sql = await getSql();
  const linhas = await sql<{ fixa: boolean }>`select fixa from abas_catalogo where id = ${id}`;
  if (!linhas.length) throw new Error("Aba não encontrada.");
  if (linhas[0].fixa && !ativa) throw new Error("As abas originais permanecem. Crie uma nova ao lado.");
  await sql`update abas_catalogo set ativa = ${ativa} where id = ${id}`;
  return { ok: true };
}

export async function trocarAcesso(email: string, senhaAtual: string, senhaNova: string) {
  const sql = await getSql();
  const linhas = await sql<{ senha_hash: string }>`select senha_hash from gestao_acesso where id = 'principal'`;
  if (!linhas.length || !(await senhaConfere(senhaAtual, linhas[0].senha_hash))) {
    throw new Error("A senha atual não confere.");
  }
  const limpo = email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(limpo)) throw new Error("E-mail inválido.");
  if (senhaNova.length < 8) throw new Error("A nova senha precisa ter pelo menos 8 caracteres.");
  const senhaHash = await hashSenha(senhaNova);
  await sql`
    update gestao_acesso
    set email = ${limpo}, senha_hash = ${senhaHash}, troca_pendente = false, atualizado_em = now()
    where id = 'principal'
  `;
  return { email: limpo };
}

type AmostraHw = { em: number; cpuIdle: number; cpuTotal: number; rx: number; tx: number };

function lerCpuBruto() {
  const linha = readFileSync("/proc/stat", "utf8").split("\n")[0] ?? "";
  const nums = linha.trim().split(/\s+/).slice(1).map(Number);
  const idle = (nums[3] || 0) + (nums[4] || 0);
  const total = nums.reduce((soma, n) => soma + (Number.isFinite(n) ? n : 0), 0);
  return { idle, total };
}

function lerRedeBruta() {
  const linhas = readFileSync("/proc/net/dev", "utf8").split("\n").slice(2);
  let rx = 0;
  let tx = 0;
  for (const linha of linhas) {
    const partes = linha.split(":");
    if (partes.length < 2 || partes[0].trim() === "lo") continue;
    const nums = partes[1].trim().split(/\s+/).map(Number);
    rx += nums[0] || 0;
    tx += nums[8] || 0;
  }
  return { rx, tx };
}

export function lerMaquina() {
  const vazio = {
    em: Date.now(),
    cpu: 0,
    nucleos: 1,
    memoriaUsada: 0,
    memoriaTotal: 0,
    memoriaProcesso: process.memoryUsage().rss,
    discoUsado: 0,
    discoTotal: 0,
    redeRecebida: 0,
    redeEnviada: 0,
    redeRecebidaTaxa: 0,
    redeEnviadaTaxa: 0,
    consultas: lerTrafego().consultas,
    dadosIda: lerTrafego().bytesIda,
    dadosVolta: lerTrafego().bytesVolta,
    dadosTaxa: 0,
    noAr: Math.floor(process.uptime()),
  };
  try {
    return medirMaquina();
  } catch {
    return vazio;
  }
}

function medirMaquina() {
  const caixa = globalThis as typeof globalThis & { __maquinaAmostra__?: AmostraHw };
  const anterior = caixa.__maquinaAmostra__;
  const cpu = lerCpuBruto();
  const rede = lerRedeBruta();
  const em = Date.now();
  caixa.__maquinaAmostra__ = { em, cpuIdle: cpu.idle, cpuTotal: cpu.total, rx: rede.rx, tx: rede.tx };
  const dt = anterior ? Math.max(1, em - anterior.em) / 1000 : 0;
  const dTotal = anterior ? cpu.total - anterior.cpuTotal : 0;
  const dIdle = anterior ? cpu.idle - anterior.cpuIdle : 0;
  const cpuPct = dTotal > 0 ? Math.max(0, Math.min(100, ((dTotal - dIdle) / dTotal) * 100)) : 0;
  const memoriaTotal = totalmem();
  const memoriaLivre = freemem();
  const memoriaUsada = memoriaTotal - memoriaLivre;
  const processo = process.memoryUsage();
  let discoTotal = 0;
  let discoLivre = 0;
  try {
    const disco = statfsSync("/");
    discoTotal = Number(disco.blocks) * Number(disco.bsize);
    discoLivre = Number(disco.bavail) * Number(disco.bsize);
  } catch {
    discoTotal = 0;
  }
  const trafego = lerTrafego();
  const desde = Math.max(1, (em - trafego.desde) / 1000);
  return {
    em,
    cpu: Math.round(cpuPct * 10) / 10,
    nucleos: cpus().length,
    memoriaUsada,
    memoriaTotal,
    memoriaProcesso: processo.rss,
    discoUsado: Math.max(0, discoTotal - discoLivre),
    discoTotal,
    redeRecebida: rede.rx,
    redeEnviada: rede.tx,
    redeRecebidaTaxa: dt ? Math.max(0, (rede.rx - (anterior?.rx ?? rede.rx)) / dt) : 0,
    redeEnviadaTaxa: dt ? Math.max(0, (rede.tx - (anterior?.tx ?? rede.tx)) / dt) : 0,
    consultas: trafego.consultas,
    dadosIda: trafego.bytesIda,
    dadosVolta: trafego.bytesVolta,
    dadosTaxa: (trafego.bytesIda + trafego.bytesVolta) / desde,
    noAr: Math.floor(process.uptime()),
  };
}

const PAPEIS = ["administrador", "operador", "consulta"] as const;

async function garantirConfig(sql: Sql) {
  await sql`insert into gestao_config (id) values ('principal') on conflict (id) do nothing`;
  await sql`alter table gestao_config add column if not exists smtp_senha text`;
  await sql`update usuario_perfil set papel = 'operador' where papel = 'secretaria'`;
}

export async function exigirEscrita(userId: string) {
  const sql = await getSql();
  const linhas = await sql<{ papel: string }>`select papel from usuario_perfil where user_id = ${userId}`;
  if (linhas[0]?.papel === "consulta") throw new Error("Seu perfil é só de consulta.");
}

export async function barrarSePreciso(userId: string) {
  try {
    const sql = await getSql();
    const cfg = await sql<{ manutencao: boolean }>`select manutencao from gestao_config where id = 'principal'`;
    const perfil = await sql<{ bloqueado: boolean; papel: string }>`
      select bloqueado, papel from usuario_perfil where user_id = ${userId}
    `;
    if (perfil[0]?.bloqueado) throw new Error("Acesso bloqueado.");
    const administrador = perfil[0]?.papel === "administrador";
    if (marcado(cfg[0]?.manutencao) && !administrador) throw new Error("Sistema em manutenção.");
  } catch (err) {
    if (err instanceof Error && (err.message === "Sistema em manutenção." || err.message === "Acesso bloqueado.")) throw err;
  }
}

function expandirPeriodo(inicio: string, fim: string) {
  const datas: string[] = [];
  const cursor = new Date(`${inicio.slice(0, 10)}T12:00:00`);
  const limite = new Date(`${fim.slice(0, 10)}T12:00:00`);
  if (Number.isNaN(cursor.getTime()) || Number.isNaN(limite.getTime())) return datas;
  for (let passo = 0; passo < 800 && cursor <= limite; passo += 1) {
    const mes = String(cursor.getMonth() + 1).padStart(2, "0");
    const dia = String(cursor.getDate()).padStart(2, "0");
    datas.push(`${cursor.getFullYear()}-${mes}-${dia}`);
    cursor.setDate(cursor.getDate() + 1);
  }
  return datas;
}

export async function lerEstado(userId: string | null) {
  const sql = await getSql();
  await garantirConfig(sql);
  const cfg = await sql<{ manutencao: boolean }>`select manutencao from gestao_config where id = 'principal'`;
  let bloqueado = false;
  let administrador = false;
  if (userId) {
    const perfil = await sql<{ bloqueado: boolean; papel: string }>`
      select bloqueado, papel from usuario_perfil where user_id = ${userId}
    `;
    bloqueado = marcado(perfil[0]?.bloqueado);
    administrador = perfil[0]?.papel === "administrador" && !bloqueado;
  }
  const feriados = await sql<{ inicio: string; fim: string }>`select inicio, fim from feriados`;
  const datas = [...new Set(feriados.flatMap((item) => expandirPeriodo(String(item.inicio), String(item.fim))))];
  return { manutencao: marcado(cfg[0]?.manutencao), bloqueado, administrador, datas };
}

async function perfil(sql: Sql, userId: string, campos: { papel?: string; bloqueado?: boolean }) {
  const atual = await sql<{ papel: string; bloqueado: boolean }>`
    select papel, bloqueado from usuario_perfil where user_id = ${userId}
  `;
  const papel = campos.papel ?? atual[0]?.papel ?? "operador";
  const bloqueado = campos.bloqueado ?? Boolean(atual[0]?.bloqueado);
  if (!PAPEIS.includes(papel as (typeof PAPEIS)[number])) throw new Error("Perfil inválido.");
  await sql`
    insert into usuario_perfil (user_id, papel, bloqueado)
    values (${userId}, ${papel}, ${bloqueado})
    on conflict (user_id) do update set papel = excluded.papel, bloqueado = excluded.bloqueado
  `;
}

export async function definirPapel(userId: string, papel: string) {
  const sql = await getSql();
  await perfil(sql, userId, { papel });
  return { ok: true };
}

export async function excluirUsuario(userId: string, motivo: string) {
  const sql = await getSql();
  if (!motivoExclusao(motivo)) throw new Error("Escolha o motivo da exclusão.");
  const usuarios = await sql<{ id: string; email: string; name: string }>`
    select id, email, name from "user" where id = ${userId}
  `;
  const usuario = usuarios[0];
  if (!usuario) throw new Error("Usuário não encontrado.");
  await sql`
    insert into conta_excluida (user_id, email, motivo)
    values (${usuario.id}, ${usuario.email.toLowerCase()}, ${motivo})
    on conflict (user_id) do update set email = excluded.email, motivo = excluded.motivo, criado_em = now()
  `;
  await sql`delete from "session" where "userId" = ${userId}`;
  const equipes = await sql<{ id: string }>`select id from equipes where owner_id = ${userId}`;
  for (const equipe of equipes) {
    const outros = await sql<{ user_id: string }>`
      select user_id from equipe_membros
      where equipe_id = ${equipe.id} and user_id <> ${userId}
      limit 1
    `;
    const proximo = outros[0]?.user_id;
    if (proximo) {
      await sql`update equipes set owner_id = ${proximo} where id = ${equipe.id}`;
      await sql`update equipe_membros set papel = 'dono' where equipe_id = ${equipe.id} and user_id = ${proximo}`;
    } else {
      await sql`delete from processos where team_id = ${equipe.id}`;
      await sql`delete from processos_admin where team_id = ${equipe.id}`;
      await sql`delete from equipes where id = ${equipe.id}`;
    }
  }
  await sql`delete from processos where user_id = ${userId} and team_id is null`;
  await sql`delete from processos_admin where user_id = ${userId} and team_id is null`;
  await sql`delete from presenca where user_id = ${userId}`;
  await sql`delete from "verification" where lower(identifier) = ${usuario.email.toLowerCase()}`;
  await sql`delete from "user" where id = ${userId}`;
  return { nome: usuario.name };
}

export async function lerExclusao(filtro: { userId?: string; email?: string }) {
  const sql = await getSql();
  if (filtro.userId) {
    const linhas = await sql<{ motivo: string | null }>`
      select motivo from conta_excluida where user_id = ${filtro.userId} limit 1
    `;
    return { excluida: linhas.length > 0, motivo: linhas[0]?.motivo ?? "" };
  }
  const email = filtro.email?.trim().toLowerCase() ?? "";
  if (!email) return { excluida: false, motivo: "" };
  const linhas = await sql<{ motivo: string | null }>`
    select motivo from conta_excluida where lower(email) = ${email} order by criado_em desc limit 1
  `;
  return { excluida: linhas.length > 0, motivo: linhas[0]?.motivo ?? "" };
}

export async function limparExclusao(email: string) {
  const sql = await getSql();
  const limpo = email.trim().toLowerCase();
  if (limpo) await sql`delete from conta_excluida where lower(email) = ${limpo}`;
  return { ok: true };
}

export async function definirBloqueio(userId: string, bloqueado: boolean) {
  const sql = await getSql();
  await perfil(sql, userId, { bloqueado });
  if (bloqueado) await sql`delete from "session" where "userId" = ${userId}`;
  return { ok: true };
}

export async function vincularEquipe(equipeId: string, userId: string) {
  const sql = await getSql();
  const equipe = await sql<{ id: string }>`select id from equipes where id = ${equipeId}`;
  const usuario = await sql<{ id: string }>`select id from "user" where id = ${userId}`;
  if (!equipe.length || !usuario.length) throw new Error("Equipe ou usuário não encontrado.");
  await sql`
    insert into equipe_membros (equipe_id, user_id, papel)
    values (${equipeId}, ${userId}, 'membro')
    on conflict (equipe_id, user_id) do nothing
  `;
  return { ok: true };
}

export async function desvincularEquipe(equipeId: string, userId: string) {
  const sql = await getSql();
  await sql`
    delete from equipe_membros
    where equipe_id = ${equipeId}
      and user_id = ${userId}
      and user_id <> (select owner_id from equipes where id = ${equipeId})
  `;
  return { ok: true };
}

export async function renomearAba(id: string, nome: string) {
  const sql = await getSql();
  const limpo = nome.trim().replace(/\s+/g, " ");
  if (!nomeAbaOk(limpo)) throw new Error("Use um nome curto, só com letras e números.");
  const linhas = await sql<{ area: string; nome: string; fixa: boolean }>`
    select area, nome, fixa from abas_catalogo where id = ${id}
  `;
  const aba = linhas[0];
  if (!aba) throw new Error("Aba não encontrada.");
  if (aba.fixa) throw new Error("As abas originais não mudam de nome.");
  if (aba.nome === limpo) return { nome: limpo };
  await sql`update abas_catalogo set nome = ${limpo} where id = ${id}`;
  if (aba.area === "legislativo") await sql`update processos set tipo = ${limpo} where tipo = ${aba.nome}`;
  else await sql`update processos_admin set tipo = ${limpo} where tipo = ${aba.nome}`;
  return { nome: limpo };
}

export async function moverAba(id: string, direcao: -1 | 1) {
  const sql = await getSql();
  const atual = await sql<{ area: string }>`select area from abas_catalogo where id = ${id}`;
  if (!atual[0]) throw new Error("Aba não encontrada.");
  const lista = await sql<{ id: string; ordem: number }>`
    select id, ordem from abas_catalogo where area = ${atual[0].area} order by ordem asc, nome asc
  `;
  const indice = lista.findIndex((item) => item.id === id);
  const vizinho = lista[indice + direcao];
  if (indice < 0 || !vizinho) return { ok: true };
  await sql`update abas_catalogo set ordem = ${indice + 1 + direcao} where id = ${id}`;
  await sql`update abas_catalogo set ordem = ${indice + 1} where id = ${vizinho.id}`;
  return { ok: true };
}

export async function apagarAba(id: string) {
  const sql = await getSql();
  const linhas = await sql<{ area: string; nome: string; fixa: boolean }>`
    select area, nome, fixa from abas_catalogo where id = ${id}
  `;
  const aba = linhas[0];
  if (!aba) throw new Error("Tipo não encontrado.");
  if (marcado(aba.fixa)) throw new Error("Os tipos originais não podem ser excluídos.");
  const uso =
    aba.area === "legislativo"
      ? await sql<{ n: number }>`select count(*)::int as n from processos where tipo = ${aba.nome}`
      : await sql<{ n: number }>`select count(*)::int as n from processos_admin where tipo = ${aba.nome}`;
  if (Number(uso[0]?.n ?? 0) > 0) throw new Error("Este tipo ainda está em processos. Mude esses processos antes de excluir.");
  await sql`delete from abas_catalogo where id = ${id}`;
  return { ok: true };
}

export async function ordenarStatus(ids: string[]) {
  await gravarOrdem("status_catalogo", ids);
  return { ok: true };
}

export async function ordenarAbas(ids: string[]) {
  await gravarOrdem("abas_catalogo", ids);
  return { ok: true };
}

async function gravarOrdem(tabela: "status_catalogo" | "abas_catalogo", ids: string[]) {
  if (ids.length < 1 || ids.length > 80) throw new Error("Dados inválidos");
  if (new Set(ids).size !== ids.length) throw new Error("A ordem tem item repetido.");
  const sql = await getSql();
  const linhas = await sql.query<{ id: string; area: string }>(`select id, area from ${tabela}`);
  const mapa = new Map(linhas.map((linha) => [linha.id, linha.area]));
  if (ids.some((id) => !mapa.has(id))) throw new Error("Item não encontrado.");
  const area = mapa.get(ids[0]);
  if (ids.some((id) => mapa.get(id) !== area)) throw new Error("A ordem vale dentro da mesma área.");
  const daArea = linhas.filter((linha) => linha.area === area).map((linha) => linha.id);
  if (daArea.length !== ids.length || ids.some((id) => !daArea.includes(id))) {
    throw new Error("A ordem precisa incluir todos os itens da área.");
  }
  const valores = ids.map((_, indice) => `($${indice + 1}::text, ${indice + 1}::int)`).join(", ");
  await sql.query(`update ${tabela} as item set ordem = novo.ordem from (values ${valores}) as novo(id, ordem) where item.id = novo.id`, ids);
}

export async function apagarStatus(id: string) {
  const sql = await getSql();
  const atual = await sql<{ area: string; codigo: string; fixo: boolean }>`
    select area, codigo, fixo from status_catalogo where id = ${id}
  `;
  if (!atual[0]) throw new Error("Status não encontrado.");
  if (marcado(atual[0].fixo)) throw new Error("Este status faz parte do sistema e não pode ser excluído.");
  const area = atual[0].area;
  const codigo = atual[0].codigo;
  const uso =
    area === "legislativo"
      ? await sql<{ n: number }>`select count(*)::int as n from processos where status = ${codigo}`
      : await sql<{ n: number }>`select count(*)::int as n from processos_admin where status = ${codigo}`;
  if (Number(uso[0]?.n ?? 0) > 0) throw new Error("Este status ainda está em processos. Mude esses processos antes de excluir.");
  await sql`
    update status_catalogo
    set tramite_codigo = null, tramite_dias = null
    where area = ${area} and tramite_codigo = ${codigo}
  `;
  await sql`delete from status_catalogo where id = ${id}`;
  return { ok: true };
}

export async function listarLogs(filtro: { de: string; ate: string; texto: string; acao: string; pagina: number }) {
  const sql = await getSql();
  const limite = 30;
  const pagina = Math.max(0, filtro.pagina);
  const texto = `%${filtro.texto.trim().toLowerCase()}%`;
  const acao = filtro.acao.trim();
  const de = /^\d{4}-\d{2}-\d{2}$/.test(filtro.de) ? filtro.de : null;
  const ate = /^\d{4}-\d{2}-\d{2}$/.test(filtro.ate) ? filtro.ate : null;
  const registros = await sql<{ id: string; nome: string; email: string; acao: string; detalhe: string; em: string }>`
    select id, nome, email, acao, detalhe, criado_em as em
    from uso_registros
    where (${texto} = '%%' or lower(nome) like ${texto} or lower(email) like ${texto} or lower(detalhe) like ${texto})
      and (${acao} = '' or acao = ${acao})
      and (${de}::date is null or criado_em::date >= ${de}::date)
      and (${ate}::date is null or criado_em::date <= ${ate}::date)
    order by criado_em desc
    limit ${limite}
    offset ${pagina * limite}
  `;
  const total = await sql<{ n: number }>`
    select count(*)::int as n
    from uso_registros
    where (${texto} = '%%' or lower(nome) like ${texto} or lower(email) like ${texto} or lower(detalhe) like ${texto})
      and (${acao} = '' or acao = ${acao})
      and (${de}::date is null or criado_em::date >= ${de}::date)
      and (${ate}::date is null or criado_em::date <= ${ate}::date)
  `;
  const acoes = await sql<{ acao: string }>`select distinct acao from uso_registros order by acao asc`;
  return {
    registros: registros.map((item) => ({ ...item, em: String(item.em) })),
    total: Number(total[0]?.n ?? 0),
    acoes: acoes.map((item) => item.acao),
  };
}

async function montarBackup(sql: Sql) {
  const [usuarios, contas, autenticadores, processos, processosAdmin, equipes, membros, convites, abas, statusCatalogo, feriados, perfis, termos, gestaoAcesso, excluidas] =
    await Promise.all([
      sql`select * from "user"`,
      sql`select "id", "accountId", "providerId", "userId", "password", "createdAt", "updatedAt" from "account"`,
      sql`select * from autenticador`,
      sql`select * from processos`,
      sql`select * from processos_admin`,
      sql`select * from equipes`,
      sql`select * from equipe_membros`,
      sql`select * from equipe_convites`,
      sql`select * from abas_catalogo`,
      sql`select * from status_catalogo`,
      sql`select * from feriados`,
      sql`select * from usuario_perfil`,
      sql`select * from termo_aceite`,
      sql`select * from gestao_acesso`,
      sql`select * from conta_excluida`,
    ]);
  return JSON.stringify({
    versao: 2,
    em: new Date().toISOString(),
    aplicativo: "Auxilia Legis",
    usuarios,
    contas,
    autenticadores,
    processos,
    processosAdmin,
    equipes,
    membros,
    convites,
    abas,
    statusCatalogo,
    feriados,
    perfis,
    termos,
    gestaoAcesso,
    excluidas,
  });
}

function resumoDoBackup(conteudo: string) {
  try {
    const dados = JSON.parse(conteudo) as {
      usuarios?: unknown[];
      processos?: unknown[];
      processosAdmin?: unknown[];
    };
    return {
      contas: Array.isArray(dados.usuarios) ? dados.usuarios.length : 0,
      processos: Array.isArray(dados.processos) ? dados.processos.length : 0,
      administrativos: Array.isArray(dados.processosAdmin) ? dados.processosAdmin.length : 0,
    };
  } catch {
    return { contas: 0, processos: 0, administrativos: 0 };
  }
}

async function guardarBackup(sql: Sql, automatico: boolean) {
  const claro = await montarBackup(sql);
  const resumo = resumoDoBackup(claro);
  const conteudo = cifrarBackup(claro);
  await sql`
    insert into gestao_backups (id, automatico, conteudo, contas, processos, administrativos)
    values (${crypto.randomUUID()}, ${automatico}, ${conteudo}, ${resumo.contas}, ${resumo.processos}, ${resumo.administrativos})
  `;
  if (automatico) await sql`update gestao_config set backup_auto_em = now() where id = 'principal'`;
  else await sql`update gestao_config set backup_em = now() where id = 'principal'`;
  return conteudo;
}

export async function backupAoLancar() {
  try {
    const sql = await getSql();
    await garantirConfig(sql);
    await guardarBackup(sql, true);
  } catch {
    /* o lançamento segue mesmo se o backup não gravar */
  }
}

async function backupAutomatico(sql: Sql) {
  const linhas = await sql<{ backup_auto_em: string | null }>`
    select backup_auto_em from gestao_config where id = 'principal'
  `;
  const ultimo = linhas[0]?.backup_auto_em ? new Date(linhas[0].backup_auto_em).getTime() : 0;
  if (Date.now() - ultimo < 24 * 60 * 60 * 1000) return;
  await guardarBackup(sql, true);
}

export async function listarBackupsAutomaticos() {
  const sql = await getSql();
  const linhas = await sql<{
    id: string;
    criado_em: string;
    contas: number | null;
    processos: number | null;
    administrativos: number | null;
    conteudo: string | null;
  }>`
    select id, criado_em, contas, processos, administrativos,
      case when contas is null then conteudo else null end as conteudo
    from gestao_backups
    where automatico = true
    order by criado_em desc
  `;
  const lista = [];
  for (const linha of linhas) {
    let contas = linha.contas;
    let processos = linha.processos;
    let administrativos = linha.administrativos;
    if (contas == null && linha.conteudo) {
      try {
        const resumo = resumoDoBackup(abrirBackup(linha.conteudo));
        contas = resumo.contas;
        processos = resumo.processos;
        administrativos = resumo.administrativos;
      } catch {
        contas = 0;
        processos = 0;
        administrativos = 0;
      }
      await sql`
        update gestao_backups
        set contas = ${contas}, processos = ${processos}, administrativos = ${administrativos}
        where id = ${linha.id}
      `;
    }
    lista.push({
      id: linha.id,
      em: String(linha.criado_em),
      contas: Number(contas ?? 0),
      processos: Number(processos ?? 0),
      administrativos: Number(administrativos ?? 0),
    });
  }
  return lista;
}

export async function restaurarBackupAutomatico(id: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw new Error("Escolha um backup da lista.");
  const sql = await getSql();
  const linhas = await sql<{ conteudo: string }>`
    select conteudo from gestao_backups where id = ${id} and automatico = true
  `;
  if (!linhas[0]) throw new Error("Esse backup automático não existe mais.");
  return restaurarBackup(linhas[0].conteudo);
}

export async function fazerBackup() {
  const sql = await getSql();
  await garantirConfig(sql);
  const conteudo = await guardarBackup(sql, false);
  return { nome: `Auxilia Legis ${new Date().toISOString().slice(0, 10)}.json`, conteudo };
}

export async function baixarUltimoBackup() {
  const sql = await getSql();
  const linhas = await sql<{ conteudo: string; criado_em: string }>`
    select conteudo, criado_em from gestao_backups order by criado_em desc limit 1
  `;
  if (!linhas[0]) {
    const conteudo = await guardarBackup(sql, false);
    return { nome: `Auxilia Legis ${new Date().toISOString().slice(0, 10)}.json`, conteudo };
  }
  return {
    nome: `Auxilia Legis ${String(linhas[0].criado_em).slice(0, 10)}.json`,
    conteudo: linhas[0].conteudo,
  };
}

async function gravarLinhas(sql: Sql, tabela: string, conflito: string[], linhas: unknown) {
  if (!Array.isArray(linhas)) return 0;
  let gravadas = 0;
  for (const item of linhas) {
    if (!item || typeof item !== "object") continue;
    const linha = item as Record<string, unknown>;
    const colunas = Object.keys(linha).filter((chave) => /^[a-zA-Z0-9_]+$/.test(chave));
    if (!colunas.length) continue;
    const valores = colunas.map((chave) => linha[chave]);
    const lista = colunas.map((chave) => `"${chave}"`).join(", ");
    const marcas = colunas.map((_, indice) => `$${indice + 1}`).join(", ");
    const atualiza = colunas
      .filter((chave) => !conflito.includes(chave))
      .map((chave) => `"${chave}" = excluded."${chave}"`)
      .join(", ");
    const alvo = conflito.map((chave) => `"${chave}"`).join(", ");
    await sql.query(
      `insert into ${tabela} (${lista}) values (${marcas}) on conflict (${alvo}) do update set ${atualiza || conflito.map((chave) => `"${chave}" = excluded."${chave}"`).join(", ")}`,
      valores,
    );
    gravadas += 1;
  }
  return gravadas;
}

function idsDe(linhas: unknown, campo: string) {
  if (!Array.isArray(linhas)) return [];
  const ids: string[] = [];
  for (const item of linhas) {
    if (!item || typeof item !== "object") continue;
    const valor = (item as Record<string, unknown>)[campo];
    if (typeof valor === "string" && valor) ids.push(valor);
  }
  return ids;
}

export async function restaurarBackup(conteudo: string) {
  if (conteudo.length > 12_000_000) throw new Error("O arquivo é grande demais.");
  const claro = abrirBackup(conteudo);
  let dados: {
    versao?: number;
    processos?: Record<string, unknown>[];
    processosAdmin?: Record<string, unknown>[];
    usuarios?: Record<string, unknown>[];
    contas?: Record<string, unknown>[];
  };
  try {
    dados = JSON.parse(claro) as typeof dados;
  } catch {
    throw new Error("Arquivo de backup inválido.");
  }
  if ((dados.versao !== 1 && dados.versao !== 2) || !Array.isArray(dados.processos) || !Array.isArray(dados.processosAdmin)) {
    throw new Error("Este arquivo não é um backup do Auxilia Legis.");
  }
  if (!Array.isArray(dados.contas) || dados.contas.length === 0) {
    throw new Error("Este backup não contém as contas. Gere um novo backup onde os usuários ainda existem e restaure esse arquivo.");
  }
  await getSql();
  const resultado = await semPersistencia(async () => {
    const sql = await getSql();
    const contas = await gravarLinhas(sql, '"user"', ["id"], dados.usuarios);
    await gravarLinhas(sql, '"account"', ["id"], dados.contas);
    await gravarLinhas(sql, "autenticador", ["user_id"], (dados as { autenticadores?: unknown }).autenticadores);
    await gravarLinhas(sql, "usuario_perfil", ["user_id"], (dados as { perfis?: unknown }).perfis);
    await gravarLinhas(sql, "termo_aceite", ["user_id"], (dados as { termos?: unknown }).termos);
    await gravarLinhas(sql, "gestao_acesso", ["id"], (dados as { gestaoAcesso?: unknown }).gestaoAcesso);
    await gravarLinhas(sql, "equipes", ["id"], (dados as { equipes?: unknown }).equipes);
    await gravarLinhas(sql, "equipe_membros", ["equipe_id", "user_id"], (dados as { membros?: unknown }).membros);
    await gravarLinhas(sql, "equipe_convites", ["equipe_id", "email"], (dados as { convites?: unknown }).convites);
    await gravarLinhas(sql, "abas_catalogo", ["id"], (dados as { abas?: unknown }).abas);
    await gravarLinhas(sql, "status_catalogo", ["id"], (dados as { statusCatalogo?: unknown }).statusCatalogo);
    await gravarLinhas(sql, "feriados", ["id"], (dados as { feriados?: unknown }).feriados);
    await gravarLinhas(sql, "conta_excluida", ["user_id"], (dados as { excluidas?: unknown }).excluidas);
    const processos = await gravarLinhas(sql, "processos", ["id"], dados.processos);
    const administrativos = await gravarLinhas(sql, "processos_admin", ["id"], dados.processosAdmin);
    const ids = [...new Set([...idsDe(dados.usuarios, "id"), ...idsDe(dados.contas, "userId")])];
    for (const id of ids) {
      await sql`
        insert into usuario_perfil (user_id, papel, bloqueado, isento_2fa)
        values (${id}, 'operador', false, true)
        on conflict (user_id) do update set isento_2fa = true
      `;
      await sql`update "user" set "emailVerified" = true where id = ${id}`;
    }
    return { contas, processos, administrativos };
  });
  await copiarBancoAgora();
  return resultado;
}

export async function salvarFeriado(entrada: { nome: string; tipo: string; inicio: string; fim: string }) {
  const nome = entrada.nome.trim().replace(/\s+/g, " ").slice(0, 80);
  if (nome.length < 2) throw new Error("Dê um nome ao dia.");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(entrada.inicio) || !/^\d{4}-\d{2}-\d{2}$/.test(entrada.fim)) throw new Error("Datas inválidas.");
  if (entrada.fim < entrada.inicio) throw new Error("O fim não pode ser antes do início.");
  const tipo = entrada.tipo === "recesso" ? "recesso" : "feriado";
  const sql = await getSql();
  await sql`
    insert into feriados (id, inicio, fim, nome, tipo)
    values (${crypto.randomUUID()}, ${entrada.inicio}, ${entrada.fim}, ${nome}, ${tipo})
  `;
  return { ok: true };
}

export async function apagarFeriado(id: string) {
  const sql = await getSql();
  await sql`delete from feriados where id = ${id}`;
  return { ok: true };
}

export async function definirManutencao(ligado: boolean) {
  const sql = await getSql();
  await garantirConfig(sql);
  if (!ligado) {
    await sql`delete from processos where em_manutencao = true`;
    await sql`delete from processos_admin where em_manutencao = true`;
  }
  if (ligado) await sql`update gestao_config set manutencao = true where id = 'principal'`;
  else await sql`update gestao_config set manutencao = false where id = 'principal'`;
  const gravado = await sql<{ manutencao: unknown }>`select manutencao from gestao_config where id = 'principal'`;
  const ativo = marcado(gravado[0]?.manutencao);
  if (ativo !== ligado) throw new Error("A manutenção não foi gravada. Tente de novo.");
  await copiarBancoAgora();
  return { manutencao: ativo };
}

export async function salvarSenhaCaixa(senha: string) {
  const limpa = senha.trim();
  if (limpa.length < 6) throw new Error("Informe a senha da caixa de e-mail.");
  const { cifrarSenhaCaixa, EMAIL_ENVIO } = await import("./email.server");
  const sql = await getSql();
  await garantirConfig(sql);
  await sql`update gestao_config set smtp_senha = ${cifrarSenhaCaixa(limpa)} where id = 'principal'`;
  return { email: EMAIL_ENVIO };
}

