import { createServerFn } from "@tanstack/react-start";
import { getSql } from "@/lib/db";
import { authMiddleware } from "@/lib/auth/middleware";
import { exigeLinks, modoValor, normalizarLink, normalizarModalidade, normalizarStatus, pedePrevisao, permiteDoisContratados, RETENCOES, somaPagamentos, tipoSimples, type PagamentoDemanda, type ProcessoAdmin } from "@/lib/admin";
import { todayIso, type Andamento } from "@/lib/prazos";

function nascimentoDe(documento: string, valor: unknown, erro: string): string | null {
  if (documento.replace(/\D/g, "").length !== 11) return null;
  if (valor == null || valor === "") throw new Error(erro);
  if (!dataOk(valor)) throw new Error("Data de nascimento inválida.");
  if (valor > todayIso()) throw new Error("A data de nascimento não pode ser futura.");
  return valor;
}

function dataOk(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function dataOpcional(value: unknown): string | null {
  if (value == null || value === "") return null;
  if (!dataOk(value)) throw new Error("Data inválida");
  return value;
}

function historicoOk(value: unknown): Andamento[] {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 200).flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const nota = item as Partial<Andamento>;
    if (typeof nota.id !== "string" || typeof nota.texto !== "string") return [];
    const texto = nota.texto.trim();
    if (!texto) return [];
    return [
      {
        id: nota.id.slice(0, 80),
        em: typeof nota.em === "string" ? nota.em.slice(0, 40) : new Date().toISOString(),
        texto: texto.slice(0, 2000),
        autorNome: typeof nota.autorNome === "string" ? nota.autorNome.trim().slice(0, 80) : "",
        ...(typeof nota.link === "string" && normalizarLink(nota.link) ? { link: normalizarLink(nota.link)!.slice(0, 500) } : {}),
      },
    ];
  });
}

function linkCampo(value: unknown, nome: string, obrigatorio: boolean): string {
  const texto = typeof value === "string" ? value.trim() : "";
  if (!texto) {
    if (obrigatorio) throw new Error(`Informe o ${nome}.`);
    return "";
  }
  const url = normalizarLink(texto);
  if (!url) throw new Error(`O ${nome} está inválido.`);
  return url.slice(0, 500);
}

function centavosOk(value: unknown): number | null {
  if (value == null || value === "") return null;
  const n = Number(value);
  if (!Number.isInteger(n) || n < 0 || n > 100_000_000_000) throw new Error("Valor inválido");
  return n;
}

function pagamentosOk(value: unknown): PagamentoDemanda[] {
  const lista = Array.isArray(value) ? value : [];
  return lista.slice(0, 200).flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const bruto = item as Partial<PagamentoDemanda>;
    const valor = centavosOk(bruto.valorCentavos);
    if (valor == null) return [];
    const data = typeof bruto.data === "string" && /^\d{4}-\d{2}-\d{2}$/.test(bruto.data) ? bruto.data : "";
    const id = typeof bruto.id === "string" && bruto.id.trim() ? bruto.id.trim().slice(0, 80) : crypto.randomUUID();
    const descricao = typeof bruto.descricao === "string" ? bruto.descricao.trim().slice(0, 160) : "";
    const numero = typeof bruto.numero === "number" && Number.isInteger(bruto.numero) && bruto.numero > 0 && bruto.numero < 10000 ? bruto.numero : undefined;
    const desconto = centavosOk((bruto as { descontoCentavos?: unknown }).descontoCentavos);
    if (bruto.invalido === true && numero) return [{ id, data: "", valorCentavos: 0, descricao: "", numero, invalido: true }];
    if (valor == null) return [];
    const descontoCentavos = desconto != null && desconto > 0 ? Math.min(desconto, valor) : undefined;
    const tipoRetencao = typeof (bruto as { retencaoTipo?: unknown }).retencaoTipo === "string" ? (bruto as { retencaoTipo: string }).retencaoTipo : "";
    const retencaoTipo = RETENCOES.some((item) => item.id === tipoRetencao) ? tipoRetencao : undefined;
    return [{ id, data, valorCentavos: valor, descricao, ...(numero ? { numero } : {}), ...(descontoCentavos ? { descontoCentavos, ...(retencaoTipo ? { retencaoTipo } : {}) } : {}) }];
  });
}

function anoOpcional(value: unknown): number | null {
  if (value == null || value === "") return null;
  const ano = Number(value);
  if (!Number.isInteger(ano) || ano < 2000 || ano > 2100) throw new Error("Ano do processo inválido.");
  return ano;
}

function pecaOpcional(
  numero: unknown,
  ano: unknown,
  nome: string,
): { numero: number | null; ano: number | null } {
  const semNumero = numero == null || numero === "";
  const semAno = ano == null || ano === "";
  if (semNumero && semAno) return { numero: null, ano: null };
  const n = Number(numero);
  const a = Number(ano);
  if (!Number.isInteger(n) || n < 1 || n > 999999) throw new Error(`Número da ${nome} inválido.`);
  if (!Number.isInteger(a) || a < 2000 || a > 2100) throw new Error(`Ano da ${nome} inválido.`);
  return { numero: n, ano: a };
}

