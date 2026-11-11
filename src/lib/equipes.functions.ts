import { createServerFn } from "@tanstack/react-start";
import { getSql } from "@/lib/db";
import { authMiddleware } from "@/lib/auth/middleware";

export type PapelEquipe = "dono" | "membro";
export type ModuloEquipe = "legislativo" | "administrativo";

export type MembroEquipe = {
  userId: string;
  nome: string;
  email: string;
  papel: PapelEquipe;
};

export type ConviteEquipe = {
  email: string;
  nome: string;
};

export type Equipe = {
  id: string;
  nome: string;
  papel: PapelEquipe;
  membros: MembroEquipe[];
  convites: ConviteEquipe[];
  modulos: ModuloEquipe[];
};

function emailOk(value: unknown): string {
  if (typeof value !== "string") throw new Error("E-mail inválido.");
  const email = value.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 160) {
    throw new Error("E-mail inválido.");
  }
  return email;
}

function papelOk(value: string): PapelEquipe {
  return value === "dono" ? "dono" : "membro";
}

export function modulosOuAmbos(lista: readonly string[] | undefined): ModuloEquipe[] {
  const validos = (lista ?? []).filter((item): item is ModuloEquipe => item === "legislativo" || item === "administrativo");
  return validos.length ? validos : ["legislativo", "administrativo"];
}

async function garantirModulosEquipe() {
  const sql = await getSql();
  await sql`
    create table if not exists equipe_modulos (
      equipe_id text not null references equipes (id) on delete cascade,
      modulo text not null,
      primary key (equipe_id, modulo)
    )
  `;
  return sql;
}

async function mapaModulos() {
  const sql = await garantirModulosEquipe();
  const linhas = await sql<{ equipe_id: string; modulo: string }>`select equipe_id, modulo from equipe_modulos`;
  const mapa = new Map<string, ModuloEquipe[]>();
  for (const linha of linhas) {
    if (linha.modulo !== "legislativo" && linha.modulo !== "administrativo") continue;
    const atual = mapa.get(linha.equipe_id) ?? [];
    atual.push(linha.modulo);
    mapa.set(linha.equipe_id, atual);
  }
  return mapa;
}

export async function garantirTimbrados() {
  const sql = await getSql();
  await sql`
    create table if not exists timbrados (
      equipe_id text primary key references equipes (id) on delete cascade,
      imagem text not null default '',
      linha1 text not null default '',
      linha2 text not null default '',
      rodape1 text not null default '',
      rodape2 text not null default ''
    )
  `;
}

export type TimbradoEquipe = {
  equipeId: string;
  imagem: string;
  linha1: string;
  linha2: string;
  rodape1: string;
  rodape2: string;
};

export const lerTimbradoEquipe = createServerFn({ method: "POST" })
  .validator((input: unknown) => {
    if (typeof input !== "string" || !input.trim()) throw new Error("Equipe inválida.");
    return input.trim().slice(0, 80);
  })
  .middleware([authMiddleware])
  .handler(async ({ data, context }): Promise<TimbradoEquipe | null> => {
    const sql = await getSql();
    await garantirTimbrados();
    const membro = await sql`select 1 as ok from equipe_membros where equipe_id = ${data} and user_id = ${context.userId} limit 1`;
    if (!membro.length) throw new Error("Você não faz parte desta equipe.");
    const linhas = await sql<{ imagem: string; linha1: string; linha2: string; rodape1: string; rodape2: string }>`
      select imagem, linha1, linha2, rodape1, rodape2 from timbrados where equipe_id = ${data} limit 1
    `;
    const item = linhas[0];
    if (!item || (!item.linha1.trim() && !item.imagem)) return null;
    return { equipeId: data, imagem: item.imagem, linha1: item.linha1, linha2: item.linha2, rodape1: item.rodape1, rodape2: item.rodape2 };
  });

