import { createServerFn } from "@tanstack/react-start";

export const abrirConviteEquipe = createServerFn({ method: "POST" })
  .validator((input: unknown) => {
    if (!input || typeof input !== "object") throw new Error("Dados inválidos");
    const token = (input as { token?: unknown }).token;
    if (typeof token !== "string" || !/^[a-f0-9]{64}$/.test(token)) throw new Error("Este convite não é válido.");
    return { token };
  })
  .handler(async ({ data }) => {
    const { abrirConvite } = await import("./convite-equipe.server");
    return abrirConvite(data.token);
  });