function exigirAdmin(input: unknown): ProcessoAdmin {
  if (!input || typeof input !== "object") throw new Error("Dados inválidos");
  const bruto = input as Partial<ProcessoAdmin>;
  const id = typeof bruto.id === "string" ? bruto.id.trim() : "";
  const numero = typeof bruto.numero === "string" ? bruto.numero.trim() : "";
  const objeto = typeof bruto.objeto === "string" ? bruto.objeto.trim() : "";
  const referencia = typeof bruto.referencia === "string" ? bruto.referencia.trim() : "";
  if (!id) throw new Error("Dados inválidos");
  const numeroAno = anoOpcional(bruto.numeroAno);
  const tipo = normalizarModalidade(String(bruto.tipo));
  if (!tipo) throw new Error("Tipo inválido");
  const simples = tipoSimples(tipo);
  if (!numero) throw new Error("Informe o número do processo.");
  const tipoPeca = pecaOpcional(bruto.tipoNumero, bruto.tipoAno, "tipo");
  const status = normalizarStatus(String(bruto.status ?? ""));
  const hoje = todayIso();
  if (!simples && !dataOk(bruto.dataInicio)) throw new Error("Data inválida");
  const previsaoEtapa = dataOpcional(bruto.previsaoEtapa);
  const encerramentoInformado = dataOpcional(bruto.encerramento);
  const alerta = Number(bruto.alertaDias);
  if (!Number.isInteger(alerta) || alerta < 0 || alerta > 365) throw new Error("Antecedência inválida");
  const possuiContrato = status === "execucao";
  const vigenciaInicio = dataOpcional(bruto.vigenciaInicio);
  const vigenciaFim = dataOpcional(bruto.vigenciaFim);
  const contratado = typeof bruto.contratado === "string" ? bruto.contratado.trim() : "";
  const documento = typeof bruto.documento === "string" ? bruto.documento.trim() : "";
  const valorTotalCentavos = centavosOk(bruto.valorTotalCentavos);
  const valorMensalCentavos = centavosOk(bruto.valorMensalCentavos);
  const valorEstimadoCentavos = centavosOk(bruto.valorEstimadoCentavos);
  const ci = pecaOpcional(bruto.ciNumero, bruto.ciAno, "comunicação interna");
  const parecerNa = bruto.parecerNa === true;
  const parecer = parecerNa ? { numero: null, ano: null } : pecaOpcional(bruto.parecerNumero, bruto.parecerAno, "parecer");
  const ciOrigem = typeof bruto.ciOrigem === "string" ? bruto.ciOrigem.trim() : "";
  const linkAberturaNa = bruto.linkAberturaNa === true;
  const linkAbertura = linkAberturaNa ? "" : linkCampo(bruto.linkAbertura, "link de publicação", exigeLinks(tipo) && !linkAberturaNa);
  const linkHomologacaoNa = bruto.linkHomologacaoNa === true;
  const linkHomologacao = linkHomologacaoNa ? "" : linkCampo(bruto.linkHomologacao, "link de homologação", false);
  const linkPncpNa = bruto.linkPncpNa === true;
  const linkPncp = linkPncpNa ? "" : linkCampo(bruto.linkPncp, "link do PNCP", false);
  const linkRetificacao = bruto.linkRetificacao ? linkCampo(bruto.linkRetificacao, "link da retificação", true) : "";
  const linkCancelamentoNa = bruto.linkCancelamentoNa === true;
  const linkCancelamento = linkCancelamentoNa ? "" : linkCampo(bruto.linkCancelamento, "link de cancelamento", false);
  if (tipo !== "Outros" && tipoPeca.numero == null) throw new Error("Informe o número do tipo.");
  if (ci.numero == null) throw new Error("Informe o número da comunicação interna.");
  if (!ciOrigem) throw new Error("Informe de onde veio a comunicação interna.");
  if (simples) {
    if (!referencia) throw new Error("Informe a referência.");
    if (!objeto) throw new Error("Informe o objeto.");
  } else if (status !== "cancelado") {
    if (!objeto) throw new Error("Informe o objeto.");
    if (parecer.numero == null && !parecerNa) throw new Error("Informe o número do parecer.");
  }
  if (!simples && pedePrevisao(status) && !previsaoEtapa) throw new Error("Informe a data do prazo.");
  if (!simples && status === "encerrado" && !encerramentoInformado) throw new Error("Informe a data de encerramento.");
  const modo = modoValor(tipo, status);
  const pagamentoDemanda = bruto.pagamentoDemanda === true && !simples && status !== "cancelado";
  const pagamentos = simples ? [] : pagamentosOk(bruto.pagamentos);
  const retencaoImpostos = bruto.retencaoImpostos === true && !simples && status !== "cancelado";
  const retencaoCentavos = retencaoImpostos ? centavosOk(bruto.retencaoCentavos) : null;
  const tipoInformado = typeof bruto.retencaoTipo === "string" ? bruto.retencaoTipo : "";
  const retencaoTipo = retencaoImpostos && RETENCOES.some((item) => item.id === tipoInformado) ? tipoInformado : "";
  if (retencaoImpostos && !retencaoTipo) throw new Error("Informe o tipo da retenção.");
  if (retencaoImpostos && (retencaoCentavos == null || retencaoCentavos <= 0)) throw new Error("Informe o valor da retenção de impostos.");
  if (retencaoImpostos && retencaoCentavos != null && !pagamentoDemanda && valorMensalCentavos != null && retencaoCentavos > valorMensalCentavos) {
    throw new Error("A retenção não pode ser maior que o valor mensal.");
  }
  if (modo === "contrato") {
    if (!contratado) throw new Error("Informe os dados do contratado.");
    if (!vigenciaInicio || !vigenciaFim) throw new Error("Informe a vigência do contrato.");
    if (vigenciaFim < vigenciaInicio) throw new Error("A vigência termina antes de começar.");
    if (valorTotalCentavos == null) throw new Error("Informe o valor anual do contrato.");
    if (!pagamentoDemanda && valorMensalCentavos == null) throw new Error("Informe o valor mensal do contrato.");
  } else if (modo === "total") {
    if (!contratado) throw new Error("Informe o contratado.");
    const digitos = documento.replace(/\D/g, "");
    if (digitos.length !== 11 && digitos.length !== 14) throw new Error("Informe o CPF ou o CNPJ.");
    if (valorTotalCentavos == null) throw new Error("Informe o valor da contratação ou aquisição.");
  }
  const guardaContratado = !simples && (possuiContrato || modo === "total");
  const nome2 = typeof bruto.contratado2 === "string" ? bruto.contratado2.trim() : "";
  const doc2 = typeof bruto.documento2 === "string" ? bruto.documento2.trim() : "";
  let contratado2 = "";
  let documento2 = "";
  if (guardaContratado && permiteDoisContratados(tipo) && (nome2 || doc2)) {
    if (!nome2) throw new Error("Informe o segundo contratado ou fornecedor.");
    const digitos2 = doc2.replace(/\D/g, "");
    if (digitos2 && digitos2.length !== 11 && digitos2.length !== 14) throw new Error("O CPF ou CNPJ do segundo contratado ou fornecedor está inválido.");
    if (modo === "total" && digitos2.length !== 11 && digitos2.length !== 14) throw new Error("Informe o CPF ou o CNPJ do segundo contratado ou fornecedor.");
    contratado2 = nome2.slice(0, 160);
    documento2 = doc2.slice(0, 24);
  }
  const encerramento =
    simples
      ? hoje
      : status === "encerrado" && encerramentoInformado
      ? encerramentoInformado
      : status === "execucao" && vigenciaFim
        ? vigenciaFim
        : previsaoEtapa || bruto.dataInicio || hoje;
  const equipeId = typeof bruto.equipeId === "string" && bruto.equipeId.trim() ? bruto.equipeId.trim().slice(0, 80) : null;
  return {
    id: id.slice(0, 80),
    numero: numero.slice(0, 80),
    numeroAno,
    referencia: referencia.slice(0, 120),
    objeto: objeto.slice(0, 400),
    tipo,
    tipoNumero: tipo === "Outros" ? null : tipoPeca.numero,
    tipoAno: tipo === "Outros" ? null : tipoPeca.ano,
    dataInicio: simples ? hoje : bruto.dataInicio!,
    previsaoEtapa: !simples && pedePrevisao(status) ? previsaoEtapa : null,
    encerramento,
    alertaDias: alerta,
    possuiContrato: !simples && possuiContrato,
    vigenciaInicio: !simples && possuiContrato ? vigenciaInicio : null,
    vigenciaFim: !simples && possuiContrato ? vigenciaFim : null,
    contratado: guardaContratado ? contratado.slice(0, 160) : "",
    documento: guardaContratado ? documento.slice(0, 24) : "",
    nascimento: guardaContratado ? nascimentoDe(documento, bruto.nascimento, "Informe a data de nascimento.") : null,
    contratado2,
    documento2,
    nascimento2: documento2 ? nascimentoDe(documento2, bruto.nascimento2, "Informe a data de nascimento do segundo contratado.") : null,
    valorTotalCentavos: modo === "contrato" || modo === "total" ? valorTotalCentavos : null,
    valorMensalCentavos: pagamentoDemanda ? somaPagamentos(pagamentos) : modo === "contrato" ? valorMensalCentavos : null,
    valorEstimadoCentavos: pagamentoDemanda || modo !== "estimado" ? null : valorEstimadoCentavos,
    pagamentoDemanda,
    retencaoImpostos,
    retencaoTipo,
    retencaoCentavos,
    pagamentos,
    ciNumero: ci.numero,
    ciAno: ci.ano,
    ciOrigem: ciOrigem.slice(0, 160),
    linkAbertura,
    linkAberturaNa,
    linkHomologacao,
    linkHomologacaoNa,
    linkPncp,
    linkPncpNa,
    linkRetificacao,
    linkCancelamento,
    linkCancelamentoNa,
    parecerNumero: simples || status === "cancelado" || parecerNa ? null : parecer.numero,
    parecerAno: simples || status === "cancelado" || parecerNa ? null : parecer.ano,
    parecerNa: !simples && status !== "cancelado" && parecerNa,
    status,
    historico: historicoOk(bruto.historico),
    equipeId,
    autorId: typeof bruto.autorId === "string" && bruto.autorId.trim() ? bruto.autorId.trim().slice(0, 80) : null,
    autorNome: typeof bruto.autorNome === "string" ? bruto.autorNome.trim().slice(0, 80) : "",
  };
}

