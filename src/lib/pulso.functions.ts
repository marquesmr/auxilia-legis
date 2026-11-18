import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";
import { getSql, type Sql } from "@/lib/db";

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
    if (input == null || input === "") return null;
    if (typeof input !== "string" || !input.trim()) throw new Error("Dados inválidos");
    return input.trim().slice(0, 80);
  })
  .handler(async ({ context, data: equipeId }) => {
    const userId = context.userId;
    const sql = await getSql();
    const filtro = equipeId
      ? "team_id = $1"
      : "team_id is null and user_id = $1";
    const alvo = equipeId ? [equipeId] : [userId];
    const consulta = (tabela: string) =>
      `select coalesce(md5(string_agg(md5(row_to_json(t)::text), '' order by t.id)), '') as marca from ${tabela} t where ${filtro}`;
    const [legislativo, administrativo, membros, nomes, modulos, ciNotas, ciAvulsas] = await Promise.all([
      marca(sql, consulta("processos"), alvo),
      marca(sql, consulta("processos_admin"), alvo),
      marca(
        sql,
        `select coalesce(md5(string_agg(md5(row_to_json(m)::text), '' order by m.equipe_id, m.user_id)), '') as marca
         from equipe_membros m
         where m.equipe_id in (select equipe_id from equipe_membros where user_id = $1)`,
        [userId],
      ),
      marca(
        sql,
        `select coalesce(md5(string_agg(id || nome, '' order by id)), '') as marca
         from equipes where id in (select equipe_id from equipe_membros where user_id = $1)`,
        [userId],
      ),
      marca(
        sql,
        `select coalesce(md5(string_agg(equipe_id || modulo, '' order by equipe_id, modulo)), '') as marca
         from equipe_modulos where equipe_id in (select equipe_id from equipe_membros where user_id = $1)`,
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
    const { lerEstado, lerExclusao, marcarPresencaDe } = await import("./gestao.server");
    const [estado, exclusao] = await Promise.all([
      lerEstado(userId),
      lerExclusao({ userId }),
      marcarPresencaDe(userId),
    ]);
    return {
      marca: [legislativo, administrativo, membros, nomes, modulos, ciNotas, ciAvulsas].join("."),
      estado,
      exclusao,
    };
  });
