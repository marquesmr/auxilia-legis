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

function statusEntrada(bruto: { nome?: unknown; encerra?: unknown; tramiteDias?: unknown; tramiteCodigo?: unknown }) {
  const dias = bruto.tramiteDias == null || bruto.tramiteDias === "" ? null : Number(bruto.tramiteDias);
  return {
    nome: typeof bruto.nome === "string" ? bruto.nome : "",
    encerra: Boolean(bruto.encerra),
    tramiteDias: dias != null && Number.isFinite(dias) ? Math.floor(dias) : null,
    tramiteCodigo: typeof bruto.tramiteCodigo === "string" && bruto.tramiteCodigo.trim() ? bruto.tramiteCodigo.trim().slice(0, 40) : null,
  };
}

export const criarStatusGestao = createServerFn({ method: "POST" })
  .validator((input: unknown) => {
    if (!input || typeof input !== "object") throw new Error("Dados inválidos");
    const bruto = input as { token?: unknown; area?: unknown; nome?: unknown; encerra?: unknown; tramiteDias?: unknown; tramiteCodigo?: unknown };
    return { token: tokenOk(bruto.token), area: areaOk(bruto.area), ...statusEntrada(bruto) };
  })
  .handler(async ({ data }) => {
    await mesmoLugar();
    const { exigirGestao, criarStatus } = await import("./gestao.server");
    await exigirGestao(data.token);
    return criarStatus(data);
  });

export const editarStatusGestao = createServerFn({ method: "POST" })
  .validator((input: unknown) => {
    if (!input || typeof input !== "object") throw new Error("Dados inválidos");
    const bruto = input as { token?: unknown; id?: unknown; nome?: unknown; encerra?: unknown; tramiteDias?: unknown; tramiteCodigo?: unknown };
    if (typeof bruto.id !== "string" || !bruto.id.trim()) throw new Error("Dados inválidos");
    return { token: tokenOk(bruto.token), id: bruto.id.trim().slice(0, 80), ...statusEntrada(bruto) };
  })
  .handler(async ({ data }) => {
    await mesmoLugar();
    const { exigirGestao, editarStatus } = await import("./gestao.server");
    await exigirGestao(data.token);
    return editarStatus(data);
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

export const pedirExclusaoConta = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => {
    if (!input || typeof input !== "object") throw new Error("Dados inválidos");
    const bruto = input as { motivo?: unknown; detalhe?: unknown };
    const motivo = typeof bruto.motivo === "string" ? bruto.motivo : "";
    const detalhe = typeof bruto.detalhe === "string" ? bruto.detalhe.slice(0, 500) : "";
    return { motivo, detalhe };
  })
  .handler(async ({ data, context }) => {
    await mesmoLugar();
    const { pedirExclusaoConta: pedir } = await import("./gestao.server");
    return pedir(context.userId, data.motivo, data.detalhe);
  });

export const registrarAcessoConta = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    await mesmoLugar();
    const { registrarAcessoConta: registrar } = await import("./gestao.server");
    return registrar(context.userId);
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

export const estadoSistema = createServerFn({ method: "POST" }).handler(async () => {
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

export const definirCidadeConta = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => {
    if (!input || typeof input !== "object") throw new Error("Dados inválidos");
    const bruto = input as { latitude?: unknown; longitude?: unknown };
    const latitude = typeof bruto.latitude === "number" ? bruto.latitude : Number.NaN;
    const longitude = typeof bruto.longitude === "number" ? bruto.longitude : Number.NaN;
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) throw new Error("Localização inválida.");
    return { latitude, longitude };
  })
  .handler(async ({ data, context }) => {
    await mesmoLugar();
    const { guardarCidadeUsuario } = await import("./gestao.server");
    return guardarCidadeUsuario(context.userId, data.latitude, data.longitude);
  });

function idOk(valor: unknown) {
  if (typeof valor !== "string" || !valor.trim()) throw new Error("Dados inválidos");
  return valor.trim().slice(0, 80);
}

export const liberarRestricaoGestao = createServerFn({ method: "POST" })
  .validator((input: unknown) => {
    if (!input || typeof input !== "object") throw new Error("Dados inválidos");
    const bruto = input as { token?: unknown; email?: unknown; nascimento?: unknown };
    const email = typeof bruto.email === "string" ? bruto.email.trim().toLowerCase() : "";
    const nascimento = typeof bruto.nascimento === "string" ? bruto.nascimento : "";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("E-mail inválido.");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(nascimento)) throw new Error("Informe a data confirmada por e-mail.");
    return { token: tokenOk(bruto.token), email, nascimento };
  })
  .handler(async ({ data }) => {
    await mesmoLugar();
    const { exigirGestao, liberarEmailRestrito } = await import("./gestao.server");
    await exigirGestao(data.token);
    return liberarEmailRestrito(data.email, data.nascimento);
  });