type Linha = {
  id: string;
  numero: string;
  numero_ano: number | null;
  referencia: string;
  objeto: string;
  tipo: string;
  tipo_numero: number | null;
  tipo_ano: number | null;
  data_inicio: string;
  previsao_etapa: string | null;
  encerramento: string;
  alerta_dias: number;
  possui_contrato: boolean | number | string;
  vigencia_inicio: string | null;
  vigencia_fim: string | null;
  contratado: string;
  documento: string;
  nascimento: string | null;
  contratado_2: string | null;
  documento_2: string | null;
  nascimento_2: string | null;
  valor_total_centavos: number | null;
  valor_mensal_centavos: number | null;
  valor_estimado_centavos: number | null;
  pagamento_demanda: boolean | number | string | null;
  retencao_impostos: boolean | number | string | null;
  retencao_tipo: string | null;
  retencao_centavos: number | null;
  pagamentos: string | PagamentoDemanda[] | null;
  ci_numero: number | null;
  ci_ano: number | null;
  ci_origem: string | null;
  link_abertura: string | null;
  link_abertura_na: boolean | number | string | null;
  link_homologacao: string | null;
  link_homologacao_na: boolean | number | string | null;
  link_pncp: string | null;
  link_pncp_na: boolean | number | string | null;
  link_retificacao: string | null;
  link_cancelamento: string | null;
  link_cancelamento_na: boolean | number | string | null;
  parecer_numero: number | null;
  parecer_ano: number | null;
  parecer_na: boolean | number | string | null;
  status: string;
  historico: string;
  team_id: string | null;
  autor_id: string | null;
  autor_nome: string;
};

