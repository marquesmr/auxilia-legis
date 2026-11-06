import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";

export const carregarInicio = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => {
    const bruto = input && typeof input === "object" ? (input as { equipeId?: unknown; token?: unknown }) : {};
    const equipeId =
      typeof bruto.equipeId === "string" && bruto.equipeId.trim() ? bruto.equipeId.trim().slice(0, 80) : null;
    const token = typeof bruto.token === "string" && /^[a-f0-9]{64}$/.test(bruto.token) ? bruto.token : "";
    return { equipeId, token };
  })
  .handler(async ({ context, data }) => {
    const { equipesDaConta } = await import("./equipes.functions");
    const { processosDaConta } = await import("./processos.functions");
    const { adminDaConta } = await import("./admin.functions");
    const { abasAtivas, lerEstado, lerExclusao, listarStatusCatalogo } = await import("./gestao.server");
    const userId = context.userId;
    const equipes = await equipesDaConta(userId);
    const equipeId = data.equipeId && equipes.some((equipe) => equipe.id === data.equipeId) ? data.equipeId : null;
    const [processos, administrativos, abas, estado, exclusao, status] = await Promise.all([
      processosDaConta(userId, equipeId),
      adminDaConta(userId, equipeId),
      abasAtivas(),
      lerEstado(userId),
      lerExclusao({ userId }),
      listarStatusCatalogo(),
    ]);
    return {
      equipes,
      equipeId,
      processos,
      administrativos,
      abas,
      estado,
      exclusao,
      navegador: { confiado: true, ativo: false, expiraEm: null as string | null },
      status,
    };
  });

const CORTE_TUTORIAL = "2026-11-06T18:05:00.000Z";

async function sqlTutorial() {
  const { getSql } = await import("./db");
  const sql = await getSql();
  await sql`
    create table if not exists tutorial_visto (
      user_id text primary key,
      visto_em timestamptz not null default now()
    )
  `;
  return sql;
}

export const estadoTutorial = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(() => ({}))
  .handler(async ({ context }) => {
    const sql = await sqlTutorial();
    const visto = await sql`select user_id from tutorial_visto where user_id = ${context.userId} limit 1`;
    if (visto.length > 0) return { mostrar: false };
    const conta = await sql<{ criado: string | Date | null }>`
      select "createdAt" as criado from "user" where id = ${context.userId} limit 1
    `;
    const bruto = conta[0]?.criado;
    if (!bruto) return { mostrar: false };
    const criado = new Date(bruto).getTime();
    return { mostrar: Number.isFinite(criado) && criado >= new Date(CORTE_TUTORIAL).getTime() };
  });

export const concluirTutorial = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(() => ({}))
  .handler(async ({ context }) => {
    const sql = await sqlTutorial();
    await sql`
      insert into tutorial_visto (user_id) values (${context.userId})
      on conflict (user_id) do nothing
    `;
    return { ok: true };
  });
