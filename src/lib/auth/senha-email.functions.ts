import { createServerFn } from "@tanstack/react-start";

function emailOk(valor: unknown) {
  const email = typeof valor === "string" ? valor.trim().toLowerCase() : "";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 160) throw new Error("E-mail inválido.");
  return email;
}

export const pedirCodigoCadastro = createServerFn({ method: "POST" })
  .validator((input: unknown) => {
    if (!input || typeof input !== "object") throw new Error("Dados inválidos");
    const bruto = input as { email?: unknown; nome?: unknown };
    const nome = typeof bruto.nome === "string" ? bruto.nome.trim().replace(/\s+/g, " ").slice(0, 80) : "";
    if (nome.length < 2) throw new Error("Informe seu nome.");
    return { email: emailOk(bruto.email), nome };
  })
  .handler(async ({ data }) => {
    const { pedirCodigoCadastro: pedir } = await import("../cadastro-email.server");
    return pedir(data.email, data.nome);
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

export const criarContaComCodigo = createServerFn({ method: "POST" })
  .validator((input: unknown) => {
    if (!input || typeof input !== "object") throw new Error("Dados inválidos");
    const bruto = input as { nome?: unknown; email?: unknown; senha?: unknown; codigo?: unknown; idade?: unknown };
    const nome = typeof bruto.nome === "string" ? bruto.nome.trim().replace(/\s+/g, " ").slice(0, 80) : "";
    if (nome.length < 2) throw new Error("Informe seu nome.");
    const idade = Number(bruto.idade);
    if (!Number.isInteger(idade) || idade < 18 || idade > 120) throw new Error("Informe a idade. É preciso ter 18 anos ou mais.");
    const senha = typeof bruto.senha === "string" ? bruto.senha : "";
    if (senha.length < 8) throw new Error("A senha precisa ter pelo menos 8 caracteres.");
    if (senha.length > 128) throw new Error("A senha está longa demais.");
    const codigo = String(bruto.codigo ?? "").replace(/\D/g, "");
    if (!/^\d{6}$/.test(codigo)) throw new Error("Informe o código de 6 dígitos enviado por e-mail.");
    return { nome, email: emailOk(bruto.email), senha, codigo, idade };
  })
  .handler(async ({ data }) => {
    const { criarContaComCodigo: criar } = await import("../cadastro-email.server");
    return criar(data.nome, data.email, data.senha, data.codigo, data.idade);
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