function dia(value: string | null | undefined): string | null {
  if (!value) return null;
  return String(value).slice(0, 10);
}

function inteiroOuNulo(value: number | null | undefined): number | null {
  if (value == null || value === ("" as unknown)) return null;
  const n = Number(value);
  return Number.isInteger(n) ? n : null;
}

function bool(value: boolean | number | string): boolean {
  return value === true || value === 1 || value === "t" || value === "true";
}

function linhaParaAdmin(linha: Linha): ProcessoAdmin {
  let historico: Andamento[] = [];
  try {
    historico = historicoOk(JSON.parse(linha.historico));
  } catch {
    historico = [];
  }
  const tipo = normalizarModalidade(linha.tipo) ?? "Pregão";
  const status = normalizarStatus(linha.status);
  const possui = bool(linha.possui_contrato);
  const encerramento = String(linha.encerramento).slice(0, 10);
  const previsao = dia(linha.previsao_etapa) ?? (pedePrevisao(status) ? encerramento : null);
  const pagamentoDemanda = bool(linha.pagamento_demanda ?? false);
  let pagamentos: PagamentoDemanda[] = [];
  try {
    pagamentos = pagamentosOk(typeof linha.pagamentos === "string" ? JSON.parse(linha.pagamentos || "[]") : linha.pagamentos);
  } catch {
    pagamentos = [];
  }
  return {
    id: linha.id,
    numero: linha.numero,
    numeroAno: inteiroOuNulo(linha.numero_ano),
    referencia: linha.referencia ?? "",
    objeto: linha.objeto,
    tipo,
    tipoNumero: inteiroOuNulo(linha.tipo_numero),
    tipoAno: inteiroOuNulo(linha.tipo_ano),
    dataInicio: String(linha.data_inicio).slice(0, 10),
    previsaoEtapa: previsao,
    encerramento,
    alertaDias: Number(linha.alerta_dias),
    possuiContrato: status === "execucao" && possui,
    vigenciaInicio: possui ? dia(linha.vigencia_inicio) : null,
    vigenciaFim: possui ? dia(linha.vigencia_fim) : null,
    contratado: linha.contratado ?? "",
    documento: linha.documento ?? "",
    nascimento: dia(linha.nascimento),
    contratado2: linha.contratado_2 ?? "",
    documento2: linha.documento_2 ?? "",
    nascimento2: dia(linha.nascimento_2),
    valorTotalCentavos: linha.valor_total_centavos != null ? Number(linha.valor_total_centavos) : null,
    valorMensalCentavos: pagamentoDemanda && pagamentos.length > 0 ? somaPagamentos(pagamentos) : linha.valor_mensal_centavos != null ? Number(linha.valor_mensal_centavos) : null,
    valorEstimadoCentavos: linha.valor_estimado_centavos != null ? Number(linha.valor_estimado_centavos) : null,
    pagamentoDemanda,
    retencaoImpostos: bool(linha.retencao_impostos ?? false),
    retencaoTipo: typeof linha.retencao_tipo === "string" ? linha.retencao_tipo : "",
    retencaoCentavos: linha.retencao_centavos != null ? Number(linha.retencao_centavos) : null,
    pagamentos,
    ciNumero: inteiroOuNulo(linha.ci_numero),
    ciAno: inteiroOuNulo(linha.ci_ano),
    ciOrigem: linha.ci_origem ?? "",
    linkAbertura: linha.link_abertura ?? "",
    linkAberturaNa: bool(linha.link_abertura_na ?? false),
    linkHomologacao: linha.link_homologacao ?? "",
    linkHomologacaoNa: bool(linha.link_homologacao_na ?? false),
    linkPncp: linha.link_pncp ?? "",
    linkPncpNa: bool(linha.link_pncp_na ?? false),
    linkRetificacao: linha.link_retificacao ?? "",
    linkCancelamento: linha.link_cancelamento ?? "",
    linkCancelamentoNa: bool(linha.link_cancelamento_na ?? false),
    parecerNumero: inteiroOuNulo(linha.parecer_numero),
    parecerAno: inteiroOuNulo(linha.parecer_ano),
    parecerNa: bool(linha.parecer_na ?? false),
    status,
    historico,
    equipeId: linha.team_id,
    autorId: linha.autor_id,
    autorNome: linha.autor_nome ?? "",
  };
}

