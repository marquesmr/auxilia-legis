import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";

function tokenOk(valor: unknown) {
  if (typeof valor !== "string" || !/^[a-f0-9]{64}$/.test(valor)) throw new Error("Entre de novo na área restrita.");
  return valor;
}

function areaOk(valor: unknown): "legislativo" | "administrativo" {
  return valor === "administrativo" ? "administrativo" : "legislativo";
}

async function mesmoLugar() {
  const { assertSameSiteRequest } = await import("./auth/isolation.server");
  assertSameSiteRequest();
}

export const entrarGestao = createServerFn({ method: "POST" })
  .validator((input: unknown) => {
    if (!input || typeof input !== "object") throw new Error("Dados inválidos");
    const bruto = input as { email?: unknown; senha?: unknown };
    if (typeof bruto.email !== "string" || typeof bruto.senha !== "string") throw new Error("Dados inválidos");
    return { email: bruto.email.trim().slice(0, 160), senha: bruto.senha.slice(0, 80) };
  })
  .handler(async ({ data }) => {
    await mesmoLugar();
    const { entrarGestao: entrar } = await import("./gestao.server");
    return entrar(data.email, data.senha);
  });

export const sairGestao = createServerFn({ method: "POST" })
  .validator(tokenOk)
  .handler(async ({ data }) => {
    await mesmoLugar();
    const { sairGestao: sair } = await import("./gestao.server");
    return sair(data);
  });

export const painelGestao = createServerFn({ method: "POST" })
  .validator(tokenOk)
  .handler(async ({ data }) => {
    await mesmoLugar();
    const { exigirGestao, lerPainel } = await import("./gestao.server");
    await exigirGestao(data);
    return lerPainel();
  });

export const salvarAbaGestao = createServerFn({ method: "POST" })
  .validator((input: unknown) => {
    if (!input || typeof input !== "object") throw new Error("Dados inválidos");
    const bruto = input as { token?: unknown; area?: unknown; nome?: unknown };
    return { token: tokenOk(bruto.token), area: areaOk(bruto.area), nome: String(bruto.nome ?? "") };
  })
  .handler(async ({ data }) => {
    await mesmoLugar();
    const { exigirGestao, criarAba } = await import("./gestao.server");
    await exigirGestao(data.token);
    return criarAba(data.area, data.nome);
  });

export const alternarAbaGestao = createServerFn({ method: "POST" })
  .validator((input: unknown) => {
    if (!input || typeof input !== "object") throw new Error("Dados inválidos");
    const bruto = input as { token?: unknown; id?: unknown; ativa?: unknown };
    if (typeof bruto.id !== "string" || !bruto.id.trim()) throw new Error("Dados inválidos");
    return { token: tokenOk(bruto.token), id: bruto.id.trim().slice(0, 80), ativa: Boolean(bruto.ativa) };
  })
  .handler(async ({ data }) => {
    await mesmoLugar();
    const { exigirGestao, alternarAba } = await import("./gestao.server");
    await exigirGestao(data.token);
    return alternarAba(data.id, data.ativa);
  });

export const trocarAcessoGestao = createServerFn({ method: "POST" })
  .validator((input: unknown) => {
    if (!input || typeof input !== "object") throw new Error("Dados inválidos");
    const bruto = input as { token?: unknown; email?: unknown; senhaAtual?: unknown; senhaNova?: unknown };
    if (typeof bruto.email !== "string" || typeof bruto.senhaAtual !== "string" || typeof bruto.senhaNova !== "string") {
      throw new Error("Dados inválidos");
    }
    return {
      token: tokenOk(bruto.token),
      email: bruto.email.trim().slice(0, 160),
      senhaAtual: bruto.senhaAtual.slice(0, 80),
      senhaNova: bruto.senhaNova.slice(0, 80),
    };
  })
  .handler(async ({ data }) => {
    await mesmoLugar();
    const { exigirGestao, trocarAcesso } = await import("./gestao.server");
    await exigirGestao(data.token);
    return trocarAcesso(data.email, data.senhaAtual, data.senhaNova);
  });

export const listarAbas = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async () => {
    const { abasAtivas } = await import("./gestao.server");
    return abasAtivas();
  });

