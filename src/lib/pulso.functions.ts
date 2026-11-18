import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";
import { getSql, type Sql } from "@/lib/db";

let pulsoPronto: Promise<void> | null = null;

export async function garantirPulso(sql: Sql) {
  if (!pulsoPronto) {
    pulsoPronto = (async () => {
      await sql.query("alter table processos add column if not exists atualizado_em timestamptz not null default now()");
      await sql.query("alter table processos_admin add column if not exists atualizado_em timestamptz not null default now()");
      await sql.query(`
        create table if not exists pulso_removido (
          tabela text not null,
          id text not null,
          escopo text not null,
          removido_em timestamptz not null default now(),
          primary key (tabela, id)
        )
      `);
      await sql.query(`
        create or replace function pulso_tocar() returns trigger
        language plpgsql as $fn$
        begin
          if tg_op = 'DELETE' then
            insert into pulso_removido (tabela, id, escopo, removido_em)
            values (tg_table_name, old.id, coalesce(old.team_id, old.user_id), clock_timestamp())
            on conflict (tabela, id) do update
              set escopo = excluded.escopo, removido_em = excluded.removido_em;
            return old;
          end if;
          if tg_op = 'UPDATE' and (
            coalesce(old.team_id, '') is distinct from coalesce(new.team_id, '')
            or old.user_id is distinct from new.user_id
          ) then
            insert into pulso_removido (tabela, id, escopo, removido_em)
            values (tg_table_name, old.id, coalesce(old.team_id, old.user_id), clock_timestamp())
            on conflict (tabela, id) do update
              set escopo = excluded.escopo, removido_em = excluded.removido_em;
          end if;
          new.atualizado_em = clock_timestamp();
          return new;
        end
        $fn$
      `);
      await sql.query("drop trigger if exists pulso_tocar_processos on processos");
      await sql.query(`
        create trigger pulso_tocar_processos
        before insert or update or delete on processos
        for each row execute function pulso_tocar()
      `);
      await sql.query("drop trigger if exists pulso_tocar_admin on processos_admin");
      await sql.query(`
        create trigger pulso_tocar_admin
        before insert or update or delete on processos_admin
        for each row execute function pulso_tocar()
      `);
    })().catch((err) => {
      pulsoPronto = null;
      throw err;
    });
  }
  await pulsoPronto;
}

async function marca(sql: Sql, texto: string, params: unknown[]) {
  try {
    const linhas = await sql.query<{ marca: string }>(texto, params);
    return linhas[0]?.marca ?? "";
  } catch {
    return "";
  }
}

export const pulsoConta = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => {
    const bruto = input && typeof input === "object" ? (input as Record<string, unknown>) : {};
    const equipeId = typeof bruto.equipeId === "string" && bruto.equipeId.trim() ? bruto.equipeId.trim().slice(0, 80) : null;
    const desde = typeof bruto.desde === "string" && bruto.desde.trim() ? bruto.desde.trim().slice(0, 40) : null;
    const marcaEquipes = typeof bruto.marcaEquipes === "string" ? bruto.marcaEquipes.slice(0, 80) : "";
    const marcaCi = typeof bruto.marcaCi === "string" ? bruto.marcaCi.slice(0, 160) : "";
    return { equipeId, desde, marcaEquipes, marcaCi };
  })
  .handler(async ({ context, data }) => {
    const userId = context.userId;
    const sql = await getSql();
    await garantirPulso(sql);
    const relogio = await sql<{ agora: Date | string }>`select clock_timestamp() as agora`;
    const brutoAgora = relogio[0]?.agora;
    const agora = brutoAgora instanceof Date ? brutoAgora.toISOString() : new Date(String(brutoAgora)).toISOString();
    const escopo = data.equipeId ?? userId;
    const permitido = data.equipeId
      ? (await sql<{ ok: number }>`select 1 as ok from equipe_membros where equipe_id = ${data.equipeId} and user_id = ${userId}`).length > 0
      : true;
    const desdeOk = Boolean(data.desde && !Number.isNaN(new Date(data.desde).getTime()) && permitido);
    const { processosAlterados } = await import("./processos.functions");
    const { adminAlterados } = await import("./admin.functions");
    const { equipesDaConta } = await import("./equipes.functions");
    const [legislativos, administrativos, removidosLeg, removidosAdm, marcaEquipes, marcaCiNotas, marcaCiAvulsas] = await Promise.all([
      desdeOk ? processosAlterados(userId, data.equipeId, data.desde as string, agora) : Promise.resolve([]),
      desdeOk ? adminAlterados(userId, data.equipeId, data.desde as string, agora) : Promise.resolve([]),
      desdeOk
        ? sql<{ id: string }>`
            select id from pulso_removido
            where tabela = 'processos' and escopo = ${escopo} and removido_em > ${data.desde}::timestamptz and removido_em <= ${agora}::timestamptz
          `
        : Promise.resolve([]),
      desdeOk
        ? sql<{ id: string }>`
            select id from pulso_removido
            where tabela = 'processos_admin' and escopo = ${escopo} and removido_em > ${data.desde}::timestamptz and removido_em <= ${agora}::timestamptz
          `
        : Promise.resolve([]),
      marca(
        sql,
        `select coalesce(md5(string_agg(m.equipe_id || m.user_id || m.papel || coalesce(e.nome, ''), '' order by m.equipe_id, m.user_id)), '') as marca
         from equipe_membros m
         join equipes e on e.id = m.equipe_id
         where m.equipe_id in (select equipe_id from equipe_membros where user_id = $1)`,
        [userId],
      ),
      marca(
        sql,
        `select coalesce(md5(string_agg(ano::text || '/' || numero::text || coalesce(destino, '') || coalesce(desativada::text, ''), '' order by ano, numero)), '') as marca from ci_inutilizada`,
        [],
      ),
      marca(
        sql,
        `select coalesce(md5(string_agg(ano::text || '/' || numero::text || coalesce(referencia, ''), '' order by ano, numero)), '') as marca from ci_avulsa`,
        [],
      ),
    ]);
    const ci = `${marcaCiNotas}.${marcaCiAvulsas}`;
    const { lerEstado, lerExclusao, marcarPresencaDe } = await import("./gestao.server");
    const [estado, exclusao, equipes] = await Promise.all([
      lerEstado(userId),
      lerExclusao({ userId }),
      marcarPresencaDe(userId).then(() =>
        data.marcaEquipes && data.marcaEquipes !== marcaEquipes ? equipesDaConta(userId) : Promise.resolve(null),
      ),
    ]);
    return {
      agora,
      estado,
      exclusao,
      legislativos,
      administrativos,
      removidosLegislativo: removidosLeg.map((item) => item.id),
      removidosAdministrativo: removidosAdm.map((item) => item.id),
      marcaEquipes,
      equipes,
      marcaCi: ci,
      ciMudou: Boolean(data.marcaCi && data.marcaCi !== ci),
    };
  });