let schemaPronto: { versao: number; pendente: Promise<void> } | null = null;
const SCHEMA_ADMIN = 17;

/** Garante as colunas novas mesmo se a migração ainda não tiver rodado nesta instância. */
async function garantirColunas(sql: Awaited<ReturnType<typeof getSql>>) {
  if (!schemaPronto || schemaPronto.versao !== SCHEMA_ADMIN) {
    const pendente = (async () => {
      const comandos = [
        "alter table processos_admin add column if not exists ci_numero integer",
        "alter table processos_admin add column if not exists ci_ano integer",
        "alter table processos_admin add column if not exists ci_origem text not null default ''",
        "alter table processos_admin add column if not exists parecer_numero integer",
        "alter table processos_admin add column if not exists parecer_ano integer",
        "alter table processos_admin add column if not exists parecer_na boolean not null default false",
        "alter table processos_admin add column if not exists numero_ano integer",
        "alter table processos_admin add column if not exists tipo_numero integer",
        "alter table processos_admin add column if not exists tipo_ano integer",
        "alter table processos_admin add column if not exists previsao_etapa date",
        "alter table processos_admin add column if not exists valor_estimado_centavos integer",
        "alter table processos_admin add column if not exists link_abertura text not null default ''",
        "alter table processos_admin add column if not exists link_abertura_na boolean not null default false",
        "alter table processos_admin add column if not exists link_homologacao text not null default ''",
        "alter table processos_admin add column if not exists link_homologacao_na boolean not null default false",
        "alter table processos_admin add column if not exists link_pncp text not null default ''",
        "alter table processos_admin add column if not exists link_pncp_na boolean not null default false",
        "alter table processos_admin add column if not exists link_retificacao text not null default ''",
        "alter table processos_admin add column if not exists link_cancelamento text not null default ''",
        "alter table processos_admin add column if not exists link_cancelamento_na boolean not null default false",
        "alter table processos_admin add column if not exists contratado text not null default ''",
        "alter table processos_admin add column if not exists documento text not null default ''",
        "alter table processos_admin add column if not exists nascimento date",
        "alter table processos_admin add column if not exists contratado_2 text not null default ''",
        "alter table processos_admin add column if not exists documento_2 text not null default ''",
        "alter table processos_admin add column if not exists nascimento_2 date",
        "alter table processos_admin add column if not exists pagamento_demanda boolean not null default false",
        "alter table processos_admin add column if not exists retencao_impostos boolean not null default false",
        "alter table processos_admin add column if not exists retencao_tipo text not null default ''",
        "alter table processos_admin add column if not exists retencao_centavos integer",
        "alter table processos_admin add column if not exists pagamentos text not null default '[]'",
        "alter table processos_admin add column if not exists em_manutencao boolean not null default false",
        "alter table processos_admin add column if not exists status_em date",
        "create table if not exists ci_inutilizada (ano integer not null, numero integer not null, primary key (ano, numero))",
        "alter table ci_inutilizada add column if not exists destino text not null default ''",
        "alter table ci_inutilizada add column if not exists desativada boolean not null default false",
      ];
      for (const comando of comandos) await sql.query(comando);
    })().catch((err) => {
      schemaPronto = null;
      throw err;
    });
    schemaPronto = { versao: SCHEMA_ADMIN, pendente };
  }
  await schemaPronto.pendente;
}

const SELECT_ADMIN = `
  p.id, p.numero, p.numero_ano, p.referencia, p.objeto, p.tipo, p.tipo_numero, p.tipo_ano, p.data_inicio, p.previsao_etapa, p.encerramento,
  p.alerta_dias, p.possui_contrato, p.vigencia_inicio, p.vigencia_fim,
  p.contratado, p.documento, p.nascimento, p.contratado_2, p.documento_2, p.nascimento_2, p.valor_total_centavos, p.valor_mensal_centavos, p.valor_estimado_centavos, p.pagamento_demanda, p.retencao_impostos, p.retencao_tipo, p.retencao_centavos, p.pagamentos,
  p.ci_numero, p.ci_ano, p.ci_origem, p.link_abertura, p.link_abertura_na, p.link_homologacao, p.link_homologacao_na, p.link_pncp, p.link_pncp_na, p.link_retificacao, p.link_cancelamento, p.link_cancelamento_na, p.parecer_numero, p.parecer_ano, p.parecer_na,
  p.status, p.historico, p.team_id,
  coalesce(nullif(p.autor_id, ''), p.user_id) as autor_id,
  coalesce(nullif(p.autor_nome, ''), u.name, '') as autor_nome
`;

function somarDias(iso: string, dias: number) {
  const [ano, mes, dia] = iso.split("-").map(Number);
  return todayIso(new Date(ano || 1970, (mes || 1) - 1, (dia || 1) + dias));
}

