import { createServerFn } from "@tanstack/react-start";
import { idadeEm } from "@/lib/idade";

function emailOk(valor: unknown) {
  const email = typeof valor === "string" ? valor.trim().toLowerCase() : "";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 160) throw new Error("E-mail inválido.");
  return email;
}

export const pedirCodigoCadastro = createServerFn({ method: "POST" })
  .validator((input: unknown) => {
    if (!input || typeof input !== "object") throw new Error("Dados inválidos");
    const bruto = input as { email?: unknown; nome?: unknown; nascimento?: unknown; liberacao?: unknown };
    const nome = typeof bruto.nome === "string" ? bruto.nome.trim().replace(/\s+/g, " ").slice(0, 80) : "";
    if (nome.length < 2) throw new Error("Informe seu nome.");
    const nascimento = typeof bruto.nascimento === "string" ? bruto.nascimento : "";
    if (!/^\d{4}-\d{2}-\d{2}$/.test(nascimento)) throw new Error("Escolha a data de nascimento.");
    const liberacao = typeof bruto.liberacao === "string" ? bruto.liberacao : "";
    if (liberacao && !/^[a-f0-9]{64}$/.test(liberacao)) throw new Error("Este link de liberação não é válido.");
    return { email: emailOk(bruto.email), nome, nascimento, liberacao };
  })
  .handler(async ({ data }) => {
    const { pedirCodigoCadastro: pedir } = await import("../cadastro-email.server");
    return pedir(data.email, data.nome, data.nascimento, data.liberacao);
  });

export const entrarPeloLink = createServerFn({ method: "POST" })
  .validator((input: unknown) => {
    const token = input && typeof input === "object" ? (input as { token?: unknown }).token : "";
    if (typeof token !== "string" || !/^[a-f0-9]{64}$/.test(token)) throw new Error("Este link não é válido.");
    return { token };
  })
  .handler(async ({ data }) => {
    const { entrarPeloLink: entrar } = await import("../cadastro-email.server");
    return entrar(data.token);
  });

export const lerLiberacaoCadastro = createServerFn({ method: "POST" })
  .validator((input: unknown) => {
    const token = input && typeof input === "object" ? (input as { token?: unknown }).token : "";
    if (typeof token !== "string" || !/^[a-f0-9]{64}$/.test(token)) throw new Error("Este link de liberação não é válido.");
    return { token };
  })
  .handler(async ({ data }) => {
    const { lerLiberacao } = await import("../cadastro-email.server");
    return lerLiberacao(data.token);
  });

export const criarContaComCodigo = createServerFn({ method: "POST" })
  .validator((input: unknown) => {
    if (!input || typeof input !== "object") throw new Error("Dados inválidos");
    const bruto = input as { nome?: unknown; email?: unknown; senha?: unknown; codigo?: unknown; nascimento?: unknown; liberacao?: unknown };
    const nome = typeof bruto.nome === "string" ? bruto.nome.trim().replace(/\s+/g, " ").slice(0, 80) : "";
    if (nome.length < 2) throw new Error("Informe seu nome.");
    const nascimento = typeof bruto.nascimento === "string" ? bruto.nascimento : "";
    const idade = idadeEm(nascimento);
    if (idade == null || idade > 120) throw new Error("Escolha a data de nascimento.");
    const senha = typeof bruto.senha === "string" ? bruto.senha : "";
    if (senha.length < 8) throw new Error("A senha precisa ter pelo menos 8 caracteres.");
    if (senha.length > 128) throw new Error("A senha está longa demais.");
    const codigo = String(bruto.codigo ?? "").replace(/\D/g, "");
    if (!/^\d{6}$/.test(codigo)) throw new Error("Informe o código de 6 dígitos enviado por e-mail.");
    const liberacao = typeof bruto.liberacao === "string" ? bruto.liberacao : "";
    if (liberacao && !/^[a-f0-9]{64}$/.test(liberacao)) throw new Error("Este link de liberação não é válido.");
    return { nome, email: emailOk(bruto.email), senha, codigo, idade, nascimento, liberacao };
  })
  .handler(async ({ data }) => {
    const { criarContaComCodigo: criar } = await import("../cadastro-email.server");
    return criar(data.nome, data.email, data.senha, data.codigo, data.idade, data.nascimento, data.liberacao);
  });

export const pedirCodigoSenha = createServerFn({ method: "POST" })
  .validator((input: unknown) => {
    if (!input || typeof input !== "object") throw new Error("Dados inválidos");
    return { email: emailOk((input as { email?: unknown }).email) };
  })
  .handler(async ({ data }) => {
    const { pedirCodigoSenha: pedir } = await import("../senha-email.server");
    return pedir(data.email);
  });

export const redefinirComCodigo = createServerFn({ method: "POST" })
  .validator((input: unknown) => {
    if (!input || typeof input !== "object") throw new Error("Dados inválidos");
    const bruto = input as { email?: unknown; codigo?: unknown; senha?: unknown };
    const codigo = String(bruto.codigo ?? "").replace(/\D/g, "");
    if (!/^\d{6}$/.test(codigo)) throw new Error("Informe o código de 6 dígitos enviado por e-mail.");
    const senha = typeof bruto.senha === "string" ? bruto.senha : "";
    if (senha.length < 8) throw new Error("A senha precisa ter pelo menos 8 caracteres.");
    if (senha.length > 128) throw new Error("A senha está longa demais.");
    return { email: emailOk(bruto.email), codigo, senha };
  })
  .handler(async ({ data }) => {
    const { redefinirComCodigo: redefinir } = await import("../senha-email.server");
    return redefinir(data.email, data.codigo, data.senha);
  });