async function aceitarConvites(userId: string) {
  const sql = await getSql();
  const eu = await sql<{ email: string }>`select email from "user" where id = ${userId}`;
  const email = eu[0]?.email?.toLowerCase();
  if (!email) return;
  const pendentes = await sql<{ equipe_id: string }>`
    select equipe_id from equipe_convites where lower(email) = ${email} limit 1
  `;
  if (!pendentes.length) return;
  await sql`
    insert into equipe_membros (equipe_id, user_id, papel)
    select c.equipe_id, ${userId}, 'membro'
    from equipe_convites c
    where lower(c.email) = ${email}
    on conflict (equipe_id, user_id) do nothing
  `;
  await sql`delete from equipe_convites where lower(email) = ${email}`;
}

export async function equipesDaConta(userId: string) {
  await aceitarConvites(userId);
  const sql = await getSql();
  const linhas = await sql<{
    equipe_id: string;
    nome: string;
    meu_papel: string;
    user_id: string;
    name: string;
    email: string;
    papel: string;
  }>`
    select e.id as equipe_id, e.nome, meu.papel as meu_papel,
           m.user_id, u.name, u.email, m.papel
    from equipe_membros meu
    join equipes e on e.id = meu.equipe_id
    join equipe_membros m on m.equipe_id = e.id
    join "user" u on u.id = m.user_id
    where meu.user_id = ${userId}
    order by e.nome, u.name
  `;
  const convites = await sql<{ equipe_id: string; email: string; nome: string | null }>`
    select c.equipe_id, c.email, c.nome
    from equipe_convites c
    join equipe_membros meu on meu.equipe_id = c.equipe_id
    where meu.user_id = ${userId} and meu.papel = 'dono'
    order by c.email
  `;
  const mapa = new Map<string, Equipe>();
  for (const linha of linhas) {
    let equipe = mapa.get(linha.equipe_id);
    if (!equipe) {
      equipe = {
        id: linha.equipe_id,
        nome: linha.nome,
        papel: papelOk(linha.meu_papel),
        membros: [],
        convites: [],
        modulos: ["legislativo", "administrativo"],
      };
      mapa.set(linha.equipe_id, equipe);
    }
    equipe.membros.push({
      userId: linha.user_id,
      nome: linha.name,
      email: linha.email,
      papel: papelOk(linha.papel),
    });
  }
  for (const convite of convites) {
    mapa.get(convite.equipe_id)?.convites.push({
      email: convite.email,
      nome: convite.nome?.trim() || convite.email,
    });
  }
  const modulos = await mapaModulos();
  for (const equipe of mapa.values()) equipe.modulos = modulosOuAmbos(modulos.get(equipe.id));
  return [...mapa.values()];
}

export const listarEquipes = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => equipesDaConta(context.userId));

export const criarEquipe = createServerFn({ method: "POST" })
  .validator((input: unknown) => {
    const bruto = typeof input === "string" ? { nome: input } : input;
    if (!bruto || typeof bruto !== "object") throw new Error("Dê um nome para a equipe.");
    const dados = bruto as { nome?: unknown; modulo?: unknown };
    if (typeof dados.nome !== "string" || dados.nome.trim().length < 2) throw new Error("Dê um nome para a equipe.");
    const modulo: ModuloEquipe = dados.modulo === "administrativo" ? dados.modulo : "legislativo";
    return { nome: dados.nome.trim().slice(0, 60), modulo };
  })
  .middleware([authMiddleware])
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const id = crypto.randomUUID();
    await sql`insert into equipes (id, nome, owner_id) values (${id}, ${data.nome}, ${context.userId})`;
    await sql`
      insert into equipe_membros (equipe_id, user_id, papel)
      values (${id}, ${context.userId}, 'dono')
    `;
    await garantirModulosEquipe();
    await sql`insert into equipe_modulos (equipe_id, modulo) values (${id}, ${data.modulo})`;
    const { anotarUso } = await import("./gestao.server");
    void anotarUso(context.userId, "Criou equipe", data.nome).catch(() => undefined);
    return { id, nome: data.nome, modulo: data.modulo };
  });