async function aplicarTramites(sql: Awaited<ReturnType<typeof getSql>>) {
  const regras = await sql<{ codigo: string; dias: number; destino: string; destino_nome: string }>`
    select s.codigo, s.tramite_dias as dias, s.tramite_codigo as destino, d.nome as destino_nome
    from status_catalogo s
    join status_catalogo d on d.area = s.area and d.codigo = s.tramite_codigo
    where s.area = 'administrativo' and s.tramite_dias is not null and s.tramite_dias > 0
  `;
  if (!regras.length) return;
  const porCodigo = new Map(regras.map((regra) => [regra.codigo, { ...regra, dias: Number(regra.dias) }]));
  const processos = await sql<{ id: string; status: string; status_em: string | null; data_inicio: string; historico: string }>`
    select id, status, status_em, data_inicio, historico from processos_admin
  `;
  const hoje = todayIso();
  for (const item of processos) {
    if (!item.status_em) {
      await sql`update processos_admin set status_em = current_date where id = ${item.id} and status_em is null`;
      continue;
    }
    let status = item.status;
    let inicio = String(item.status_em).slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(inicio)) continue;
    let historico = item.historico || "[]";
    let mudou = false;
    for (let volta = 0; volta < 16; volta += 1) {
      const regra = porCodigo.get(status);
      if (!regra) break;
      const devido = somarDias(inicio, regra.dias);
      if (devido > hoje) break;
      let lista: { id: string; em: string; texto: string; autorNome: string }[] = [];
      try {
        const bruto = JSON.parse(historico);
        if (Array.isArray(bruto)) lista = bruto;
      } catch {
        lista = [];
      }
      lista.push({
        id: crypto.randomUUID(),
        em: new Date().toISOString(),
        texto: `Trâmite automático para ${regra.destino_nome}.`,
        autorNome: "Sistema",
      });
      status = regra.destino;
      inicio = devido;
      historico = JSON.stringify(lista);
      mudou = true;
    }
    if (mudou) {
      await sql`
        update processos_admin
        set status = ${status}, status_em = ${inicio}::date, historico = ${historico}
        where id = ${item.id} and status = ${item.status}
      `;
    }
  }
}

export async function adminDaConta(userId: string, equipeId: string | null) {
  const sql = await getSql();
  await garantirColunas(sql);
  await aplicarTramites(sql);
  if (!equipeId) {
    const linhas = await sql.query<Linha>(
      `select ${SELECT_ADMIN}
       from processos_admin p
       left join "user" u on u.id = p.user_id
       where p.user_id = $1 and p.team_id is null
       order by p.encerramento asc`,
      [userId],
    );
    return linhas.map(linhaParaAdmin);
  }
  const membro = await sql<{ ok: number }>`
    select 1 as ok from equipe_membros where equipe_id = ${equipeId} and user_id = ${userId}
  `;
  if (!membro.length) throw new Error("Você não faz parte desta equipe.");
  const linhas = await sql.query<Linha>(
    `select ${SELECT_ADMIN}
     from processos_admin p
     left join "user" u on u.id = p.user_id
     where p.team_id = $1
     order by p.encerramento asc`,
    [equipeId],
  );
  return linhas.map(linhaParaAdmin);
}

export const listarAdmin = createServerFn({ method: "GET" })
  .validator((equipeId: unknown) => {
    if (equipeId == null || equipeId === "") return null;
    if (typeof equipeId !== "string" || !equipeId.trim()) throw new Error("Dados inválidos");
    return equipeId.trim().slice(0, 80);
  })
  .middleware([authMiddleware])
  .handler(async ({ context, data: equipeId }) => adminDaConta(context.userId, equipeId));