export const manterBloqueioGestao = createServerFn({ method: "POST" })
  .validator((input: unknown) => {
    if (!input || typeof input !== "object") throw new Error("Dados inválidos");
    const bruto = input as { token?: unknown; email?: unknown };
    const email = typeof bruto.email === "string" ? bruto.email.trim().toLowerCase() : "";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("E-mail inválido.");
    return { token: tokenOk(bruto.token), email };
  })
  .handler(async ({ data }) => {
    await mesmoLugar();
    const { exigirGestao, manterBloqueioEmail } = await import("./gestao.server");
    await exigirGestao(data.token);
    return manterBloqueioEmail(data.email);
  });

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

function idsDaOrdem(valor: unknown) {
  if (!Array.isArray(valor) || valor.length < 1 || valor.length > 80) throw new Error("Dados inválidos");
  return valor.map((id) => {
    if (typeof id !== "string" || !id.trim()) throw new Error("Dados inválidos");
    return id.trim().slice(0, 80);
  });
}

export const ordenarStatusGestao = createServerFn({ method: "POST" })
  .validator((input: unknown) => {
    if (!input || typeof input !== "object") throw new Error("Dados inválidos");
    const bruto = input as { token?: unknown; ids?: unknown };
    return { token: tokenOk(bruto.token), ids: idsDaOrdem(bruto.ids) };
  })
  .handler(async ({ data }) => {
    await mesmoLugar();
    const { exigirGestao, ordenarStatus } = await import("./gestao.server");
    await exigirGestao(data.token);
    return ordenarStatus(data.ids);
  });

export const ordenarAbasGestao = createServerFn({ method: "POST" })
  .validator((input: unknown) => {
    if (!input || typeof input !== "object") throw new Error("Dados inválidos");
    const bruto = input as { token?: unknown; ids?: unknown };
    return { token: tokenOk(bruto.token), ids: idsDaOrdem(bruto.ids) };
  })
  .handler(async ({ data }) => {
    await mesmoLugar();
    const { exigirGestao, ordenarAbas } = await import("./gestao.server");
    await exigirGestao(data.token);
    return ordenarAbas(data.ids);
  });

export const apagarAbaGestao = createServerFn({ method: "POST" })
  .validator((input: unknown) => {
    if (!input || typeof input !== "object") throw new Error("Dados inválidos");
    const bruto = input as { token?: unknown; id?: unknown };
    return { token: tokenOk(bruto.token), id: idOk(bruto.id) };
  })
  .handler(async ({ data }) => {
    await mesmoLugar();
    const { exigirGestao, apagarAba } = await import("./gestao.server");
    await exigirGestao(data.token);
    return apagarAba(data.id);
  });