export const consultarExclusao = createServerFn({ method: "POST" })
  .validator((input: unknown) => {
    if (!input || typeof input !== "object") throw new Error("Dados inválidos");
    const bruto = input as { userId?: unknown; email?: unknown };
    const userId = typeof bruto.userId === "string" ? bruto.userId.trim().slice(0, 80) : "";
    const email = typeof bruto.email === "string" ? bruto.email.trim().toLowerCase().slice(0, 160) : "";
    return { userId, email };
  })
  .handler(async ({ data }) => {
    const { lerExclusao } = await import("./gestao.server");
    return lerExclusao(data);
  });

export const limparAvisoExclusao = createServerFn({ method: "POST" })
  .validator((input: unknown) => {
    if (!input || typeof input !== "object") throw new Error("Dados inválidos");
    const email = (input as { email?: unknown }).email;
    if (typeof email !== "string" || !email.includes("@")) throw new Error("E-mail inválido.");
    return { email: email.trim().toLowerCase() };
  })
  .handler(async ({ data }) => {
    const { limparExclusao } = await import("./gestao.server");
    return limparExclusao(data.email);
  });

export const abrirGestaoPelaConta = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const { abrirGestaoPelaConta: abrir } = await import("./gestao.server");
    return abrir(context.userId);
  });

export const abrirSistemaGestao = createServerFn({ method: "POST" })
  .validator((input: unknown) => {
    if (!input || typeof input !== "object") throw new Error("Dados inválidos");
    const token = (input as { token?: unknown }).token;
    if (typeof token !== "string" || !/^[a-f0-9]{64}$/.test(token)) throw new Error("Sessão encerrada.");
    return { token };
  })
  .handler(async ({ data }) => {
    const { abrirSistemaPelaGestao } = await import("./gestao.server");
    return abrirSistemaPelaGestao(data.token);
  });

export const salvarSenhaCaixaGestao = createServerFn({ method: "POST" })
  .validator((input: unknown) => {
    if (!input || typeof input !== "object") throw new Error("Dados inválidos");
    const bruto = input as { token?: unknown; senha?: unknown };
    const senha = typeof bruto.senha === "string" ? bruto.senha : "";
    return { token: tokenOk(bruto.token), senha };
  })
  .handler(async ({ data }) => {
    await mesmoLugar();
    const { exigirGestao, salvarSenhaCaixa } = await import("./gestao.server");
    await exigirGestao(data.token);
    return salvarSenhaCaixa(data.senha);
  });

export const marcarPresenca = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const { marcarPresencaDe } = await import("./gestao.server");
    await marcarPresencaDe(context.userId);
    return { ok: true };
  });

export const estadoSistema = createServerFn({ method: "GET" }).handler(async () => {
  const { getSessionUser } = await import("./auth/verify.server");
  const { lerEstado } = await import("./gestao.server");
  let userId: string | null = null;
  try {
    userId = (await getSessionUser())?.id ?? null;
  } catch {
    userId = null;
  }
  return lerEstado(userId);
});

function idOk(valor: unknown) {
  if (typeof valor !== "string" || !valor.trim()) throw new Error("Dados inválidos");
  return valor.trim().slice(0, 80);
}

export const definirPapelGestao = createServerFn({ method: "POST" })
  .validator((input: unknown) => {
    if (!input || typeof input !== "object") throw new Error("Dados inválidos");
    const bruto = input as { token?: unknown; userId?: unknown; papel?: unknown };
    const papel = typeof bruto.papel === "string" ? bruto.papel : "";
    return { token: tokenOk(bruto.token), userId: idOk(bruto.userId), papel };
  })
  .handler(async ({ data }) => {
    await mesmoLugar();
    const { exigirGestao, definirPapel } = await import("./gestao.server");
    await exigirGestao(data.token);
    return definirPapel(data.userId, data.papel);
  });

export const bloquearUsuarioGestao = createServerFn({ method: "POST" })
  .validator((input: unknown) => {
    if (!input || typeof input !== "object") throw new Error("Dados inválidos");
    const bruto = input as { token?: unknown; userId?: unknown; bloqueado?: unknown };
    return { token: tokenOk(bruto.token), userId: idOk(bruto.userId), bloqueado: Boolean(bruto.bloqueado) };
  })
  .handler(async ({ data }) => {
    await mesmoLugar();
    const { exigirGestao, definirBloqueio } = await import("./gestao.server");
    await exigirGestao(data.token);
    return definirBloqueio(data.userId, data.bloqueado);
  });

