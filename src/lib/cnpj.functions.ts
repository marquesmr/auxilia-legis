import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";

export type SocioCnpj = { nome: string; qualificacao: string };

export type ConsultaCpf = {
  cpf: string;
  valido: boolean;
  regiao: string;
  aviso: string;
};

export type ConsultaDocumento =
  | ({ tipo: "cnpj" } & ConsultaCnpj)
  | ({ tipo: "cpf" } & ConsultaCpf);

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
  uf: string;
  municipio: string;
  cep: string;
  telefone: string;
  email: string;
  socios: SocioCnpj[];
};

function cpfValido(digitos: string): boolean {
  if (!/^\d{11}$/.test(digitos) || /^(\d)\1+$/.test(digitos)) return false;
  const digito = (tamanho: number) => {
    let soma = 0;
    for (let indice = 0; indice < tamanho; indice++) soma += Number(digitos[indice]) * (tamanho + 1 - indice);
    const resto = (soma * 10) % 11;
    return resto === 10 ? 0 : resto;
  };
  return digito(9) === Number(digitos[9]) && digito(10) === Number(digitos[10]);
}

function formatarCpf(digitos: string): string {
  return digitos.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, "$1.$2.$3-$4");
}
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

function objeto(valor: unknown): Record<string, unknown> | null {
  return valor && typeof valor === "object" && !Array.isArray(valor) ? (valor as Record<string, unknown>) : null;
}