export const apagarStatusGestao = createServerFn({ method: "POST" })
  .validator((input: unknown) => {
    if (!input || typeof input !== "object") throw new Error("Dados inválidos");
    const bruto = input as { token?: unknown; id?: unknown };
    return { token: tokenOk(bruto.token), id: idOk(bruto.id) };
  })
  .handler(async ({ data }) => {
    await mesmoLugar();
    const { exigirGestao, apagarStatus } = await import("./gestao.server");
    await exigirGestao(data.token);
    return apagarStatus(data.id);
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

export const clienteGoogleGestao = createServerFn({ method: "POST" })
  .validator(tokenOk)
  .handler(async ({ data }) => {
    await mesmoLugar();
    const { exigirGestao } = await import("./gestao.server");
    await exigirGestao(data);
    const clientId = process.env.GOOGLE_CLIENT_ID?.trim() || "";
    if (!clientId) throw new Error("O login do Google ainda não está configurado.");
    return { clientId };
  });

export const enviarBackupDriveGestao = createServerFn({ method: "POST" })
  .validator((input: unknown) => {
    if (!input || typeof input !== "object") throw new Error("Dados inválidos");
    const bruto = input as { token?: unknown; codigo?: unknown };
    if (typeof bruto.codigo !== "string" || bruto.codigo.length < 8 || bruto.codigo.length > 2048) {
      throw new Error("O Google não devolveu a autorização.");
    }
    return { token: tokenOk(bruto.token), codigo: bruto.codigo };
  })
  .handler(async ({ data }) => {
    await mesmoLugar();
    const { exigirGestao, fazerBackup } = await import("./gestao.server");
    const { autorizarDriveEEnviarManual } = await import("./google-drive.server");
    await exigirGestao(data.token);
    const arquivo = await fazerBackup();
    return autorizarDriveEEnviarManual(data.codigo, arquivo.conteudo);
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
      tipo: bruto.tipo === "recesso" ? "recesso" : bruto.tipo === "facultativo" ? "facultativo" : "feriado",
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

export const editarFeriadoGestao = createServerFn({ method: "POST" })
  .validator((input: unknown) => {
    if (!input || typeof input !== "object") throw new Error("Dados inválidos");
    const bruto = input as { token?: unknown; id?: unknown; nome?: unknown; tipo?: unknown; inicio?: unknown; fim?: unknown; ambito?: unknown; municipio?: unknown };
    const id = typeof bruto.id === "string" ? bruto.id.slice(0, 80) : "";
    if (!id) throw new Error("Feriado inválido.");
    return {
      token: tokenOk(bruto.token),
      id,
      nome: typeof bruto.nome === "string" ? bruto.nome : "",
      tipo: bruto.tipo === "recesso" ? "recesso" : bruto.tipo === "facultativo" ? "facultativo" : "feriado",
      inicio: typeof bruto.inicio === "string" ? bruto.inicio.slice(0, 10) : "",
      fim: typeof bruto.fim === "string" ? bruto.fim.slice(0, 10) : "",
      ambito: bruto.ambito === "nacional" || bruto.ambito === "municipal" ? bruto.ambito : "",
      municipio: typeof bruto.municipio === "string" ? bruto.municipio.slice(0, 80) : "",
    };
  })
  .handler(async ({ data }) => {
    await mesmoLugar();
    const { exigirGestao, editarFeriado } = await import("./gestao.server");
    await exigirGestao(data.token);
    return editarFeriado(data);
  });

export const lerCalendarioGestao = createServerFn({ method: "POST" })
  .validator((input: unknown) => {
    if (!input || typeof input !== "object") throw new Error("Dados inválidos");
    const bruto = input as { token?: unknown; imagem?: unknown };
    const imagem = typeof bruto.imagem === "string" ? bruto.imagem : "";
    if (!imagem.startsWith("data:image/") || imagem.length > 1_400_000) throw new Error("Envie uma imagem de até 1 MB.");
    return { token: tokenOk(bruto.token), imagem };
  })
  .handler(async ({ data }) => {
    await mesmoLugar();
    const { exigirGestao, guardarFeriadosLidos } = await import("./gestao.server");
    await exigirGestao(data.token);
    const { lerImagemCalendario } = await import("./calendario-imagem.server");
    const itens = await lerImagemCalendario(data.imagem);
    return guardarFeriadosLidos(itens);
  });

export const decidirFeriadoGestao = createServerFn({ method: "POST" })
  .validator((input: unknown) => {
    if (!input || typeof input !== "object") throw new Error("Dados inválidos");
    const bruto = input as { token?: unknown; id?: unknown; ambito?: unknown; municipio?: unknown };
    const ambito = bruto.ambito === "nacional" || bruto.ambito === "municipal" || bruto.ambito === "descartar" ? bruto.ambito : "";
    if (!ambito) throw new Error("Diga se o feriado é nacional ou municipal.");
    const id = typeof bruto.id === "string" ? bruto.id.slice(0, 80) : "";
    if (!id) throw new Error("Feriado inválido.");
    const municipio = typeof bruto.municipio === "string" ? bruto.municipio.slice(0, 80) : "";
    return { token: tokenOk(bruto.token), id, ambito, municipio };
  })
  .handler(async ({ data }) => {
    await mesmoLugar();
    const { exigirGestao, decidirFeriado } = await import("./gestao.server");
    await exigirGestao(data.token);
    return decidirFeriado(data.id, data.ambito as "nacional" | "municipal" | "descartar", data.municipio);
  });

export const manutencaoGestao = createServerFn({ method: "POST" })
  .validator((input: unknown) => {
    if (!input || typeof input !== "object") throw new Error("Dados inválidos");
    const bruto = input as { token?: unknown; inicio?: unknown; fim?: unknown };
    const inicio = typeof bruto.inicio === "string" ? bruto.inicio.slice(0, 16) : "";
    const fim = typeof bruto.fim === "string" ? bruto.fim.slice(0, 16) : "";
    return { token: tokenOk(bruto.token), inicio, fim };
  })
  .handler(async ({ data }) => {
    await mesmoLugar();
    const { exigirGestao, definirAvisoManutencao } = await import("./gestao.server");
    await exigirGestao(data.token);
    return definirAvisoManutencao(data.inicio, data.fim);
  });

export const convitesPendentesGestao = createServerFn({ method: "POST" })
  .validator(tokenOk)
  .handler(async ({ data }) => {
    await mesmoLugar();
    const { exigirGestao } = await import("./gestao.server");
    await exigirGestao(data);
    const { listarConvitesPendentes } = await import("./convite-equipe.server");
    return listarConvitesPendentes();
  });

export const cancelarConviteGestao = createServerFn({ method: "POST" })
  .validator((input: unknown) => {
    if (!input || typeof input !== "object") throw new Error("Dados inválidos");
    const bruto = input as { token?: unknown; equipeId?: unknown; email?: unknown };
    const equipeId = typeof bruto.equipeId === "string" ? bruto.equipeId.trim().slice(0, 80) : "";
    const email = typeof bruto.email === "string" ? bruto.email.trim().toLowerCase().slice(0, 160) : "";
    if (!equipeId || !email) throw new Error("Convite inválido.");
    return { token: tokenOk(bruto.token), equipeId, email };
  })
  .handler(async ({ data }) => {
    await mesmoLugar();
    const { exigirGestao } = await import("./gestao.server");
    await exigirGestao(data.token);
    const { cancelarConvitePendente } = await import("./convite-equipe.server");
    return cancelarConvitePendente(data.equipeId, data.email);
  });

export const equipesPorModuloGestao = createServerFn({ method: "POST" })
  .validator(tokenOk)
  .handler(async ({ data }) => {
    await mesmoLugar();
    const { exigirGestao } = await import("./gestao.server");
    await exigirGestao(data);
    const { listarAtribuicaoModulos } = await import("./equipes.functions");
    return listarAtribuicaoModulos();
  });

export const definirModulosEquipeGestao = createServerFn({ method: "POST" })
  .validator((input: unknown) => {
    if (!input || typeof input !== "object") throw new Error("Dados inválidos");
    const bruto = input as { token?: unknown; equipeId?: unknown; modulos?: unknown };
    const equipeId = typeof bruto.equipeId === "string" ? bruto.equipeId.trim().slice(0, 80) : "";
    const recebidos = Array.isArray(bruto.modulos) ? bruto.modulos : [];
    const modulos = recebidos.filter((item): item is "legislativo" | "administrativo" => item === "legislativo" || item === "administrativo");
    if (!equipeId || !modulos.length) throw new Error("A equipe precisa ficar em pelo menos um módulo.");
    return { token: tokenOk(bruto.token), equipeId, modulos };
  })
  .handler(async ({ data }) => {
    await mesmoLugar();
    const { exigirGestao } = await import("./gestao.server");
    await exigirGestao(data.token);
    const { definirModulosEquipe } = await import("./equipes.functions");
    return definirModulosEquipe(data.equipeId, data.modulos);
  });

export const listarTimbradosGestao = createServerFn({ method: "POST" })
  .validator(tokenOk)
  .handler(async ({ data }) => {
    await mesmoLugar();
    const { exigirGestao, listarTimbrados } = await import("./gestao.server");
    await exigirGestao(data);
    return listarTimbrados();
  });

export const salvarTimbradoGestao = createServerFn({ method: "POST" })
  .validator((input: unknown) => {
    if (!input || typeof input !== "object") throw new Error("Dados inválidos");
    const bruto = input as { token?: unknown; equipeId?: unknown; imagem?: unknown; linha1?: unknown; linha2?: unknown; rodape1?: unknown; rodape2?: unknown };
    return {
      token: tokenOk(bruto.token),
      equipeId: idOk(bruto.equipeId),
      imagem: typeof bruto.imagem === "string" ? bruto.imagem : "",
      linha1: typeof bruto.linha1 === "string" ? bruto.linha1 : "",
      linha2: typeof bruto.linha2 === "string" ? bruto.linha2 : "",
      rodape1: typeof bruto.rodape1 === "string" ? bruto.rodape1 : "",
      rodape2: typeof bruto.rodape2 === "string" ? bruto.rodape2 : "",
    };
  })
  .handler(async ({ data }) => {
    await mesmoLugar();
    const { exigirGestao, salvarTimbrado } = await import("./gestao.server");
    await exigirGestao(data.token);
    return salvarTimbrado(data);
  });

