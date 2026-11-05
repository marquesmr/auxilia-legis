import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";

export type SocioCnpj = { nome: string; qualificacao: string };

export type ConsultaCnpj = {
  cnpj: string;
  razaoSocial: string;
  nomeFantasia: string;
  situacao: string;
  abertura: string;
  natureza: string;
  porte: string;
  capital: string;
  cnae: string;
  endereco: string;
  cep: string;
  telefone: string;
  email: string;
  socios: SocioCnpj[];
};

function cnpjValido(digitos: string): boolean {
  if (!/^\d{14}$/.test(digitos) || /^(\d)\1+$/.test(digitos)) return false;
  const digito = (base: string, pesos: number[]) => {
    const soma = base.split("").reduce((total, numero, indice) => total + Number(numero) * pesos[indice], 0);
    const resto = soma % 11;
    return resto < 2 ? 0 : 11 - resto;
  };
  const primeiro = digito(digitos.slice(0, 12), [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  const segundo = digito(digitos.slice(0, 12) + primeiro, [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  return digitos.endsWith(`${primeiro}${segundo}`);
}

function texto(valor: unknown): string {
  return typeof valor === "string" ? valor.trim() : "";
}

function formatarCnpj(digitos: string): string {
  return digitos.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");
}

function formatarData(valor: string): string {
  const iso = valor.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return valor;
  const [ano, mes, dia] = iso.split("-");
  return `${dia}/${mes}/${ano}`;
}

function formatarCep(valor: string): string {
  const digitos = valor.replace(/\D/g, "");
  if (digitos.length !== 8) return valor;
  return digitos.replace(/^(\d{5})(\d{3})$/, "$1-$2");
}

function formatarCapital(valor: unknown): string {
  const numero = typeof valor === "number" ? valor : Number(String(valor ?? "").replace(",", "."));
  if (!Number.isFinite(numero)) return "";
  return numero.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function montar(bruto: Record<string, unknown>, digitos: string): ConsultaCnpj {
  const partes = [texto(bruto.descricao_tipo_de_logradouro), texto(bruto.logradouro), texto(bruto.numero), texto(bruto.complemento), texto(bruto.bairro), texto(bruto.municipio), texto(bruto.uf)].filter(Boolean);
  const cnaeCodigo = bruto.cnae_fiscal == null ? "" : String(bruto.cnae_fiscal);
  const cnaeNome = texto(bruto.cnae_fiscal_descricao);
  const sociosBrutos = Array.isArray(bruto.qsa) ? bruto.qsa : [];
  const socios = sociosBrutos.slice(0, 30).flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const socio = item as Record<string, unknown>;
    const nome = texto(socio.nome_socio);
    if (!nome) return [];
    return [{ nome, qualificacao: texto(socio.qualificacao_socio) }];
  });
  return {
    cnpj: formatarCnpj(digitos),
    razaoSocial: texto(bruto.razao_social),
    nomeFantasia: texto(bruto.nome_fantasia),
    situacao: texto(bruto.descricao_situacao_cadastral),
    abertura: formatarData(texto(bruto.data_inicio_atividade)),
    natureza: texto(bruto.natureza_juridica),
    porte: texto(bruto.porte),
    capital: formatarCapital(bruto.capital_social),
    cnae: [cnaeCodigo, cnaeNome].filter(Boolean).join(" — "),
    endereco: partes.join(", "),
    cep: formatarCep(texto(bruto.cep)),
    telefone: texto(bruto.ddd_telefone_1),
    email: texto(bruto.email),
    socios,
  };
}

async function buscarJson(url: string): Promise<Record<string, unknown> | null> {
  const resposta = await fetch(url, { headers: { accept: "application/json" }, signal: AbortSignal.timeout(12000) });
  if (resposta.status === 404) return null;
  if (!resposta.ok) throw new Error("indisponivel");
  const json = (await resposta.json()) as unknown;
  if (!json || typeof json !== "object") throw new Error("indisponivel");
  return json as Record<string, unknown>;
}

export const consultarCnpj = createServerFn({ method: "POST" })
  .validator((input: unknown) => {
    const digitos = typeof input === "string" ? input.replace(/\D/g, "") : "";
    if (!cnpjValido(digitos)) throw new Error("Informe um CNPJ válido.");
    return digitos;
  })
  .middleware([authMiddleware])
  .handler(async ({ data }) => {
    const fontes = [`https://brasilapi.com.br/api/cnpj/v1/${data}`, `https://minhareceita.org/${data}`];
    let ultimoErro = false;
    for (const fonte of fontes) {
      try {
        const json = await buscarJson(fonte);
        if (!json) throw new Error("CNPJ não encontrado na Receita Federal.");
        const consulta = montar(json, data);
        if (!consulta.razaoSocial) throw new Error("indisponivel");
        return consulta;
      } catch (err) {
        if (err instanceof Error && err.message === "CNPJ não encontrado na Receita Federal.") throw err;
        ultimoErro = true;
      }
    }
    if (ultimoErro) throw new Error("Não foi possível consultar o CNPJ agora. Tente de novo.");
    throw new Error("CNPJ não encontrado na Receita Federal.");
  });