export const salvarAdmin = createServerFn({ method: "POST" })
  .validator(exigirAdmin)
  .middleware([authMiddleware])
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    await garantirColunas(sql);
    const { conferirAba, anotarUso, exigirEscrita } = await import("./gestao.server");
    await exigirEscrita(context.userId);
    await conferirAba("administrativo", data.tipo);
    const eu = await sql<{ name: string | null }>`select name from "user" where id = ${context.userId}`;
    const autorNome = (eu[0]?.name || "Sem nome").trim().slice(0, 80) || "Sem nome";
    if (data.equipeId) {
      const membro = await sql<{ ok: number }>`
        select 1 as ok from equipe_membros where equipe_id = ${data.equipeId} and user_id = ${context.userId}
      `;
      if (!membro.length) throw new Error("Você não faz parte desta equipe.");
    }
    const existente = await sql<{ historico: string; user_id: string; team_id: string | null }>`
      select historico, user_id, team_id from processos_admin where id = ${data.id}
    `;
    let anterior: Andamento[] = [];
    if (existente.length) {
      try {
        anterior = historicoOk(JSON.parse(existente[0].historico || "[]"));
      } catch {
        anterior = [];
      }
    }
    const conhecidos = new Map(anterior.map((item) => [item.id, item.autorNome]));
    let historico = data.historico.map((item) => ({
      ...item,
      autorNome: conhecidos.get(item.id) || autorNome,
    }));
    if (!existente.length && historico.length === 0) {
      historico = [
        { id: crypto.randomUUID(), em: new Date().toISOString(), texto: "Lançou o processo administrativo.", autorNome },
      ];
    }
    if (existente.length) {
      const row = existente[0];
      const permitido = row.team_id
        ? row.team_id === data.equipeId
        : !data.equipeId && row.user_id === context.userId;
      if (!permitido) throw new Error("Não foi possível salvar");
    }
    const historicoJson = JSON.stringify(historico);
    const salvos = existente.length
      ? await sql<{ id: string }>`
          update processos_admin set
            numero = ${data.numero},
            numero_ano = ${data.numeroAno},
            referencia = ${data.referencia},
            objeto = ${data.objeto},
            tipo = ${data.tipo},
            tipo_numero = ${data.tipoNumero},
            tipo_ano = ${data.tipoAno},
            data_inicio = ${data.dataInicio},
            previsao_etapa = ${data.previsaoEtapa},
            encerramento = ${data.encerramento},
            alerta_dias = ${data.alertaDias},
            possui_contrato = ${data.possuiContrato},
            vigencia_inicio = ${data.vigenciaInicio},
            vigencia_fim = ${data.vigenciaFim},
            contratado = ${data.contratado},
            documento = ${data.documento},
            nascimento = ${data.nascimento},
            contratado_2 = ${data.contratado2},
            documento_2 = ${data.documento2},
            nascimento_2 = ${data.nascimento2},
            valor_total_centavos = ${data.valorTotalCentavos},
            valor_mensal_centavos = ${data.valorMensalCentavos},
            valor_estimado_centavos = ${data.valorEstimadoCentavos},
            pagamento_demanda = ${data.pagamentoDemanda},
            retencao_impostos = ${data.retencaoImpostos},
            retencao_tipo = ${data.retencaoTipo},
            retencao_centavos = ${data.retencaoCentavos},
            pagamentos = ${JSON.stringify(data.pagamentos)},
            ci_numero = ${data.ciNumero},
            ci_ano = ${data.ciAno},
            ci_origem = ${data.ciOrigem},
            link_abertura = ${data.linkAbertura},
            link_abertura_na = ${data.linkAberturaNa},
            link_homologacao = ${data.linkHomologacao},
            link_homologacao_na = ${data.linkHomologacaoNa},
            link_pncp = ${data.linkPncp},
            link_pncp_na = ${data.linkPncpNa},
            link_retificacao = ${data.linkRetificacao},
            link_cancelamento = ${data.linkCancelamento},
            link_cancelamento_na = ${data.linkCancelamentoNa},
            parecer_numero = ${data.parecerNumero},
            parecer_ano = ${data.parecerAno},
            parecer_na = ${data.parecerNa},
            status = ${data.status},
            status_em = case when status is distinct from ${data.status} then current_date else coalesce(status_em, data_inicio) end,
            historico = ${historicoJson}
          where id = ${data.id}
            and (
              (${data.equipeId}::text is not null and team_id = ${data.equipeId})
              or (${data.equipeId}::text is null and team_id is null and user_id = ${context.userId})
            )
          returning id
        `
      : await sql<{ id: string }>`
          insert into processos_admin (
            id, user_id, team_id, numero, numero_ano, referencia, objeto, tipo, tipo_numero, tipo_ano, data_inicio, previsao_etapa, encerramento,
            alerta_dias, possui_contrato, vigencia_inicio, vigencia_fim, contratado, documento, nascimento, contratado_2, documento_2, nascimento_2,
            valor_total_centavos, valor_mensal_centavos, valor_estimado_centavos, pagamento_demanda, retencao_impostos, retencao_tipo, retencao_centavos, pagamentos, ci_numero, ci_ano, ci_origem,
            link_abertura, link_abertura_na, link_homologacao, link_homologacao_na, link_pncp, link_pncp_na, link_retificacao, link_cancelamento, link_cancelamento_na,
            parecer_numero, parecer_ano, parecer_na, status, status_em, historico, autor_id, autor_nome, em_manutencao
          ) values (
            ${data.id}, ${context.userId}, ${data.equipeId}, ${data.numero}, ${data.numeroAno}, ${data.referencia},
            ${data.objeto}, ${data.tipo}, ${data.tipoNumero}, ${data.tipoAno}, ${data.dataInicio}, ${data.previsaoEtapa}, ${data.encerramento}, ${data.alertaDias},
            ${data.possuiContrato}, ${data.vigenciaInicio}, ${data.vigenciaFim}, ${data.contratado},
            ${data.documento}, ${data.nascimento}, ${data.contratado2}, ${data.documento2}, ${data.nascimento2}, ${data.valorTotalCentavos}, ${data.valorMensalCentavos}, ${data.valorEstimadoCentavos}, ${data.pagamentoDemanda}, ${data.retencaoImpostos}, ${data.retencaoTipo}, ${data.retencaoCentavos}, ${JSON.stringify(data.pagamentos)},
            ${data.ciNumero}, ${data.ciAno}, ${data.ciOrigem}, ${data.linkAbertura}, ${data.linkAberturaNa}, ${data.linkHomologacao}, ${data.linkHomologacaoNa}, ${data.linkPncp}, ${data.linkPncpNa}, ${data.linkRetificacao}, ${data.linkCancelamento}, ${data.linkCancelamentoNa}, ${data.parecerNumero}, ${data.parecerAno}, ${data.parecerNa},
            ${data.status}, current_date,
            ${historicoJson}, ${context.userId}, ${autorNome}, false
          )
          returning id
        `;
    if (!salvos.length) throw new Error("Não foi possível salvar");
    if (!existente.length) {
      const { backupAoLancar } = await import("./gestao.server");
      await backupAoLancar();
    }
    void anotarUso(context.userId, existente.length ? "Alterou processo administrativo" : "Lançou processo administrativo", `${data.numero} · ${data.tipo}`).catch(() => undefined);
    return { id: salvos[0].id };
  });

export const listarCiAnotacoes = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async () => {
    const sql = await getSql();
    await garantirColunas(sql);
    const linhas = await sql<{ ano: number; numero: number; destino: string | null; desativada: boolean | number | string | null }>`
      select ano, numero, destino, desativada from ci_inutilizada order by ano desc, numero asc
    `;
    return linhas.map((linha) => ({
      ano: Number(linha.ano),
      numero: Number(linha.numero),
      destino: linha.destino ?? "",
      desativada: linha.desativada === true || linha.desativada === 1 || linha.desativada === "t" || linha.desativada === "true",
    }));
  });