export const excluirUsuarioGestao = createServerFn({ method: "POST" })
  .validator((input: unknown) => {
    if (!input || typeof input !== "object") throw new Error("Dados inválidos");
    const bruto = input as { token?: unknown; userId?: unknown; motivo?: unknown };
    const motivo = typeof bruto.motivo === "string" ? bruto.motivo : "";
    return { token: tokenOk(bruto.token), userId: idOk(bruto.userId), motivo };
  })
  .handler(async ({ data }) => {
    await mesmoLugar();
    const { exigirGestao, excluirUsuario } = await import("./gestao.server");
    await exigirGestao(data.token);
    return excluirUsuario(data.userId, data.motivo);
  });

export const vincularEquipeGestao = createServerFn({ method: "POST" })
  .validator((input: unknown) => {
    if (!input || typeof input !== "object") throw new Error("Dados inválidos");
    const bruto = input as { token?: unknown; equipeId?: unknown; userId?: unknown };
    return { token: tokenOk(bruto.token), equipeId: idOk(bruto.equipeId), userId: idOk(bruto.userId) };
  })
  .handler(async ({ data }) => {
    await mesmoLugar();
    const { exigirGestao, vincularEquipe } = await import("./gestao.server");
    await exigirGestao(data.token);
    return vincularEquipe(data.equipeId, data.userId);
  });

export const desvincularEquipeGestao = createServerFn({ method: "POST" })
  .validator((input: unknown) => {
    if (!input || typeof input !== "object") throw new Error("Dados inválidos");
    const bruto = input as { token?: unknown; equipeId?: unknown; userId?: unknown };
    return { token: tokenOk(bruto.token), equipeId: idOk(bruto.equipeId), userId: idOk(bruto.userId) };
  })
  .handler(async ({ data }) => {
    await mesmoLugar();
    const { exigirGestao, desvincularEquipe } = await import("./gestao.server");
    await exigirGestao(data.token);
    return desvincularEquipe(data.equipeId, data.userId);
  });

export const renomearAbaGestao = createServerFn({ method: "POST" })
  .validator((input: unknown) => {
    if (!input || typeof input !== "object") throw new Error("Dados inválidos");
    const bruto = input as { token?: unknown; id?: unknown; nome?: unknown };
    return { token: tokenOk(bruto.token), id: idOk(bruto.id), nome: String(bruto.nome ?? "") };
  })
  .handler(async ({ data }) => {
    await mesmoLugar();
    const { exigirGestao, renomearAba } = await import("./gestao.server");
    await exigirGestao(data.token);
    return renomearAba(data.id, data.nome);
  });

export const moverAbaGestao = createServerFn({ method: "POST" })
  .validator((input: unknown) => {
    if (!input || typeof input !== "object") throw new Error("Dados inválidos");
    const bruto = input as { token?: unknown; id?: unknown; direcao?: unknown };
    const direcao: -1 | 1 = bruto.direcao === -1 ? -1 : 1;
    if (bruto.direcao !== -1 && bruto.direcao !== 1) throw new Error("Dados inválidos");
    return { token: tokenOk(bruto.token), id: idOk(bruto.id), direcao };
  })
  .handler(async ({ data }) => {
    await mesmoLugar();
    const { exigirGestao, moverAba } = await import("./gestao.server");
    await exigirGestao(data.token);
    return moverAba(data.id, data.direcao);
  });

export const logsGestao = createServerFn({ method: "POST" })
  .validator((input: unknown) => {
    if (!input || typeof input !== "object") throw new Error("Dados inválidos");
    const bruto = input as { token?: unknown; de?: unknown; ate?: unknown; texto?: unknown; acao?: unknown; pagina?: unknown };
    return {
      token: tokenOk(bruto.token),
      de: typeof bruto.de === "string" ? bruto.de.slice(0, 10) : "",
      ate: typeof bruto.ate === "string" ? bruto.ate.slice(0, 10) : "",
      texto: typeof bruto.texto === "string" ? bruto.texto.slice(0, 80) : "",
      acao: typeof bruto.acao === "string" ? bruto.acao.slice(0, 80) : "",
      pagina: typeof bruto.pagina === "number" && Number.isFinite(bruto.pagina) ? Math.max(0, Math.floor(bruto.pagina)) : 0,
    };
  })
  .handler(async ({ data }) => {
    await mesmoLugar();
    const { exigirGestao, listarLogs } = await import("./gestao.server");
    await exigirGestao(data.token);
    return listarLogs(data);
  });