function descricao(valor: unknown): string {
  if (typeof valor === "string") return valor.trim();
  const item = objeto(valor);
  if (!item) return "";
  return texto(item.descricao) || texto(item.text) || texto(item.nome);
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
  const numero = typeof valor === "number"
    ? valor
    : Number(String(valor ?? "").trim().includes(",") ? String(valor).trim().replace(/\./g, "").replace(",", ".") : String(valor ?? "").trim());
  if (!Number.isFinite(numero) || String(valor ?? "").trim() === "") return "";
  return numero.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatarTelefone(ddd: string, numero: string): string {
  const digitos = `${ddd}${numero}`.replace(/\D/g, "");
  if (digitos.length === 10) return digitos.replace(/^(\d{2})(\d{4})(\d{4})$/, "($1) $2-$3");
  if (digitos.length === 11) return digitos.replace(/^(\d{2})(\d{5})(\d{4})$/, "($1) $2-$3");
  return [ddd, numero].filter(Boolean).join(" ").trim();
}

function juntarEndereco(partes: string[]): string {
  return partes.map((parte) => parte.trim()).filter(Boolean).join(", ");
}

function montarBrasil(bruto: Record<string, unknown>, digitos: string): ConsultaCnpj | null {
  const razaoSocial = texto(bruto.razao_social);
  if (!razaoSocial || bruto.estabelecimento || bruto.taxId) return null;
  const sociosBrutos = Array.isArray(bruto.qsa) ? bruto.qsa : [];
  return {
    cnpj: formatarCnpj(digitos),
    razaoSocial,
    nomeFantasia: texto(bruto.nome_fantasia),
    situacao: texto(bruto.descricao_situacao_cadastral),
    abertura: formatarData(texto(bruto.data_inicio_atividade)),
    natureza: texto(bruto.natureza_juridica),
    porte: texto(bruto.porte),
    capital: formatarCapital(bruto.capital_social),
    cnae: [bruto.cnae_fiscal == null ? "" : String(bruto.cnae_fiscal), texto(bruto.cnae_fiscal_descricao)].filter(Boolean).join(" — "),
    endereco: juntarEndereco([texto(bruto.descricao_tipo_de_logradouro), texto(bruto.logradouro), texto(bruto.numero), texto(bruto.complemento), texto(bruto.bairro), texto(bruto.municipio), texto(bruto.uf)]),
    uf: texto(bruto.uf),
    municipio: texto(bruto.municipio),
    cep: formatarCep(texto(bruto.cep)),
    telefone: formatarTelefone("", texto(bruto.ddd_telefone_1)),
    email: texto(bruto.email),
    socios: sociosBrutos.slice(0, 30).flatMap((item) => {
      const socio = objeto(item);
      const nome = socio ? texto(socio.nome_socio) : "";
      if (!nome) return [];
      return [{ nome, qualificacao: texto(socio?.qualificacao_socio) }];
    }),
  };
}

function montarCnpjWs(bruto: Record<string, unknown>, digitos: string): ConsultaCnpj | null {
  const estabelecimento = objeto(bruto.estabelecimento);
  const razaoSocial = texto(bruto.razao_social);
  if (!estabelecimento || !razaoSocial) return null;
  const atividade = objeto(estabelecimento.atividade_principal);
  const cidade = objeto(estabelecimento.cidade);
  const estado = objeto(estabelecimento.estado);
  const sociosBrutos = Array.isArray(bruto.socios) ? bruto.socios : [];
  return {
    cnpj: formatarCnpj(digitos),
    razaoSocial,
    nomeFantasia: texto(estabelecimento.nome_fantasia),
    situacao: texto(estabelecimento.situacao_cadastral),
    abertura: formatarData(texto(estabelecimento.data_inicio_atividade)),
    natureza: descricao(bruto.natureza_juridica),
    porte: descricao(bruto.porte),
    capital: formatarCapital(bruto.capital_social),
    cnae: [atividade ? texto(atividade.subclasse) || texto(atividade.id) : "", atividade ? texto(atividade.descricao) : ""].filter(Boolean).join(" — "),
    endereco: juntarEndereco([texto(estabelecimento.tipo_logradouro), texto(estabelecimento.logradouro), texto(estabelecimento.numero), texto(estabelecimento.complemento), texto(estabelecimento.bairro), cidade ? texto(cidade.nome) : "", estado ? texto(estado.sigla) : ""]),
    uf: estado ? texto(estado.sigla) : "",
    municipio: cidade ? texto(cidade.nome) : "",
    cep: formatarCep(texto(estabelecimento.cep)),
    telefone: formatarTelefone(texto(estabelecimento.ddd1), texto(estabelecimento.telefone1)),
    email: texto(estabelecimento.email),
    socios: sociosBrutos.slice(0, 30).flatMap((item) => {
      const socio = objeto(item);
      const nome = socio ? texto(socio.nome) : "";
      if (!nome) return [];
      return [{ nome, qualificacao: descricao(socio?.qualificacao_socio) }];
    }),
  };
}

function montarCnpja(bruto: Record<string, unknown>, digitos: string): ConsultaCnpj | null {
  const empresa = objeto(bruto.company);
  const razaoSocial = empresa ? texto(empresa.name) : "";
  if (!razaoSocial || !bruto.taxId) return null;
  const endereco = objeto(bruto.address);
  const atividade = objeto(bruto.mainActivity);
  const telefones = Array.isArray(bruto.phones) ? bruto.phones : [];
  const primeiroTelefone = objeto(telefones[0]);
  const emails = Array.isArray(bruto.emails) ? bruto.emails : [];
  const primeiroEmail = objeto(emails[0]);
  const membros = empresa && Array.isArray(empresa.members) ? empresa.members : [];
  return {
    cnpj: formatarCnpj(digitos),
    razaoSocial,
    nomeFantasia: texto(bruto.alias),
    situacao: descricao(bruto.status),
    abertura: formatarData(texto(bruto.founded)),
    natureza: descricao(empresa?.nature),
    porte: descricao(empresa?.size),
    capital: formatarCapital(empresa?.equity),
    cnae: [atividade?.id == null ? "" : String(atividade.id), atividade ? texto(atividade.text) : ""].filter(Boolean).join(" — "),
    endereco: endereco ? juntarEndereco([texto(endereco.street), texto(endereco.number), texto(endereco.details), texto(endereco.district), texto(endereco.city), texto(endereco.state)]) : "",
    uf: endereco ? texto(endereco.state) : "",
    municipio: endereco ? texto(endereco.city) : "",
    cep: endereco ? formatarCep(texto(endereco.zip)) : "",
    telefone: primeiroTelefone ? formatarTelefone(texto(primeiroTelefone.area), texto(primeiroTelefone.number)) : "",
    email: primeiroEmail ? texto(primeiroEmail.address) : "",
    socios: membros.slice(0, 30).flatMap((item) => {
      const membro = objeto(item);
      const pessoa = membro ? objeto(membro.person) : null;
      const nome = pessoa ? texto(pessoa.name) : "";
      if (!nome) return [];
      return [{ nome, qualificacao: descricao(membro?.role) }];
    }),
  };
}

function montarReceitaWs(bruto: Record<string, unknown>, digitos: string): ConsultaCnpj | null {
  const razaoSocial = texto(bruto.nome);
  if (!razaoSocial || !texto(bruto.abertura)) return null;
  const atividades = Array.isArray(bruto.atividade_principal) ? bruto.atividade_principal : [];
  const atividade = objeto(atividades[0]);
  const sociosBrutos = Array.isArray(bruto.qsa) ? bruto.qsa : [];
  return {
    cnpj: formatarCnpj(digitos),
    razaoSocial,
    nomeFantasia: texto(bruto.fantasia),
    situacao: texto(bruto.situacao),
    abertura: texto(bruto.abertura),
    natureza: texto(bruto.natureza_juridica),
    porte: texto(bruto.porte),
    capital: formatarCapital(bruto.capital_social),
    cnae: [atividade ? texto(atividade.code) : "", atividade ? texto(atividade.text) : ""].filter(Boolean).join(" — "),
    endereco: juntarEndereco([texto(bruto.logradouro), texto(bruto.numero), texto(bruto.complemento), texto(bruto.bairro), texto(bruto.municipio), texto(bruto.uf)]),
    uf: texto(bruto.uf),
    municipio: texto(bruto.municipio),
    cep: formatarCep(texto(bruto.cep)),
    telefone: texto(bruto.telefone),
    email: texto(bruto.email),
    socios: sociosBrutos.slice(0, 30).flatMap((item) => {
      const socio = objeto(item);
      const nome = socio ? texto(socio.nome) : "";
      if (!nome) return [];
      return [{ nome, qualificacao: texto(socio?.qual) }];
    }),
  };
}

function interpretar(bruto: Record<string, unknown>, digitos: string): ConsultaCnpj | null {
  return montarCnpja(bruto, digitos) || montarCnpjWs(bruto, digitos) || montarReceitaWs(bruto, digitos) || montarBrasil(bruto, digitos);
}

async function buscarJson(url: string): Promise<Record<string, unknown> | "ausente" | null> {
  const resposta = await fetch(url, {
    headers: { accept: "application/json", "user-agent": "AuxiliaLegis/1.0" },
    signal: AbortSignal.timeout(12000),
  });
  if (resposta.status === 404) return "ausente";
  if (!resposta.ok) return null;
  const json = (await resposta.json()) as unknown;
  const item = objeto(json);
  if (!item) return null;
  if (texto(item.status) === "ERROR" || texto(item.message).toLowerCase().includes("não encontrado")) return "ausente";
  return item;
}

export const consultarDocumento = createServerFn({ method: "POST" })
  .validator((input: unknown) => {
    const bruto = input && typeof input === "object" && !Array.isArray(input) ? (input as { documento?: unknown; nascimento?: unknown }) : { documento: input, nascimento: "" };
    const origem = typeof bruto.documento === "string" ? bruto.documento : typeof input === "string" ? input : "";
    const digitos = origem.replace(/\D/g, "");
    const nascimento = typeof bruto.nascimento === "string" ? bruto.nascimento : "";
    if (digitos.length === 11) {
      if (!cpfValido(digitos)) throw new Error("Informe um CPF válido.");
      if (!/^\d{4}-\d{2}-\d{2}$/.test(nascimento)) throw new Error("Informe a data de nascimento.");
      return { tipo: "cpf" as const, digitos, nascimento };
    }
    if (!cnpjValido(digitos)) throw new Error("Informe um CPF ou CNPJ válido.");
    return { tipo: "cnpj" as const, digitos, nascimento: "" };
  })
  .middleware([authMiddleware])
  .handler(async ({ data }): Promise<ConsultaDocumento> => {
    if (data.tipo === "cpf") return consultarCpf(data.digitos, data.nascimento);
    const empresa = await consultarEmpresa(data.digitos);
    return { tipo: "cnpj", ...empresa };
  });

async function consultarCpf(digitos: string, nascimento: string): Promise<ConsultaDocumento> {
  const hoje = new Date().toISOString().slice(0, 10);
  if (nascimento > hoje) throw new Error("A data de nascimento não pode ser futura.");
  let regiao = "";
  try {
    const resposta = await fetch(`https://brasilapi.com.br/api/cpf/v1/${digitos}`, {
      headers: { accept: "application/json", "user-agent": "AuxiliaLegis/1.0" },
      signal: AbortSignal.timeout(8000),
    });
    if (resposta.ok) {
      const json = objeto(await resposta.json());
      const ufs = json && Array.isArray(json.ufs) ? json.ufs.filter((item): item is string => typeof item === "string") : [];
      regiao = ufs.join(", ");
    }
  } catch {
    regiao = "";
  }
  return {
    tipo: "cpf",
    cpf: formatarCpf(digitos),
    valido: true,
    regiao,
    aviso: "Nome e situação cadastral só saem no comprovante da Receita Federal, depois da verificação anti-robô.",
  };
}

async function consultarEmpresa(data: string): Promise<ConsultaCnpj> {
    const fontes = [
      `https://open.cnpja.com/office/${data}`,
      `https://publica.cnpj.ws/cnpj/${data}`,
      `https://receitaws.com.br/v1/cnpj/${data}`,
      `https://brasilapi.com.br/api/cnpj/v1/${data}`,
      `https://minhareceita.org/${data}`,
    ];
    let ausente = false;
    for (const fonte of fontes) {
      try {
        const json = await buscarJson(fonte);
        if (json === "ausente") {
          ausente = true;
          continue;
        }
        if (!json) continue;
        const consulta = interpretar(json, data);
        if (consulta?.razaoSocial) return consulta;
      } catch {
        continue;
      }
    }
    if (ausente) throw new Error("CNPJ não encontrado na Receita Federal.");
    throw new Error("Não foi possível consultar o CNPJ agora. Tente de novo.");
}