export const renomearEquipe = createServerFn({ method: "POST" })
  .validator((input: unknown) => {
    if (!input || typeof input !== "object") throw new Error("Dados inválidos");
    const bruto = input as { equipeId?: unknown; nome?: unknown };
    if (typeof bruto.equipeId !== "string" || !bruto.equipeId.trim()) throw new Error("Dados inválidos");
    if (typeof bruto.nome !== "string" || bruto.nome.trim().length < 2) throw new Error("Dê um nome para a equipe.");
    return { equipeId: bruto.equipeId.trim().slice(0, 80), nome: bruto.nome.trim().slice(0, 60) };
  })
  .middleware([authMiddleware])
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const dono = await sql<{ ok: number }>`
      select 1 as ok from equipe_membros
      where equipe_id = ${data.equipeId} and user_id = ${context.userId} and papel = 'dono'
    `;
    if (!dono.length) throw new Error("Só quem criou a equipe pode mudar o nome.");
    await sql`update equipes set nome = ${data.nome} where id = ${data.equipeId}`;
    return { nome: data.nome };
  });

export const adicionarNaEquipe = createServerFn({ method: "POST" })
  .validator((input: unknown) => {
    if (!input || typeof input !== "object") throw new Error("Dados inválidos");
    const bruto = input as { equipeId?: unknown; email?: unknown; nome?: unknown };
    if (typeof bruto.equipeId !== "string" || !bruto.equipeId.trim()) throw new Error("Dados inválidos");
    if (typeof bruto.nome !== "string" || bruto.nome.trim().length < 2) throw new Error("Informe o nome da pessoa.");
    return {
      equipeId: bruto.equipeId.trim().slice(0, 80),
      email: emailOk(bruto.email),
      nome: bruto.nome.trim().slice(0, 80),
    };
  })
  .middleware([authMiddleware])
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const dono = await sql<{ ok: number }>`
      select 1 as ok from equipe_membros
      where equipe_id = ${data.equipeId} and user_id = ${context.userId} and papel = 'dono'
    `;
    if (!dono.length) throw new Error("Só quem criou a equipe pode adicionar pessoas.");
    const total = await sql<{ n: number }>`
      select (
        (select count(*) from equipe_membros where equipe_id = ${data.equipeId})
        + (select count(*) from equipe_convites where equipe_id = ${data.equipeId})
      ) as n
    `;
    if (Number(total[0]?.n ?? 0) >= 30) throw new Error("Esta equipe já está cheia.");
    const eu = await sql<{ email: string }>`select email from "user" where id = ${context.userId}`;
    if (eu[0]?.email?.toLowerCase() === data.email) throw new Error("Você já faz parte desta equipe.");
    const alvo = await sql<{ id: string; name: string }>`
      select id, name from "user" where lower(email) = ${data.email}
    `;
    const quem = await sql<{ name: string | null }>`select name from "user" where id = ${context.userId}`;
    const convidou = quem[0]?.name?.trim() || "um responsável da equipe";
    let emailEnviado = false;
    let avisoEmail = "";
    try {
      const { enviarConviteEquipe } = await import("./convite-equipe.server");
      await enviarConviteEquipe({
        equipeId: data.equipeId,
        email: data.email,
        nome: data.nome,
        convidou,
      });
      emailEnviado = true;
    } catch (err) {
      avisoEmail = err instanceof Error ? err.message : "Não foi possível enviar o e-mail.";
      console.error("[convite] e-mail não enviado", avisoEmail);
    }
    if (alvo.length) {
      const nomeConta = alvo[0].name?.trim() ?? "";
      if (nomeConta.length < 2) {
        await sql`update "user" set name = ${data.nome} where id = ${alvo[0].id}`;
      }
      await sql`
        insert into equipe_membros (equipe_id, user_id, papel)
        values (${data.equipeId}, ${alvo[0].id}, 'membro')
        on conflict (equipe_id, user_id) do nothing
      `;
      await sql`
        delete from equipe_convites
        where equipe_id = ${data.equipeId} and lower(email) = ${data.email}
      `;
      return { entrou: true, nome: nomeConta.length < 2 ? data.nome : nomeConta, emailEnviado, avisoEmail };
    }
    await sql`
      insert into equipe_convites (equipe_id, email, nome)
      values (${data.equipeId}, ${data.email}, ${data.nome})
      on conflict (equipe_id, email) do update set nome = excluded.nome
    `;
    return { entrou: false, nome: data.nome, emailEnviado, avisoEmail };
  });