export const backupGestao = createServerFn({ method: "POST" })
  .validator(tokenOk)
  .handler(async ({ data }) => {
    await mesmoLugar();
    const { exigirGestao, fazerBackup } = await import("./gestao.server");
    await exigirGestao(data);
    return fazerBackup();
  });

export const backupsAutomaticosGestao = createServerFn({ method: "POST" })
  .validator(tokenOk)
  .handler(async ({ data }) => {
    await mesmoLugar();
    const { exigirGestao, listarBackupsAutomaticos } = await import("./gestao.server");
    await exigirGestao(data);
    return listarBackupsAutomaticos();
  });

export const restaurarAutomaticoGestao = createServerFn({ method: "POST" })
  .validator((input: unknown) => {
    if (!input || typeof input !== "object") throw new Error("Dados inválidos");
    const bruto = input as { token?: unknown; id?: unknown };
    if (typeof bruto.id !== "string") throw new Error("Escolha um backup da lista.");
    return { token: tokenOk(bruto.token), id: bruto.id.slice(0, 80) };
  })
  .handler(async ({ data }) => {
    await mesmoLugar();
    const { exigirGestao, restaurarBackupAutomatico } = await import("./gestao.server");
    await exigirGestao(data.token);
    return restaurarBackupAutomatico(data.id);
  });

export const restaurarGestao = createServerFn({ method: "POST" })
  .validator((input: unknown) => {
    if (!input || typeof input !== "object") throw new Error("Dados inválidos");
    const bruto = input as { token?: unknown; conteudo?: unknown };
    if (typeof bruto.conteudo !== "string") throw new Error("Arquivo inválido.");
    return { token: tokenOk(bruto.token), conteudo: bruto.conteudo };
  })
  .handler(async ({ data }) => {
    await mesmoLugar();
    const { exigirGestao, restaurarBackup } = await import("./gestao.server");
    await exigirGestao(data.token);
    return restaurarBackup(data.conteudo);
  });

export const feriadoGestao = createServerFn({ method: "POST" })
  .validator((input: unknown) => {
    if (!input || typeof input !== "object") throw new Error("Dados inválidos");
    const bruto = input as { token?: unknown; nome?: unknown; tipo?: unknown; inicio?: unknown; fim?: unknown; id?: unknown; apagar?: unknown };
    return {
      token: tokenOk(bruto.token),
      apagar: Boolean(bruto.apagar),
      id: typeof bruto.id === "string" ? bruto.id.slice(0, 80) : "",
      nome: typeof bruto.nome === "string" ? bruto.nome : "",
      tipo: bruto.tipo === "recesso" ? "recesso" : "feriado",
      inicio: typeof bruto.inicio === "string" ? bruto.inicio.slice(0, 10) : "",
      fim: typeof bruto.fim === "string" ? bruto.fim.slice(0, 10) : "",
    };
  })
  .handler(async ({ data }) => {
    await mesmoLugar();
    const { exigirGestao, salvarFeriado, apagarFeriado } = await import("./gestao.server");
    await exigirGestao(data.token);
    if (data.apagar) return apagarFeriado(data.id);
    return salvarFeriado(data);
  });

export const manutencaoGestao = createServerFn({ method: "POST" })
  .validator((input: unknown) => {
    if (!input || typeof input !== "object") throw new Error("Dados inválidos");
    const bruto = input as { token?: unknown; ligado?: unknown };
    return { token: tokenOk(bruto.token), ligado: Boolean(bruto.ligado) };
  })
  .handler(async ({ data }) => {
    await mesmoLugar();
    const { exigirGestao, definirManutencao } = await import("./gestao.server");
    await exigirGestao(data.token);
    return definirManutencao(data.ligado);
  });

