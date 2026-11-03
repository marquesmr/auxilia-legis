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