export const removerDaEquipe = createServerFn({ method: "POST" })
  .validator((input: unknown) => {
    if (!input || typeof input !== "object") throw new Error("Dados inválidos");
    const bruto = input as { equipeId?: unknown; email?: unknown };
    if (typeof bruto.equipeId !== "string" || !bruto.equipeId.trim()) throw new Error("Dados inválidos");
    return { equipeId: bruto.equipeId.trim().slice(0, 80), email: emailOk(bruto.email) };
  })
  .middleware([authMiddleware])
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const eu = await sql<{ email: string; papel: string }>`
      select u.email, m.papel
      from equipe_membros m
      join "user" u on u.id = m.user_id
      where m.equipe_id = ${data.equipeId} and m.user_id = ${context.userId}
    `;
    if (!eu.length) throw new Error("Você não faz parte desta equipe.");
    const meuEmail = eu[0].email.toLowerCase();
    const souDono = eu[0].papel === "dono";
    if (meuEmail === data.email) {
      if (souDono) throw new Error("Quem criou a equipe não pode sair.");
      await sql`
        delete from equipe_membros
        where equipe_id = ${data.equipeId} and user_id = ${context.userId}
      `;
      return { ok: true };
    }
    if (!souDono) throw new Error("Só quem criou a equipe pode remover pessoas.");
    await sql`
      delete from equipe_membros
      where equipe_id = ${data.equipeId}
        and user_id in (select id from "user" where lower(email) = ${data.email})
        and papel <> 'dono'
    `;
    await sql`
      delete from equipe_convites
      where equipe_id = ${data.equipeId} and lower(email) = ${data.email}
    `;
    const { cancelarConvitePendente } = await import("./convite-equipe.server");
    await cancelarConvitePendente(data.equipeId, data.email);
    return { ok: true };
  });

export async function listarAtribuicaoModulos() {
  const sql = await garantirModulosEquipe();
  const equipes = await sql<{ id: string; nome: string }>`select id, nome from equipes order by nome`;
  const mapa = await mapaModulos();
  return equipes.map((equipe) => ({
    id: equipe.id,
    nome: equipe.nome,
    modulos: modulosOuAmbos(mapa.get(equipe.id)),
  }));
}

export async function definirModulosEquipe(equipeId: string, modulos: ModuloEquipe[]) {
  const unicos = [...new Set(modulos)].filter((item): item is ModuloEquipe => item === "legislativo" || item === "administrativo");
  if (!unicos.length) throw new Error("A equipe precisa ficar em pelo menos um módulo.");
  const sql = await garantirModulosEquipe();
  const existe = await sql<{ ok: number }>`select 1 as ok from equipes where id = ${equipeId}`;
  if (!existe.length) throw new Error("Equipe não encontrada.");
  await sql`delete from equipe_modulos where equipe_id = ${equipeId}`;
  for (const modulo of unicos) {
    await sql`insert into equipe_modulos (equipe_id, modulo) values (${equipeId}, ${modulo})`;
  }
  return { id: equipeId, modulos: unicos };
}