export const salvarCiAnotacao = createServerFn({ method: "POST" })
  .validator((input: unknown) => {
    if (!input || typeof input !== "object") throw new Error("Dados inválidos");
    const bruto = input as { ano?: unknown; numero?: unknown; destino?: unknown; desativada?: unknown };
    const ano = Number(bruto.ano);
    const numero = Number(bruto.numero);
    if (!Number.isInteger(ano) || ano < 2000 || ano > 2100) throw new Error("Ano inválido.");
    if (!Number.isInteger(numero) || numero < 1 || numero > 999999) throw new Error("Número inválido.");
    const destino = typeof bruto.destino === "string" ? bruto.destino.trim().slice(0, 160) : "";
    return { ano, numero, destino, desativada: bruto.desativada === true };
  })
  .middleware([authMiddleware])
  .handler(async ({ data }) => {
    const sql = await getSql();
    await garantirColunas(sql);
    if (!data.destino && !data.desativada) {
      await sql`delete from ci_inutilizada where ano = ${data.ano} and numero = ${data.numero}`;
      return { ok: true as const };
    }
    await sql`
      insert into ci_inutilizada (ano, numero, destino, desativada)
      values (${data.ano}, ${data.numero}, ${data.destino}, ${data.desativada})
      on conflict (ano, numero) do update set destino = ${data.destino}, desativada = ${data.desativada}
    `;
    return { ok: true as const };
  });

export const apagarAdmin = createServerFn({ method: "POST" })
  .validator((id: unknown) => {
    if (typeof id !== "string" || !id.trim()) throw new Error("Dados inválidos");
    return id.trim().slice(0, 80);
  })
  .middleware([authMiddleware])
  .handler(async ({ context, data: id }) => {
    const sql = await getSql();
    const { anotarUso, exigirEscrita } = await import("./gestao.server");
    await exigirEscrita(context.userId);
    await sql`
      delete from processos_admin
      where id = ${id}
        and (
          (team_id is null and user_id = ${context.userId})
          or team_id in (select equipe_id from equipe_membros where user_id = ${context.userId})
        )
    `;
    void anotarUso(context.userId, "Excluiu processo administrativo", id).catch(() => undefined);
    return { id };
  });

export const moverAdmin = createServerFn({ method: "POST" })
  .validator((input: unknown) => {
    if (!input || typeof input !== "object") throw new Error("Dados inválidos");
    const bruto = input as { id?: unknown; equipeId?: unknown };
    const id = typeof bruto.id === "string" ? bruto.id.trim() : "";
    if (!id) throw new Error("Dados inválidos");
    const equipeId =
      bruto.equipeId == null || bruto.equipeId === ""
        ? null
        : typeof bruto.equipeId === "string" && bruto.equipeId.trim()
          ? bruto.equipeId.trim().slice(0, 80)
          : null;
    if (bruto.equipeId && !equipeId) throw new Error("Dados inválidos");
    return { id: id.slice(0, 80), equipeId };
  })
  .middleware([authMiddleware])
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    await garantirColunas(sql);
    const { exigirEscrita } = await import("./gestao.server");
    await exigirEscrita(context.userId);
    if (data.equipeId) {
      const membro = await sql<{ ok: number }>`
        select 1 as ok from equipe_membros where equipe_id = ${data.equipeId} and user_id = ${context.userId}
      `;
      if (!membro.length) throw new Error("Você não faz parte desta equipe.");
    }
    const existente = await sql<{ historico: string; user_id: string; team_id: string | null }>`
      select historico, user_id, team_id from processos_admin where id = ${data.id}
    `;
    if (!existente.length) throw new Error("Não foi possível mover");
    const row = existente[0];
    if (row.team_id) {
      const membro = await sql<{ ok: number }>`
        select 1 as ok from equipe_membros where equipe_id = ${row.team_id} and user_id = ${context.userId}
      `;
      if (!membro.length) throw new Error("Não foi possível mover");
    } else if (row.user_id !== context.userId) {
      throw new Error("Não foi possível mover");
    }
    if ((row.team_id ?? null) === data.equipeId) return { id: data.id };
    const eu = await sql<{ name: string | null }>`select name from "user" where id = ${context.userId}`;
    const autorNome = (eu[0]?.name || "Sem nome").trim().slice(0, 80) || "Sem nome";
    let historico: Andamento[] = [];
    try {
      historico = historicoOk(JSON.parse(row.historico || "[]"));
    } catch {
      historico = [];
    }
    let texto = "Moveu o processo para os seus.";
    if (data.equipeId) {
      const nomes = await sql<{ nome: string }>`select nome from equipes where id = ${data.equipeId}`;
      texto = `Moveu o processo para a equipe ${nomes[0]?.nome?.trim() || "equipe"}.`;
    }
    historico.push({ id: crypto.randomUUID(), em: new Date().toISOString(), texto, autorNome });
    const dono = data.equipeId ? row.user_id : context.userId;
    const salvos = await sql<{ id: string }>`
      update processos_admin
      set team_id = ${data.equipeId}, user_id = ${dono}, historico = ${JSON.stringify(historico)}
      where id = ${data.id}
      returning id
    `;
    if (!salvos.length) throw new Error("Não foi possível mover");
    return { id: salvos[0].id };
  });

