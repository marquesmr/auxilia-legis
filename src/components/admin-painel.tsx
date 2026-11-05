import { useCallback, useContext, useEffect, useMemo, useRef, useState, type DragEvent, type ReactNode } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { BadgeCheck, Ban, BarChart3, FilePen, FileText, Link2, Megaphone, MoreVertical, Pencil, Plus, Search, Trash2, TriangleAlert, X } from "lucide-react";
import {
  MODALIDADES,
  avisoAdminKey,
  avisosAdminEnviados,
  centavosParaCampo,
  cruzaPeriodo,
  dataAlvo,
  exigeLinks,
  linksEmFalta,
  permitePublicacaoNa,
  permiteDoisContratados,
  marcoAdmin,
  anosDePeca,
  formatarPeca,
  daGerenciaAdministrativa,
  sequenciaControle,
  formatarReais,
  intervaloPeriodo,
  marcarAvisosAdmin,
  mascaraDocumento,
  mascaraReais,
  normalizarLink,
  tipoSimples,
  numeroPeca,
  prazoAdminLabel,
  pedePrevisao,
  precisaAvisoAdmin,
  reaisParaCentavos,
  rotuloNumero,
  rotuloTipo,
  statusAdminLabel,
  urgenciaAdmin,
  type Modalidade,
  type PeriodoRelatorio,
  type ProcessoAdmin,
  type StatusAdmin,
  type UrgenciaAdmin,
  type LinhaControle,
} from "@/lib/admin";
import { apagarAdmin, listarAdmin, listarCiAnotacoes, moverAdmin, salvarAdmin, salvarCiAnotacao } from "@/lib/admin.functions";
import { consultarCnpj, type ConsultaCnpj } from "@/lib/cnpj.functions";
import { BotaoRelatorio } from "@/components/botao-relatorio";
import { CampoMes } from "@/components/campo-mes";
import { SoltarProcessoContext } from "@/components/soltar-processo";
import { GraficoAdmin } from "@/components/admin-grafico";
import { Timbrado, TimbradoRodape } from "@/components/timbrado";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { addDaysIso, formatDate, todayIso, type Andamento } from "@/lib/prazos";
import { encerraStatus, listaCodigos } from "@/lib/status-catalogo";

type FiltroAdmin = string;
type OrdemAdmin = "numero" | "tipo" | "encerramento";
type GuiaAdmin = "lista" | "estatisticas" | "relatorio" | "comunicacoes" | "setores" | "pareceres" | "links" | "cnpj";
type StatusRelatorio = "todos" | StatusAdmin;
type ModoRelatorio = "processos" | "pecas";

type FormAdmin = {
  numero: string;
  numeroAno: number;
  referencia: string;
  objeto: string;
  tipo: Modalidade;
  tipoNumero: string;
  tipoAno: number;
  dataInicio: string;
  previsao: string;
  encerramento: string;
  alertaDias: number;
  possuiContrato: boolean;
  vigenciaInicio: string;
  vigenciaFim: string;
  contratado: string;
  documento: string;
  contratado2: string;
  documento2: string;
  valorTotal: string;
  valorMensal: string;
  valorEstimado: string;
  ciNumero: string;
  ciAno: number;
  ciOrigem: string;
  linkAbertura: string;
  linkAberturaNa: boolean;
  linkHomologacao: string;
  linkHomologacaoNa: boolean;
  linkPncp: string;
  linkPncpNa: boolean;
  houveRetificacao: boolean;
  linkRetificacao: string;
  linkCancelamento: string;
  linkCancelamentoNa: boolean;
  parecerNumero: string;
  parecerAno: number;
  parecerNa: boolean;
  status: StatusAdmin;
  nota: string;
};

const FILTROS: { id: string; label: string }[] = [
  { id: "todos", label: "Todos" },
  { id: "andamento", label: "Em curso" },
  { id: "proposta", label: "Recebendo proposta" },
  { id: "pareceres", label: "Pareceres" },
  { id: "assinatura", label: "Assinatura" },
  { id: "execucao", label: "Execução" },
  { id: "atencao", label: "Vencendo" },
  { id: "encerrados", label: "Encerrados" },
  { id: "cancelados", label: "Cancelados" },
];

const RESERVADOS = new Set(FILTROS.map((item) => item.id));

const ALERTAS = [1, 3, 5, 7, 10, 15, 30, 60, 90];

function filtrosVisiveis() {
  const extras = listaCodigos("administrativo")
    .filter((codigo) => !RESERVADOS.has(codigo) && codigo !== "encerrado" && codigo !== "cancelado")
    .map((codigo) => ({ id: codigo, label: statusAdminLabel(codigo) }));
  const indice = FILTROS.findIndex((item) => item.id === "atencao");
  return [...FILTROS.slice(0, indice), ...extras, ...FILTROS.slice(indice)];
}

function correspondeFiltro(processo: ProcessoAdmin, filtro: string): boolean {
  if (filtro === "todos") return true;
  if (filtro === "andamento") return !encerraStatus("administrativo", processo.status);
  if (filtro === "encerrados") return encerraStatus("administrativo", processo.status) && processo.status !== "cancelado";
  if (filtro === "cancelados") return processo.status === "cancelado";
  if (filtro === "atencao") return precisaAvisoAdmin(processo);
  return processo.status === filtro;
}

const TOM: Record<UrgenciaAdmin, { badge: string; bar: string }> = {
  vencido: { badge: "bg-seal-soft text-seal", bar: "bg-seal" },
  hoje: { badge: "bg-seal-soft text-seal", bar: "bg-seal" },
  proximo: { badge: "bg-brass-soft text-brass", bar: "bg-brass" },
  ok: { badge: "bg-pine-soft text-pine", bar: "bg-pine" },
  encerrado: { badge: "bg-[var(--color-comp-soft)] text-[var(--color-comp)]", bar: "bg-[var(--color-comp)]" },
  cancelado: { badge: "bg-line text-muted", bar: "bg-line" },
};

const inputCls = "h-11 w-full rounded-xl border border-line bg-paper px-3 text-sm text-ink placeholder:text-muted";

const TIPOS_LINK_ANDAMENTO = [
  { id: "publicacao", campo: "linkAbertura", rotulo: "Link de publicação", curto: "publicação" },
  { id: "homologacao", campo: "linkHomologacao", rotulo: "Link de homologação", curto: "homologação" },
  { id: "pncp", campo: "linkPncp", rotulo: "Link do PNCP", curto: "PNCP" },
  { id: "retificacao", campo: "linkRetificacao", rotulo: "Link da retificação", curto: "retificação" },
  { id: "cancelamento", campo: "linkCancelamento", rotulo: "Link de cancelamento", curto: "cancelamento" },
] as const;

type TipoLinkAndamento = (typeof TIPOS_LINK_ANDAMENTO)[number]["id"];

function evento(texto: string, autorNome: string, link?: string): Andamento {
  return { id: crypto.randomUUID(), em: new Date().toISOString(), texto, autorNome, ...(link ? { link } : {}) };
}

function mensagemErro(err: unknown): string {
  const bruto = err instanceof Error ? err.message.trim() : "";
  if (!bruto) return "Não foi possível salvar. Tente de novo.";
  if (/column|coluna|does not exist|não existe|syntax/i.test(bruto)) {
    return "Não foi possível gravar o processo. Atualize a página e tente de novo.";
  }
  return bruto.length < 180 ? bruto : "Não foi possível salvar. Tente de novo.";
}

function vazio(): FormAdmin {
  return {
    numero: "",
    numeroAno: new Date().getFullYear(),
    referencia: "",
    objeto: "",
    tipo: "Pregão",
    tipoNumero: "",
    tipoAno: new Date().getFullYear(),
    dataInicio: todayIso(),
    previsao: addDaysIso(30),
    encerramento: addDaysIso(30),
    alertaDias: 15,
    possuiContrato: false,
    vigenciaInicio: todayIso(),
    vigenciaFim: addDaysIso(365),
    contratado: "",
    documento: "",
    contratado2: "",
    documento2: "",
    valorTotal: "",
    valorMensal: "",
    valorEstimado: "",
    ciNumero: "",
    ciAno: new Date().getFullYear(),
    ciOrigem: "",
    linkAbertura: "",
    linkAberturaNa: false,
    linkHomologacao: "",
    linkHomologacaoNa: false,
    linkPncp: "",
    linkPncpNa: false,
    houveRetificacao: false,
    linkRetificacao: "",
    linkCancelamento: "",
    linkCancelamentoNa: false,
    parecerNumero: "",
    parecerAno: new Date().getFullYear(),
    parecerNa: false,
    status: "proposta",
    nota: "",
  };
}

function separarNumero(numero: string, ano: number | null): { numero: string; ano: number } {
  const composto = /^(\d{1,6})\/(\d{4})$/.exec(numero.trim());
  if (composto) return { numero: composto[1], ano: Number(composto[2]) };
  const digitos = numero.replace(/\D/g, "").slice(0, 6);
  return { numero: digitos, ano: ano ?? new Date().getFullYear() };
}

function doProcesso(p: ProcessoAdmin): FormAdmin {
  const numero = separarNumero(p.numero, p.numeroAno);
  return {
    numero: numero.numero,
    numeroAno: numero.ano,
    referencia: p.referencia,
    objeto: p.objeto,
    tipo: p.tipo,
    tipoNumero: p.tipoNumero != null ? String(p.tipoNumero) : "",
    tipoAno: p.tipoAno ?? new Date().getFullYear(),
    dataInicio: p.dataInicio,
    previsao: p.previsaoEtapa ?? p.encerramento,
    encerramento: p.encerramento,
    alertaDias: p.alertaDias,
    possuiContrato: p.status === "execucao" || p.possuiContrato,
    vigenciaInicio: p.vigenciaInicio ?? todayIso(),
    vigenciaFim: p.vigenciaFim ?? p.encerramento,
    contratado: p.contratado,
    documento: p.documento,
    contratado2: p.contratado2,
    documento2: p.documento2,
    valorTotal: centavosParaCampo(p.valorTotalCentavos),
    valorMensal: centavosParaCampo(p.valorMensalCentavos),
    valorEstimado: centavosParaCampo(p.valorEstimadoCentavos),
    ciNumero: p.ciNumero != null ? String(p.ciNumero) : "",
    ciAno: p.ciAno ?? new Date().getFullYear(),
    ciOrigem: p.ciOrigem,
    linkAbertura: p.linkAbertura,
    linkAberturaNa: p.linkAberturaNa,
    linkHomologacao: p.linkHomologacao,
    linkHomologacaoNa: p.linkHomologacaoNa,
    linkPncp: p.linkPncp,
    linkPncpNa: p.linkPncpNa,
    houveRetificacao: Boolean(p.linkRetificacao),
    linkRetificacao: p.linkRetificacao,
    linkCancelamento: p.linkCancelamento,
    linkCancelamentoNa: p.linkCancelamentoNa,
    parecerNumero: p.parecerNa ? "" : p.parecerNumero != null ? String(p.parecerNumero) : "",
    parecerAno: p.parecerAno ?? new Date().getFullYear(),
    parecerNa: p.parecerNa,
    status: p.status,
    nota: "",
  };
}

function errosDeLinks(form: FormAdmin): string[] {
  const erros: string[] = [];
  const campos = [
    ["link de publicação", form.linkAbertura, exigeLinks(form.tipo) && !form.linkAberturaNa],
    ["link de homologação", form.linkHomologacao, false],
    ["link do PNCP", form.linkPncp, false],
  ] as const;
  for (const [nome, valor, obrigatorio] of campos) {
    if (!valor.trim() || (nome === "link de publicação" && form.linkAberturaNa)) {
      if (obrigatorio) erros.push(`Informe o ${nome}.`);
      continue;
    }
    if (!normalizarLink(valor)) erros.push(`O ${nome} está inválido.`);
  }
  if (form.houveRetificacao) {
    if (!form.linkRetificacao.trim()) erros.push("Informe o link da retificação.");
    else if (!normalizarLink(form.linkRetificacao)) erros.push("O link da retificação está inválido.");
  }
  if (form.status === "cancelado" && !form.linkCancelamentoNa) {
    if (!form.linkCancelamento.trim()) erros.push("Informe o link de cancelamento.");
    else if (!normalizarLink(form.linkCancelamento)) erros.push("O link de cancelamento está inválido.");
  }
  return erros;
}

function validar(form: FormAdmin): string[] {
  if (tipoSimples(form.tipo)) {
    const erros: string[] = [];
    if (numeroPeca(form.numero) == null) erros.push("Informe o número do processo.");
    if (!form.referencia.trim()) erros.push("Informe a referência.");
    if (!form.objeto.trim()) erros.push("Informe o objeto.");
    if (numeroPeca(form.ciNumero) == null) erros.push("Informe o número da comunicação interna.");
    if (!form.ciOrigem.trim()) erros.push("Informe de onde veio a comunicação interna.");
    if (form.tipo === "Doação" && numeroPeca(form.tipoNumero) == null) erros.push("Informe o número do tipo.");
    erros.push(...errosDeLinks(form));
    return erros;
  }
  const erros: string[] = [];
  const cancelado = form.status === "cancelado";
  if (numeroPeca(form.numero) == null) erros.push("Informe o número do processo.");
  if (numeroPeca(form.tipoNumero) == null) erros.push("Informe o número do tipo.");
  if (numeroPeca(form.ciNumero) == null) erros.push("Informe o número da comunicação interna.");
  if (!form.ciOrigem.trim()) erros.push("Informe de onde veio a comunicação interna.");
  if (!form.dataInicio) erros.push("Informe a data de início.");
  if (!cancelado) {
    if (!form.objeto.trim()) erros.push("Informe o objeto.");
    if (form.status !== "cancelado" && !form.parecerNa && numeroPeca(form.parecerNumero) == null) erros.push("Informe o número do parecer do agente de contratações.");
  }
  if (pedePrevisao(form.status) && !form.previsao) erros.push("Informe a data do prazo.");
  if (form.status === "encerrado") {
    if (!form.encerramento) erros.push("Informe a data de encerramento.");
    else if (form.dataInicio && form.encerramento < form.dataInicio) erros.push("O encerramento não pode ser antes do início.");
    if (!form.contratado.trim()) erros.push("Informe o contratado.");
    const digitos = form.documento.replace(/\D/g, "");
    if (digitos.length !== 11 && digitos.length !== 14) erros.push("Informe o CPF ou o CNPJ.");
    if (reaisParaCentavos(form.valorTotal) == null) erros.push("Informe o valor da contratação ou aquisição.");
  } else if (form.status === "execucao") {
    if (!form.contratado.trim()) erros.push("Informe os dados do contratado.");
    if (!form.vigenciaInicio || !form.vigenciaFim) erros.push("Informe a vigência do contrato.");
    else if (form.vigenciaFim < form.vigenciaInicio) erros.push("A vigência termina antes de começar.");
    if (reaisParaCentavos(form.valorTotal) == null) erros.push("Informe o valor anual do contrato.");
    if (reaisParaCentavos(form.valorMensal) == null) erros.push("Informe o valor mensal do contrato.");
  } else if (form.status !== "encerrado" && form.valorEstimado.trim() && reaisParaCentavos(form.valorEstimado) == null) {
    erros.push("O valor estimado está inválido.");
  }
  if (permiteDoisContratados(form.tipo) && (form.status === "encerrado" || form.status === "execucao")) {
    const nome2 = form.contratado2.trim();
    const doc2 = form.documento2.replace(/\D/g, "");
    if (nome2 || form.documento2.trim()) {
      if (!nome2) erros.push("Informe o segundo contratado ou fornecedor.");
      if (doc2 && doc2.length !== 11 && doc2.length !== 14) erros.push("O CPF ou CNPJ do segundo contratado ou fornecedor está inválido.");
      else if (form.status === "encerrado" && nome2 && doc2.length !== 11 && doc2.length !== 14) erros.push("Informe o CPF ou o CNPJ do segundo contratado ou fornecedor.");
    }
  }
  erros.push(...errosDeLinks(form));
  return erros;
}

function mudancas(antes: ProcessoAdmin, form: FormAdmin): string | null {
  const partes: string[] = [];
  const numeroNovo = rotuloNumero(String(numeroPeca(form.numero) ?? ""), form.numeroAno);
  if (rotuloNumero(antes.numero, antes.numeroAno) !== numeroNovo) partes.push(`o número para ${numeroNovo}`);
  if (antes.referencia !== form.referencia.trim()) partes.push("a referência");
  if (antes.objeto !== form.objeto.trim()) partes.push("o objeto");
  const tipoNovo = rotuloTipo(form.tipo, numeroPeca(form.tipoNumero), form.tipoAno);
  if (rotuloTipo(antes.tipo, antes.tipoNumero, antes.tipoAno) !== tipoNovo) partes.push(`o tipo para ${tipoNovo}`);
  if (antes.dataInicio !== form.dataInicio) partes.push("a data de início");
  if (antes.status !== form.status) partes.push(`o status para ${statusAdminLabel(form.status)}`);
  if (pedePrevisao(form.status) && (antes.previsaoEtapa ?? "") !== form.previsao) partes.push(`o prazo para ${formatDate(form.previsao)}`);
  if (form.status === "encerrado" && antes.encerramento !== form.encerramento) partes.push(`o encerramento para ${formatDate(form.encerramento)}`);
  if (form.status === "execucao" && !antes.possuiContrato) partes.push("o contrato");
  if (antes.alertaDias !== form.alertaDias) partes.push("a antecedência do aviso");
  const ciNova = formatarPeca(numeroPeca(form.ciNumero), form.ciAno);
  const parecerNovo = form.parecerNa ? "N/A" : formatarPeca(numeroPeca(form.parecerNumero), form.parecerAno);
  if (formatarPeca(antes.ciNumero, antes.ciAno) !== ciNova) partes.push(`a comunicação interna para ${ciNova}`);
  if (antes.ciOrigem !== form.ciOrigem.trim()) partes.push("a origem da comunicação interna");
  const publicacaoNa = form.linkAberturaNa;
  const aberturaNova = publicacaoNa ? "N/A" : normalizarLink(form.linkAbertura) || "";
  if ((antes.linkAberturaNa ? "N/A" : antes.linkAbertura || "") !== aberturaNova) partes.push(publicacaoNa ? "a publicação para N/A" : "o link de publicação");
  const homologacaoNova = form.linkHomologacaoNa ? "N/A" : normalizarLink(form.linkHomologacao) || "";
  if ((antes.linkHomologacaoNa ? "N/A" : antes.linkHomologacao || "") !== homologacaoNova) partes.push(form.linkHomologacaoNa ? "a homologação para N/A" : "o link de homologação");
  const pncpNovo = form.linkPncpNa ? "N/A" : normalizarLink(form.linkPncp) || "";
  if ((antes.linkPncpNa ? "N/A" : antes.linkPncp || "") !== pncpNovo) partes.push(form.linkPncpNa ? "o PNCP para N/A" : "o link do PNCP");
  const retificacaoNova = form.houveRetificacao ? normalizarLink(form.linkRetificacao) || "" : "";
  if ((antes.linkRetificacao || "") !== retificacaoNova) partes.push(retificacaoNova ? "o link da retificação" : "a retificação");
  const cancelamentoNovo = form.status === "cancelado" ? (form.linkCancelamentoNa ? "N/A" : normalizarLink(form.linkCancelamento) || "") : "";
  if ((antes.linkCancelamentoNa ? "N/A" : antes.linkCancelamento || "") !== cancelamentoNovo) partes.push(form.linkCancelamentoNa ? "o cancelamento para N/A" : cancelamentoNovo ? "o link de cancelamento" : "o cancelamento");
  if ((antes.parecerNa ? "N/A" : formatarPeca(antes.parecerNumero, antes.parecerAno)) !== parecerNovo) partes.push(`o parecer para ${parecerNovo}`);
  if (!partes.length) return null;
  if (partes.length === 1) return `Alterou ${partes[0]}.`;
  const ultimo = partes.pop();
  return `Alterou ${partes.join(", ")} e ${ultimo}.`;
}

function montar(form: FormAdmin, base: Pick<ProcessoAdmin, "id" | "historico" | "equipeId" | "autorId" | "autorNome">): ProcessoAdmin {
  if (tipoSimples(form.tipo)) {
    const hoje = todayIso();
    const doacao = form.tipo === "Doação";
    return {
      id: base.id,
      numero: String(numeroPeca(form.numero) ?? ""),
      numeroAno: form.numeroAno,
      referencia: form.referencia.trim(),
      objeto: form.objeto.trim(),
      tipo: form.tipo,
      tipoNumero: doacao ? numeroPeca(form.tipoNumero) : null,
      tipoAno: doacao ? form.tipoAno : null,
      dataInicio: hoje,
      previsaoEtapa: null,
      encerramento: hoje,
      alertaDias: form.alertaDias,
      possuiContrato: false,
      vigenciaInicio: null,
      vigenciaFim: null,
      contratado: "",
      documento: "",
      contratado2: "",
      documento2: "",
      valorTotalCentavos: null,
      valorMensalCentavos: null,
      valorEstimadoCentavos: form.status === "execucao" || form.status === "encerrado" ? null : reaisParaCentavos(form.valorEstimado),
      ciNumero: numeroPeca(form.ciNumero),
      ciAno: form.ciAno,
      ciOrigem: form.ciOrigem.trim(),
      linkAbertura: "",
      linkAberturaNa: false,
      linkHomologacao: normalizarLink(form.linkHomologacao) || "",
      linkHomologacaoNa: form.linkHomologacaoNa,
      linkPncp: normalizarLink(form.linkPncp) || "",
      linkPncpNa: form.linkPncpNa,
      linkRetificacao: form.houveRetificacao ? normalizarLink(form.linkRetificacao) || "" : "",
      linkCancelamento: form.status === "cancelado" && !form.linkCancelamentoNa ? normalizarLink(form.linkCancelamento) || "" : "",
      linkCancelamentoNa: form.status === "cancelado" && form.linkCancelamentoNa,
      parecerNumero: null,
      parecerAno: null,
      parecerNa: false,
      status: form.status,
      historico: base.historico,
      equipeId: base.equipeId,
      autorId: base.autorId,
      autorNome: base.autorNome,
    };
  }
  const execucao = form.status === "execucao";
  const encerrado = form.status === "encerrado";
  const cancelado = form.status === "cancelado";
  const comValor = encerrado;
  const previsao = pedePrevisao(form.status) ? form.previsao : null;
  const encerramento =
    form.status === "encerrado"
      ? form.encerramento
      : execucao
        ? form.vigenciaFim || form.dataInicio
        : previsao || form.dataInicio;
  return {
    id: base.id,
    numero: String(numeroPeca(form.numero) ?? ""),
    numeroAno: form.numeroAno,
    referencia: form.referencia.trim(),
    objeto: form.objeto.trim(),
    tipo: form.tipo,
    tipoNumero: numeroPeca(form.tipoNumero),
    tipoAno: form.tipoAno,
    dataInicio: form.dataInicio,
    previsaoEtapa: previsao,
    encerramento,
    alertaDias: form.alertaDias,
    possuiContrato: execucao,
    vigenciaInicio: execucao ? form.vigenciaInicio : null,
    vigenciaFim: execucao ? form.vigenciaFim : null,
    contratado: execucao || encerrado ? form.contratado.trim() : "",
    documento: execucao || encerrado ? form.documento.trim() : "",
    contratado2: (execucao || encerrado) && permiteDoisContratados(form.tipo) ? form.contratado2.trim() : "",
    documento2: (execucao || encerrado) && permiteDoisContratados(form.tipo) ? form.documento2.trim() : "",
    valorTotalCentavos: comValor || execucao ? reaisParaCentavos(form.valorTotal) : null,
    valorMensalCentavos: execucao ? reaisParaCentavos(form.valorMensal) : null,
    valorEstimadoCentavos: !execucao && !encerrado ? reaisParaCentavos(form.valorEstimado) : null,
    ciNumero: numeroPeca(form.ciNumero),
    ciAno: form.ciAno,
    ciOrigem: form.ciOrigem.trim(),
    linkAbertura: form.linkAberturaNa ? "" : normalizarLink(form.linkAbertura) || "",
    linkAberturaNa: form.linkAberturaNa,
    linkHomologacao: form.linkHomologacaoNa ? "" : normalizarLink(form.linkHomologacao) || "",
    linkHomologacaoNa: form.linkHomologacaoNa,
    linkPncp: form.linkPncpNa ? "" : normalizarLink(form.linkPncp) || "",
    linkPncpNa: form.linkPncpNa,
    linkRetificacao: form.houveRetificacao ? normalizarLink(form.linkRetificacao) || "" : "",
    linkCancelamento: form.status === "cancelado" && !form.linkCancelamentoNa ? normalizarLink(form.linkCancelamento) || "" : "",
    linkCancelamentoNa: form.status === "cancelado" && form.linkCancelamentoNa,
    parecerNumero: cancelado || form.parecerNa ? null : numeroPeca(form.parecerNumero),
    parecerAno: cancelado || form.parecerNa ? null : form.parecerAno,
    parecerNa: !cancelado && form.parecerNa,
    status: form.status,
    historico: base.historico,
    equipeId: base.equipeId,
    autorId: base.autorId,
    autorNome: base.autorNome,
  };
}

export function AdminPainel({
  equipeAtual,
  equipes,
  meuNome,
  sinalNovo,
  onToast,
  processosIniciais,
  cargaId,
  abasIniciais,
  children,
}: {
  equipeAtual: string | null;
  equipes: { id: string; nome: string }[];
  meuNome: string;
  sinalNovo: number;
  onToast: (mensagem: string) => void;
  processosIniciais: ProcessoAdmin[];
  cargaId: number;
  abasIniciais: string[];
  children: ReactNode;
}) {
  const { user } = useCurrentUserState();
  const [lista, setLista] = useState<ProcessoAdmin[]>(processosIniciais);
  const [pronto, setPronto] = useState(cargaId > 0);
  const [guia, setGuia] = useState<GuiaAdmin>("lista");
  const [filtro, setFiltro] = useState<FiltroAdmin>("todos");
  const [tipoAba, setTipoAba] = useState<string>("todos");
  const [abasExtra, setAbasExtra] = useState<string[]>(abasIniciais);
  const [busca, setBusca] = useState("");
  const [ordemCampo, setOrdemCampo] = useState<OrdemAdmin>("numero");
  const [ordemDir, setOrdemDir] = useState<"asc" | "desc">("asc");
  const [parte, setParte] = useState(0);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<ProcessoAdmin | null>(null);
  const [form, setForm] = useState<FormAdmin>(vazio);
  const [erros, setErros] = useState<string[]>([]);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [andamentoId, setAndamentoId] = useState<string | null>(null);
  const [notaAndamento, setNotaAndamento] = useState("");
  const [statusAndamento, setStatusAndamento] = useState<StatusAdmin>("proposta");
  const [novoEncerramento, setNovoEncerramento] = useState("");
  const [vigenciaInicioAnd, setVigenciaInicioAnd] = useState("");
  const [vigenciaFimAnd, setVigenciaFimAnd] = useState("");
  const [contratadoAnd, setContratadoAnd] = useState("");
  const [documentoAnd, setDocumentoAnd] = useState("");
  const [contratado2And, setContratado2And] = useState("");
  const [documento2And, setDocumento2And] = useState("");
  const [valorAnd, setValorAnd] = useState("");
  const [escolhaLink, setEscolhaLink] = useState(false);
  const [linksAndamento, setLinksAndamento] = useState<Partial<Record<TipoLinkAndamento, string>>>({});
  const [periodo, setPeriodo] = useState<PeriodoRelatorio>("mensal");
  const [ancora, setAncora] = useState(() => todayIso().slice(0, 7));
  const [statusRelatorio, setStatusRelatorio] = useState<StatusRelatorio>("todos");
  const [relatorio, setRelatorio] = useState<{
    rotulo: string;
    inicio: string;
    fim: string;
    itens: ProcessoAdmin[];
  } | null>(null);
  const [modoRelatorio, setModoRelatorio] = useState<ModoRelatorio>("processos");
  const [anoPecas, setAnoPecas] = useState("todos");
  const [relatorioPecas, setRelatorioPecas] = useState<{ rotulo: string; itens: ProcessoAdmin[] } | null>(null);
  const [anotacoesCi, setAnotacoesCi] = useState<{ ano: number; numero: number; destino: string; desativada: boolean }[]>([]);
  const sinalVisto = useRef(sinalNovo);
  const listaGeracao = useRef(0);
  const cargaVista = useRef(0);

  useEffect(() => {
    if (cargaId === 0 || cargaVista.current === cargaId) return;
    cargaVista.current = cargaId;
    setLista(processosIniciais);
    setAbasExtra(abasIniciais.filter((nome) => !(MODALIDADES as readonly string[]).includes(nome)));
    setPronto(true);
  }, [cargaId, processosIniciais, abasIniciais]);

  useEffect(() => {
    if (sinalNovo === sinalVisto.current) return;
    sinalVisto.current = sinalNovo;
    setEditing(null);
    setForm(vazio());
    setErros([]);
    setFormOpen(true);
    setGuia("lista");
  }, [sinalNovo]);

  useEffect(() => {
    if (!user?.id || cargaId === 0) return;
    let vivo = true;
    const carregar = () => {
      const geracao = ++listaGeracao.current;
      void listarAdmin({ data: equipeAtual })
        .then((itens) => {
          if (!vivo || listaGeracao.current !== geracao) return;
          setLista(itens);
        })
        .catch(() => undefined);
    };
    const id = window.setInterval(carregar, 30_000);
    return () => {
      vivo = false;
      window.clearInterval(id);
    };
  }, [user?.id, equipeAtual, cargaId]);

  useEffect(() => {
    if (!user?.id) return;
    void listarCiAnotacoes()
      .then(setAnotacoesCi)
      .catch(() => undefined);
  }, [user?.id, lista]);

  useEffect(() => {
    setParte(0);
  }, [filtro, busca, tipoAba, ordemCampo, ordemDir, equipeAtual]);

  useEffect(() => {
    if (!pronto || typeof Notification === "undefined" || Notification.permission !== "granted") return;
    const disparar = () => {
      const enviados = new Set(avisosAdminEnviados());
      const novos: string[] = [];
      let mostrados = 0;
      for (const item of lista.filter((p) => precisaAvisoAdmin(p))) {
        const key = avisoAdminKey(item);
        if (enviados.has(key)) continue;
        novos.push(key);
        if (mostrados < 3) {
          try {
            new Notification("Processo administrativo", {
              body: `${rotuloNumero(item.numero, item.numeroAno)} — ${item.objeto}. ${prazoAdminLabel(item)}.`,
              tag: item.id,
            });
            mostrados += 1;
          } catch {
            /* navegador recusou a notificação */
          }
        }
      }
      if (novos.length) marcarAvisosAdmin(novos);
    };
    disparar();
    const id = window.setInterval(disparar, 60_000);
    return () => window.clearInterval(id);
  }, [pronto, lista]);

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    const itens = lista.filter((p) => {
      const situacao = correspondeFiltro(p, filtro);
      if (!situacao || (tipoAba !== "todos" && p.tipo !== tipoAba)) return false;
      if (!q) return true;
      return [rotuloNumero(p.numero, p.numeroAno), rotuloTipo(p.tipo, p.tipoNumero, p.tipoAno), p.referencia, p.objeto, p.tipo, p.contratado, p.contratado2, p.autorNome, p.ciOrigem, formatarPeca(p.ciNumero, p.ciAno), formatarPeca(p.parecerNumero, p.parecerAno)]
        .join(" ")
        .toLowerCase()
        .includes(q);
    });
    const fator = ordemDir === "asc" ? 1 : -1;
    return [...itens].sort((a, b) => {
      const numero = a.numero.localeCompare(b.numero, "pt-BR", { numeric: true });
      const cmp =
        ordemCampo === "numero"
          ? numero
          : ordemCampo === "tipo"
            ? a.tipo.localeCompare(b.tipo, "pt-BR") || numero
            : dataAlvo(a).localeCompare(dataAlvo(b)) || numero;
      return cmp * fator;
    });
  }, [lista, filtro, busca, tipoAba, ordemCampo, ordemDir]);

  const porParte = 12;
  const totalPartes = Math.max(1, Math.ceil(filtrados.length / porParte));
  const parteAtual = Math.min(parte, totalPartes - 1);
  const daParte = filtrados.slice(parteAtual * porParte, parteAtual * porParte + porParte);
  const atencao = lista.filter((p) => precisaAvisoAdmin(p));
  const tiposVisiveis = [...MODALIDADES, ...abasExtra];
  const tiposComLancamento = tiposVisiveis.filter((tipo) => lista.some((item) => item.tipo === tipo));
  const filtrosComLancamento = filtrosVisiveis().filter((item) => {
    if (item.id === "todos") return true;
    return lista.some((processo) => correspondeFiltro(processo, item.id));
  });

  useEffect(() => {
    if (tipoAba !== "todos" && !tiposComLancamento.includes(tipoAba)) setTipoAba("todos");
    if (filtro !== "todos" && !filtrosComLancamento.some((item) => item.id === filtro)) setFiltro("todos");
  }, [tipoAba, filtro, tiposComLancamento, filtrosComLancamento]);
  const porTipo = tiposVisiveis.map((tipo) => ({
    rotulo: tipo,
    valor: lista.filter((p) => p.tipo === tipo).length,
  })).filter((item) => item.valor > 0);
  const porStatus = listaCodigos("administrativo").map((status) => ({
    rotulo: statusAdminLabel(status),
    valor: lista.filter((p) => p.status === status).length,
  })).filter((item) => item.valor > 0);

  const linhasCi = useMemo(
    () =>
      sequenciaControle(
        lista
          .filter((item) => item.ciNumero != null && item.ciAno != null && daGerenciaAdministrativa(item.ciOrigem))
          .map((item) => ({
            numero: item.ciNumero as number,
            ano: item.ciAno as number,
            referencia: item.referencia,
            processo: rotuloNumero(item.numero, item.numeroAno),
          })),
        anotacoesCi,
      ),
    [lista, anotacoesCi],
  );
  const linhasParecer = useMemo(
    () =>
      sequenciaControle(
        lista
          .filter((item) => item.parecerNumero != null && item.parecerAno != null)
          .map((item) => ({
            numero: item.parecerNumero as number,
            ano: item.parecerAno as number,
            referencia: item.referencia,
            processo: rotuloNumero(item.numero, item.numeroAno),
          })),
      ),
    [lista],
  );
  const gruposSetores = useMemo(() => {
    const mapa = new Map<string, { numero: number; ano: number; referencia: string; processo: string }[]>();
    for (const item of lista) {
      if (item.ciNumero == null || item.ciAno == null || daGerenciaAdministrativa(item.ciOrigem)) continue;
      const origem = item.ciOrigem.trim() || "Sem origem";
      const atual = mapa.get(origem) ?? [];
      atual.push({
        numero: item.ciNumero,
        ano: item.ciAno,
        referencia: item.referencia,
        processo: rotuloNumero(item.numero, item.numeroAno),
      });
      mapa.set(origem, atual);
    }
    return [...mapa.entries()]
      .sort((a, b) => a[0].localeCompare(b[0], "pt-BR"))
      .map(([origem, itens]) => ({
        origem,
        itens: itens.sort((a, b) => b.ano - a.ano || a.numero - b.numero),
      }));
  }, [lista]);

  async function anotarCi(linha: LinhaControle, dados: { destino: string; desativada: boolean }) {
    const destino = dados.destino.trim();
    setAnotacoesCi((atual) => {
      const sem = atual.filter((item) => item.ano !== linha.ano || item.numero !== linha.numero);
      if (!destino && !dados.desativada) return sem;
      return [...sem, { ano: linha.ano, numero: linha.numero, destino, desativada: dados.desativada }];
    });
    try {
      await salvarCiAnotacao({ data: { ano: linha.ano, numero: linha.numero, destino, desativada: dados.desativada } });
    } catch (err) {
      onToast(mensagemErro(err));
      void listarCiAnotacoes().then(setAnotacoesCi).catch(() => undefined);
    }
  }

  async function persistir(proximo: ProcessoAdmin[], salvo: ProcessoAdmin | null, apagado: string | null, ok: string) {
    const anterior = lista;
    ++listaGeracao.current;
    setLista(proximo);
    try {
      if (apagado) await apagarAdmin({ data: apagado });
      if (salvo) await salvarAdmin({ data: salvo });
      const confirmacao = ++listaGeracao.current;
      try {
        const frescos = await listarAdmin({ data: equipeAtual });
        if (listaGeracao.current === confirmacao) setLista(frescos);
      } catch {
        /* a lista local fica até a próxima leitura */
      }
      onToast(ok);
      return true;
    } catch (err) {
      const confirmacao = ++listaGeracao.current;
      if (listaGeracao.current === confirmacao) setLista(anterior);
      const mensagem = mensagemErro(err);
      onToast(mensagem);
      return mensagem;
    }
  }

  async function salvarForm() {
    const problemas = validar(form);
    setErros(problemas);
    if (problemas.length) return;
    setFormOpen(false);
    const nota = form.nota.trim();
    if (editing) {
      const texto = mudancas(editing, form);
      const extra: Andamento[] = [];
      if (texto) extra.push(evento(texto, meuNome));
      if (nota) extra.push(evento(nota, meuNome));
      const atualizado = montar(form, { ...editing, historico: [...editing.historico, ...extra] });
      const ok = await persistir(
        lista.map((item) => (item.id === atualizado.id ? atualizado : item)),
        atualizado,
        null,
        "Processo atualizado",
      );
      if (ok === true) return;
      setFormOpen(true);
      setErros([ok]);
      return;
    }
    const criado = montar(form, {
      id: crypto.randomUUID(),
      historico: nota
        ? [evento("Lançou o processo administrativo.", meuNome), evento(nota, meuNome)]
        : [evento("Lançou o processo administrativo.", meuNome)],
      equipeId: equipeAtual,
      autorId: user?.id ?? null,
      autorNome: meuNome,
    });
    const ok = await persistir([criado, ...lista], criado, null, "Processo administrativo lançado");
    if (ok === true) return;
    setFormOpen(true);
    setErros([ok]);
  }

  async function registrarAndamento() {
    if (!andamentoId) return;
    const texto = notaAndamento.trim();
    const atual = lista.find((item) => item.id === andamentoId);
    if (!atual) return;
    const escolhidos = TIPOS_LINK_ANDAMENTO.filter((item) => item.id in linksAndamento);
    const aplicados: { curto: string; url: string; campo: (typeof TIPOS_LINK_ANDAMENTO)[number]["campo"] }[] = [];
    for (const item of escolhidos) {
      const url = normalizarLink(linksAndamento[item.id] ?? "");
      if (!url) {
        onToast((linksAndamento[item.id] ?? "").trim() ? `O ${item.rotulo.toLowerCase()} está inválido.` : `Informe o ${item.rotulo.toLowerCase()}.`);
        return;
      }
      aplicados.push({ curto: item.curto, url, campo: item.campo });
    }
    const simples = tipoSimples(atual.tipo);
    if (!simples && pedePrevisao(statusAndamento) && !novoEncerramento) {
      onToast("Informe a data do prazo.");
      return;
    }
    if (!texto && aplicados.length === 0 && statusAndamento === atual.status && novoEncerramento === (atual.previsaoEtapa ?? "")) return;
    const statusMudou = statusAndamento !== atual.status;
    const atualizado: ProcessoAdmin = { ...atual, status: statusAndamento };
    for (const item of aplicados) atualizado[item.campo] = item.url;
    if (aplicados.some((item) => item.campo === "linkAbertura")) atualizado.linkAberturaNa = false;
    if (aplicados.some((item) => item.campo === "linkHomologacao")) atualizado.linkHomologacaoNa = false;
    if (aplicados.some((item) => item.campo === "linkPncp")) atualizado.linkPncpNa = false;
    if (aplicados.some((item) => item.campo === "linkCancelamento")) atualizado.linkCancelamentoNa = false;
    if (statusMudou && statusAndamento === "cancelado" && !atualizado.linkCancelamento && !atualizado.linkCancelamentoNa) {
      onToast("Informe o link de cancelamento.");
      setLinksAndamento((previo) => ({ ...previo, cancelamento: previo.cancelamento ?? "" }));
      return;
    }
    if (!simples && pedePrevisao(statusAndamento)) {
      atualizado.previsaoEtapa = novoEncerramento;
      atualizado.encerramento = novoEncerramento;
    }
    if (statusMudou && !simples && statusAndamento === "encerrado") {
      if (!novoEncerramento) {
        onToast("Informe a data de encerramento.");
        return;
      }
      atualizado.encerramento = novoEncerramento;
      if (!atual.possuiContrato) {
        const digitos = documentoAnd.replace(/\D/g, "");
        const valor = reaisParaCentavos(valorAnd);
        if (!contratadoAnd.trim()) {
          onToast("Informe o contratado.");
          return;
        }
        if (digitos.length !== 11 && digitos.length !== 14) {
          onToast("Informe o CPF ou o CNPJ.");
          return;
        }
        if (valor == null) {
          onToast("Informe o valor da contratação ou aquisição.");
          return;
        }
        atualizado.contratado = contratadoAnd.trim();
        atualizado.documento = documentoAnd.trim();
        if (permiteDoisContratados(atual.tipo)) {
          const nome2 = contratado2And.trim();
          const doc2 = documento2And.replace(/\D/g, "");
          if (nome2 || documento2And.trim()) {
            if (!nome2) {
              onToast("Informe o segundo contratado ou fornecedor.");
              return;
            }
            if (doc2.length !== 11 && doc2.length !== 14) {
              onToast("Informe o CPF ou o CNPJ do segundo contratado ou fornecedor.");
              return;
            }
          }
          atualizado.contratado2 = nome2;
          atualizado.documento2 = documento2And.trim();
        } else {
          atualizado.contratado2 = "";
          atualizado.documento2 = "";
        }
        atualizado.valorTotalCentavos = valor;
        atualizado.valorMensalCentavos = null;
        atualizado.possuiContrato = false;
      }
    }
    if (statusMudou && !simples && statusAndamento === "execucao") {
      if (!vigenciaInicioAnd || !vigenciaFimAnd) {
        onToast("Informe a vigência do contrato.");
        return;
      }
      if (!atual.contratado || atual.valorTotalCentavos == null || atual.valorMensalCentavos == null) {
        onToast("Complete contratado e valores em Editar antes de mudar para execução.");
        return;
      }
      atualizado.possuiContrato = true;
      atualizado.vigenciaInicio = vigenciaInicioAnd;
      atualizado.vigenciaFim = vigenciaFimAnd;
      atualizado.encerramento = vigenciaFimAnd;
    }
    const fraseLink =
      aplicados.length === 0
        ? ""
        : aplicados.length === 1
          ? `Adicionou o link de ${aplicados[0].curto}.`
          : `Adicionou os links de ${aplicados.slice(0, -1).map((item) => item.curto).join(", ")} e ${aplicados[aplicados.length - 1].curto}.`;
    const frase = [statusMudou ? `Status alterado para ${statusAdminLabel(statusAndamento)}.` : "", texto, fraseLink].filter(Boolean).join(" ");
    atualizado.historico = [
      ...atual.historico,
      evento(frase, meuNome, aplicados.length === 1 ? aplicados[0].url : undefined),
    ];
    const ok = await persistir(
      lista.map((item) => (item.id === atualizado.id ? atualizado : item)),
      atualizado,
      null,
      "Andamento registrado",
    );
    if (ok !== true) return;
    setAndamentoId(null);
    setNotaAndamento("");
    setNovoEncerramento("");
    setLinksAndamento({});
    setEscolhaLink(false);
  }

  function gerarRelatorio() {
    const intervalo = intervaloPeriodo(ancora, periodo);
    if (!intervalo) {
      onToast("Escolha um mês de referência.");
      return;
    }
    const itens = lista
      .filter((item) => cruzaPeriodo(item, intervalo.inicio, intervalo.fim))
      .filter((item) => statusRelatorio === "todos" || item.status === statusRelatorio)
      .sort((a, b) => (a.numeroAno ?? 0) - (b.numeroAno ?? 0) || a.numero.localeCompare(b.numero, "pt-BR", { numeric: true }));
    setRelatorio({ ...intervalo, itens });
  }

  function gerarPecas() {
    const ano = anoPecas === "todos" ? null : Number(anoPecas);
    const itens = lista
      .filter((item) => item.ciNumero != null || item.parecerNumero != null)
      .filter((item) => ano == null || item.ciAno === ano || item.parecerAno === ano)
      .sort((a, b) => (a.numeroAno ?? 0) - (b.numeroAno ?? 0) || a.numero.localeCompare(b.numero, "pt-BR", { numeric: true }));
    setRelatorioPecas({
      rotulo: ano == null ? "todos os anos" : String(ano),
      itens,
    });
  }

  const totalRelatorio = relatorio?.itens.reduce((soma, item) => soma + (item.valorTotalCentavos ?? 0), 0) ?? 0;
  const mensalRelatorio = relatorio?.itens.reduce((soma, item) => soma + (item.valorMensalCentavos ?? 0), 0) ?? 0;

  const moverPara = useCallback(
    async (id: string, equipeId: string | null) => {
      const atual = lista.find((item) => item.id === id);
      if (!atual || (atual.equipeId ?? null) === equipeId) return;
      try {
        await moverAdmin({ data: { id, equipeId } });
        const frescos = await listarAdmin({ data: equipeAtual });
        setLista(frescos);
        onToast(equipeId ? "Processo movido para a equipe." : "Processo movido para os seus.");
      } catch (err) {
        onToast(mensagemErro(err));
      }
    },
    [equipeAtual, lista, onToast],
  );

  function abrirFormulario() {
    setEditing(null);
    setForm(vazio());
    setErros([]);
    setFormOpen(true);
    setGuia("lista");
  }

  return (
    <SoltarProcessoContext.Provider value={moverPara}>
    <div className="mt-4 grid gap-6 md:grid-cols-[16rem_1fr]">
      <aside className="flex flex-col gap-4 md:sticky md:top-6 md:self-start">
        {(porTipo.length > 0 || porStatus.length > 0) && (
          <div className="flex flex-col gap-3">
            {porTipo.length > 0 && (
              <div>
                <p className="mb-2 text-xs font-medium text-muted">Tipo</p>
                <div className="grid grid-cols-2 gap-2">
                  {porTipo.map((item) => (
                    <Resumo key={item.rotulo} valor={item.valor} rotulo={item.rotulo} tom="pine" />
                  ))}
                </div>
              </div>
            )}
            {porStatus.length > 0 && (
              <div>
                <p className="mb-2 text-xs font-medium text-muted">Status</p>
                <div className="grid grid-cols-2 gap-2">
                  {porStatus.map((item) => (
                    <Resumo key={item.rotulo} valor={item.valor} rotulo={item.rotulo} tom="brass" />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
        {children}
      </aside>

      <section className="min-w-0">
        <div className="mb-4 flex flex-wrap gap-2">
          <GuiaBotao ativo={guia === "lista"} onClick={() => setGuia("lista")}>
            Lista
          </GuiaBotao>
          <GuiaBotao ativo={guia === "estatisticas"} onClick={() => setGuia("estatisticas")}>
            <BarChart3 className="size-4" />
            Estatísticas
          </GuiaBotao>
          <GuiaBotao ativo={guia === "relatorio"} onClick={() => setGuia("relatorio")}>
            <FileText className="size-4" />
            Relatório
          </GuiaBotao>
          <GuiaBotao ativo={guia === "comunicacoes"} onClick={() => setGuia("comunicacoes")}>
            Comunicações Internas
          </GuiaBotao>
          <GuiaBotao ativo={guia === "setores"} onClick={() => setGuia("setores")}>
            Comunicações Internas - Setores
          </GuiaBotao>
          <GuiaBotao ativo={guia === "pareceres"} onClick={() => setGuia("pareceres")}>
            Pareceres do Agente de Contratações
          </GuiaBotao>
          <GuiaBotao ativo={guia === "links"} onClick={() => setGuia("links")}>
            <Link2 className="size-4" />
            Links
          </GuiaBotao>
          <GuiaBotao ativo={guia === "cnpj"} onClick={() => setGuia("cnpj")}>
            <Search className="size-4" />
            Consulta CNPJ
          </GuiaBotao>
          <button
            type="button"
            onClick={abrirFormulario}
            className="inline-flex h-11 items-center gap-2 rounded-xl bg-pine px-4 text-sm font-medium text-sheet"
          >
            <Plus className="size-4" />
            Novo processo
          </button>
        </div>

        {!pronto && guia !== "cnpj" ? (
          <p className="text-sm text-muted">Carregando processos administrativos…</p>
        ) : guia === "cnpj" ? (
          <ConsultaCnpj />
        ) : guia === "estatisticas" ? (
          <GraficoAdmin processos={lista} />
        ) : guia === "comunicacoes" ? (
          <ControlePecas
            titulo="Comunicações Internas"
            nota="Entram só as comunicações feitas pela Gerência Administrativa."
            linhas={linhasCi}
            onAnotar={(linha, dados) => void anotarCi(linha, dados)}
          />
        ) : guia === "setores" ? (
          <ControleSetores grupos={gruposSetores} />
        ) : guia === "pareceres" ? (
          <ControlePecas
            titulo="Pareceres do Agente de Contratações"
            nota="A sequência vai até o último parecer lançado."
            linhas={linhasParecer}
          />
        ) : guia === "links" ? (
          <LinksFaltando
            processos={lista}
            autorNome={meuNome}
            onSalvar={(atualizado) => {
              setLista((atual) => atual.map((item) => (item.id === atualizado.id ? atualizado : item)));
              onToast("Link lançado");
              void salvarAdmin({ data: atualizado }).catch((err: unknown) => {
                onToast(mensagemErro(err));
                void listarAdmin({ data: equipeAtual }).then(setLista).catch(() => undefined);
              });
            }}
          />
        ) : guia === "relatorio" ? (
          <div className="flex flex-col gap-4">
            <div className="no-print flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setModoRelatorio("processos")}
                className={
                  "inline-flex h-10 items-center rounded-full px-4 text-sm font-medium " +
                  (modoRelatorio === "processos" ? "bg-ink text-sheet" : "border border-line bg-sheet text-ink")
                }
              >
                Processos
              </button>
              <button
                type="button"
                onClick={() => setModoRelatorio("pecas")}
                className={
                  "inline-flex h-10 items-center rounded-full px-4 text-sm font-medium " +
                  (modoRelatorio === "pecas" ? "bg-ink text-sheet" : "border border-line bg-sheet text-ink")
                }
              >
                Comunicações e pareceres
              </button>
            </div>
            {modoRelatorio === "pecas" ? (
              <RelatorioPecas
                ano={anoPecas}
                onAno={setAnoPecas}
                relatorio={relatorioPecas}
                onGerar={gerarPecas}
              />
            ) : (
              <>
            <div className="no-print min-w-0 rounded-2xl border border-line bg-sheet p-4">
              <h2 className="font-display text-2xl text-ink">Gerar relatório</h2>
              <p className="mt-1 text-sm text-muted">
                Entram os processos cujo início e prazo cruzam o período. O gráfico acompanha o recorte.
              </p>
              <div className="mt-4 grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-3">
                <Campo label="Período">
                  <select value={periodo} onChange={(e) => setPeriodo(e.target.value as PeriodoRelatorio)} className={inputCls}>
                    <option value="mensal">Mensal</option>
                    <option value="trimestral">Trimestral</option>
                    <option value="semestral">Semestral</option>
                    <option value="anual">Anual</option>
                  </select>
                </Campo>
                <Campo label="Mês de referência">
                  <CampoMes value={ancora} onChange={setAncora} />
                </Campo>
                <Campo label="Situação">
                  <select
                    value={statusRelatorio}
                    onChange={(e) => setStatusRelatorio(e.target.value as StatusRelatorio)}
                    className={inputCls}
                  >
                    <option value="todos">Todos</option>
                    {listaCodigos("administrativo").map((status) => (
                      <option key={status} value={status}>
                        {statusAdminLabel(status)}
                      </option>
                    ))}
                  </select>
                </Campo>
              </div>
              <button
                type="button"
                onClick={gerarRelatorio}
                className="mt-4 inline-flex h-11 items-center gap-2 rounded-xl bg-pine px-4 text-sm font-medium text-sheet"
              >
                <FileText className="size-4" />
                Gerar relatório
              </button>
            </div>

            {relatorio && (
              <article className="relatorio-folha rounded-2xl border border-line bg-sheet p-4 md:p-6">
                <Timbrado />
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-pine">Processos administrativos</p>
                    <h2 className="font-display text-2xl text-ink sm:text-3xl">Relatório · {relatorio.rotulo}</h2>
                    <p className="mt-1 text-sm text-muted">
                      {formatDate(relatorio.inicio)} a {formatDate(relatorio.fim)} ·{" "}
                      {statusRelatorio === "todos" ? "todas as situações" : statusAdminLabel(statusRelatorio).toLowerCase()} ·{" "}
                      {relatorio.itens.length} {relatorio.itens.length === 1 ? "processo" : "processos"}
                    </p>
                  </div>
                  <BotaoRelatorio />
                </div>
                <p className="mt-3 text-sm text-ink">
                  Valor total dos contratos no recorte: {formatarReais(totalRelatorio || null)} · mensal:{" "}
                  {formatarReais(mensalRelatorio || null)}
                </p>
                <div className="mt-4">
                  <GraficoAdmin processos={relatorio.itens} />
                </div>
                {relatorio.itens.length === 0 ? (
                  <p className="mt-4 text-sm text-muted">Nenhum processo neste período.</p>
                ) : (
                  <>
                    <ul className="relatorio-cards mt-4 flex flex-col gap-3 md:hidden">
                      {relatorio.itens.map((item) => (
                        <CartaoProcesso key={item.id} item={item} />
                      ))}
                    </ul>
                    <div className="relatorio-tabela-wrap mt-4 hidden md:block">
                    <table className="relatorio-tabela w-full border-collapse text-left text-sm">
                      <thead>
                        <tr className="border-b border-line text-xs text-muted">
                          <th className="py-2 pr-3 font-medium">Número</th>
                          <th className="py-2 pr-3 font-medium">Referência</th>
                          <th className="py-2 pr-3 font-medium">Tipo</th>
                          <th className="py-2 pr-3 font-medium">Situação</th>
                          <th className="py-2 pr-3 font-medium">Prazo</th>
                          <th className="py-2 pr-3 font-medium">Contratado</th>
                          <th className="py-2 font-medium">Valores</th>
                        </tr>
                      </thead>
                      <tbody>
                        {relatorio.itens.map((item) => (
                          <tr key={item.id} className="border-b border-line align-top">
                            <td className="col-fixa py-2 pr-3 font-medium text-ink">{rotuloNumero(item.numero, item.numeroAno)}</td>
                            <td className="py-2 pr-3 text-ink">{item.referencia || "—"}</td>
                            <td className="py-2 pr-3 text-ink">{rotuloTipo(item.tipo, item.tipoNumero, item.tipoAno)}</td>
                            <td className="col-fixa py-2 pr-3 text-ink">{statusAdminLabel(item.status)}</td>
                            <td className="col-fixa py-2 pr-3 text-ink">{marcoAdmin(item).data ? formatDate(marcoAdmin(item).data as string) : "—"}</td>
                            <td className="py-2 pr-3 text-ink">
                              {item.contratado ? (
                                <>
                                  {item.contratado}
                                  {item.documento ? <span className="block text-xs text-muted">{item.documento}</span> : null}
                                  {item.contratado2 ? (
                                    <span className="mt-1 block">
                                      {item.contratado2}
                                      {item.documento2 ? <span className="block text-xs text-muted">{item.documento2}</span> : null}
                                    </span>
                                  ) : null}
                                </>
                              ) : (
                                "—"
                              )}
                            </td>
                            <td className="col-fixa py-2 text-ink">
                              {item.valorTotalCentavos != null ? (
                                <>
                                  {formatarReais(item.valorTotalCentavos)}
                                  {item.valorMensalCentavos != null ? (
                                    <span className="block text-xs text-muted">{formatarReais(item.valorMensalCentavos)} / mês</span>
                                  ) : null}
                                </>
                              ) : (
                                "—"
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    </div>
                  </>
                )}
                <TimbradoRodape />
              </article>
            )}
              </>
            )}
          </div>
        ) : (
          <>
            {atencao.length > 0 && (
              <div role="status" className="mb-4 rounded-2xl border border-line bg-sheet p-4">
                <p className="text-sm font-medium text-ink">
                  {atencao.length === 1 ? "1 prazo precisa de atenção" : `${atencao.length} prazos precisam de atenção`}
                </p>
                <ul className="mt-3 flex flex-col gap-2">
                  {atencao.slice(0, 4).map((item) => (
                    <li key={item.id} className="text-sm">
                      <span className="font-medium text-ink">{rotuloNumero(item.numero, item.numeroAno)}</span>
                      <span className="text-pine"> · {rotuloTipo(item.tipo, item.tipoNumero, item.tipoAno)}</span>
                      <span className="block text-justify text-ink">{item.objeto}</span>
                      <span className="text-muted">{prazoAdminLabel(item)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <div className="flex flex-col gap-3">
              <div className="flex gap-2 overflow-x-auto pb-1">
                <Aba ativo={tipoAba === "todos"} onClick={() => setTipoAba("todos")}>
                  Todos
                </Aba>
                {tiposComLancamento.map((tipo) => (
                  <Aba key={tipo} ativo={tipoAba === tipo} onClick={() => setTipoAba(tipo)}>
                    {tipo}
                  </Aba>
                ))}
              </div>
              <div className="flex gap-2 overflow-x-auto pb-1">
                {filtrosComLancamento.map((item) => (
                  <Aba key={item.id} ativo={filtro === item.id} ink onClick={() => setFiltro(item.id)}>
                    {item.label}
                  </Aba>
                ))}
              </div>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <input
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  placeholder="Buscar número, CI, parecer, objeto ou referência"
                  className="campo-busca h-11 w-full rounded-xl border border-line px-3 text-sm text-ink placeholder:text-muted"
                />
                <label className="flex items-center gap-2 text-sm text-muted">
                  Ordenar
                  <select
                    value={ordemCampo}
                    onChange={(e) => setOrdemCampo(e.target.value as OrdemAdmin)}
                    className="h-10 rounded-full border border-line bg-sheet px-3 text-sm text-ink"
                  >
                    <option value="numero">Número</option>
                    <option value="tipo">Tipo</option>
                    <option value="encerramento">Prazo</option>
                  </select>
                </label>
                <button
                  type="button"
                  onClick={() => setOrdemDir((dir) => (dir === "asc" ? "desc" : "asc"))}
                  className="h-10 rounded-full border border-line bg-sheet px-3 text-sm font-medium text-ink"
                >
                  {ordemDir === "asc" ? "Crescente" : "Decrescente"}
                </button>
              </div>
            </div>

            {filtrados.length === 0 ? (
              <div className="mt-6 rounded-2xl border border-dashed border-line bg-sheet px-6 py-12 text-center">
                <p className="font-display text-2xl text-ink">Nenhum processo administrativo</p>
                <p className="mx-auto mt-2 max-w-sm text-sm text-muted">
                  {lista.length === 0
                    ? "Lance o primeiro com número, status e a data da etapa."
                    : "Nada corresponde a este filtro ou à busca."}
                </p>
              </div>
            ) : (
              <ul className="mt-4 grid grid-cols-3 gap-3">
                {daParte.map((item) => (
                  <CardAdmin
                    key={item.id}
                    processo={item}
                    equipes={equipes}
                    onMover={moverPara}
                    onEditar={() => {
                      setEditing(item);
                      setForm(doProcesso(item));
                      setErros([]);
                      setFormOpen(true);
                    }}
                    onAndamento={() => {
                      setAndamentoId(item.id);
                      setNotaAndamento("");
                      setStatusAndamento(item.status);
                      setNovoEncerramento(item.status === "encerrado" ? item.encerramento : item.previsaoEtapa ?? "");
                      setVigenciaInicioAnd(item.vigenciaInicio ?? item.dataInicio);
                      setVigenciaFimAnd(item.vigenciaFim ?? "");
                      setContratadoAnd(item.contratado ?? "");
                      setDocumentoAnd(item.documento ?? "");
                      setContratado2And(item.contratado2 ?? "");
                      setDocumento2And(item.documento2 ?? "");
                      setValorAnd(centavosParaCampo(item.valorTotalCentavos));
                      setLinksAndamento({});
                      setEscolhaLink(false);
                    }}
                    onExcluir={() => setDeleteId(item.id)}
                  />
                ))}
              </ul>
            )}
            {filtrados.length > porParte && (
              <nav className="mt-4 flex flex-col items-center gap-3" aria-label="Páginas da lista">
                <p className="text-sm text-muted">
                  {parteAtual + 1} de {totalPartes}
                  <span> · {filtrados.length} processos</span>
                </p>
                <div className="flex max-w-full gap-2 overflow-x-auto pb-1">
                  {Array.from({ length: totalPartes }, (_, indice) => (
                    <button
                      key={indice}
                      type="button"
                      onClick={() => setParte(indice)}
                      aria-current={indice === parteAtual ? "page" : undefined}
                      className={
                        "grid size-10 shrink-0 place-items-center rounded-full text-sm font-medium " +
                        (indice === parteAtual ? "bg-ink text-sheet" : "border border-line bg-sheet text-ink")
                      }
                    >
                      {indice + 1}
                    </button>
                  ))}
                </div>
              </nav>
            )}
          </>
        )}
      </section>

      <Dialog.Root open={formOpen} onOpenChange={setFormOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-10 bg-ink/40" />
          <Dialog.Content className="fixed inset-x-3 top-4 bottom-4 z-10 flex flex-col overflow-hidden rounded-2xl border border-line bg-sheet md:inset-auto md:top-1/2 md:left-1/2 md:max-h-[90vh] md:w-full md:max-w-xl md:-translate-x-1/2 md:-translate-y-1/2">
            <div className="flex items-start justify-between gap-3 border-b border-line px-5 py-4">
              <div>
                <Dialog.Title className="font-display text-2xl text-ink">
                  {editing ? "Editar processo administrativo" : "Lançar processo administrativo"}
                </Dialog.Title>
                <Dialog.Description className="mt-1 text-sm text-muted">
                  Inclui comunicação interna, parecer do agente de contratações e, se houver, o contrato.
                </Dialog.Description>
              </div>
              <Dialog.Close className="grid size-10 place-items-center rounded-lg text-muted" aria-label="Fechar">
                <X className="size-4" />
              </Dialog.Close>
            </div>
            <form
              className="flex min-h-0 flex-1 flex-col"
              onSubmit={(e) => {
                e.preventDefault();
                void salvarForm();
              }}
            >
              <div className="flex flex-col gap-3 overflow-y-auto px-5 py-4">
                <Campo label="Tipo">
                  <select
                    value={form.tipo}
                    onChange={(e) => setForm({ ...form, tipo: e.target.value as Modalidade })}
                    className={inputCls}
                  >
                    {tiposVisiveis.map((tipo) => (
                      <option key={tipo}>{tipo}</option>
                    ))}
                  </select>
                </Campo>
                <Campo label="Status">
                  <select
                    value={form.status}
                    onChange={(e) => setForm({ ...form, status: e.target.value as StatusAdmin })}
                    className={inputCls}
                  >
                    {listaCodigos("administrativo").map((status) => (
                      <option key={status} value={status}>
                        {statusAdminLabel(status).toUpperCase()}
                      </option>
                    ))}
                  </select>
                </Campo>
                {(tipoSimples(form.tipo)) ? (
                  <>
                    <PecaCampos
                      titulo="Número do processo"
                      numero={form.numero}
                      ano={form.numeroAno}
                      onNumero={(numero) => setForm({ ...form, numero })}
                      onAno={(numeroAno) => setForm({ ...form, numeroAno })}
                      rotulo={(numero, ano) => rotuloNumero(String(numero), ano)}
                    />
                    <Campo label="Referência">
                      <input
                        value={form.referencia}
                        onChange={(e) => setForm({ ...form, referencia: e.target.value })}
                        className={inputCls}
                        placeholder="PA, contrato ou memorando"
                        required
                      />
                    </Campo>
                    <Campo label="Objeto">
                      <input
                        value={form.objeto}
                        onChange={(e) => setForm({ ...form, objeto: e.target.value })}
                        className={inputCls}
                        placeholder="O que será registrado"
                        required
                      />
                    </Campo>
                    <PecaCampos
                      titulo="Comunicação interna"
                      numero={form.ciNumero}
                      ano={form.ciAno}
                      onNumero={(ciNumero) => setForm({ ...form, ciNumero })}
                      onAno={(ciAno) => setForm({ ...form, ciAno })}
                      obrigatorio
                    />
                    <Campo label="De onde veio a comunicação interna">
                      <input
                        value={form.ciOrigem}
                        onChange={(e) => setForm({ ...form, ciOrigem: e.target.value })}
                        className={inputCls}
                        placeholder="Secretaria, gabinete ou setor"
                        required
                      />
                    </Campo>
                    <CamposLinks form={form} onChange={setForm} />
                    {form.tipo === "Doação" && (
                      <PecaCampos
                        titulo="Número do tipo"
                        numero={form.tipoNumero}
                        ano={form.tipoAno}
                        onNumero={(tipoNumero) => setForm({ ...form, tipoNumero })}
                        onAno={(tipoAno) => setForm({ ...form, tipoAno })}
                        rotulo={(numero, ano) => rotuloTipo(form.tipo, numero, ano)}
                        obrigatorio
                      />
                    )}
                    {form.status !== "execucao" && form.status !== "encerrado" && (
                      <Campo label="Valor estimado">
                        <input
                          value={form.valorEstimado}
                          onChange={(e) => setForm({ ...form, valorEstimado: mascaraReais(e.target.value) })}
                          className={inputCls}
                          inputMode="decimal"
                          placeholder="0,00"
                        />
                      </Campo>
                    )}
                  </>
                ) : (
                <>
                <PecaCampos
                  titulo="Número do processo"
                  numero={form.numero}
                  ano={form.numeroAno}
                  onNumero={(numero) => setForm({ ...form, numero })}
                  onAno={(numeroAno) => setForm({ ...form, numeroAno })}
                  rotulo={(numero, ano) => rotuloNumero(String(numero), ano)}
                />
                <Campo label="Referência">
                  <input
                    value={form.referencia}
                    onChange={(e) => setForm({ ...form, referencia: e.target.value })}
                    className={inputCls}
                    placeholder="PA, contrato ou memorando"
                  />
                </Campo>
                <Campo label="Objeto">
                  <input
                    value={form.objeto}
                    onChange={(e) => setForm({ ...form, objeto: e.target.value })}
                    className={inputCls}
                    placeholder="O que será contratado ou comprado"
                    required={form.status !== "cancelado"}
                  />
                </Campo>
                <PecaCampos
                  titulo="Comunicação interna"
                  numero={form.ciNumero}
                  ano={form.ciAno}
                  onNumero={(ciNumero) => setForm({ ...form, ciNumero })}
                  onAno={(ciAno) => setForm({ ...form, ciAno })}
                  obrigatorio
                />
                <Campo label="De onde veio a comunicação interna">
                  <input
                    value={form.ciOrigem}
                    onChange={(e) => setForm({ ...form, ciOrigem: e.target.value })}
                    className={inputCls}
                    placeholder="Secretaria, gabinete ou setor"
                    required
                  />
                </Campo>
                <CamposLinks form={form} onChange={setForm} />
                <PecaCampos
                  titulo="Parecer do agente de contratações"
                  numero={form.parecerNumero}
                  ano={form.parecerAno}
                  onNumero={(parecerNumero) => setForm({ ...form, parecerNumero, parecerNa: false })}
                  onAno={(parecerAno) => setForm({ ...form, parecerAno })}
                  obrigatorio={form.status !== "cancelado" && !form.parecerNa}
                  na={form.parecerNa}
                  onNa={(parecerNa) => setForm({ ...form, parecerNa })}
                />
                <PecaCampos
                  titulo="Número do tipo"
                  numero={form.tipoNumero}
                  ano={form.tipoAno}
                  onNumero={(tipoNumero) => setForm({ ...form, tipoNumero })}
                  onAno={(tipoAno) => setForm({ ...form, tipoAno })}
                  rotulo={(numero, ano) => rotuloTipo(form.tipo, numero, ano)}
                  obrigatorio
                />
                <Campo label="Data de início">
                  <input type="date" value={form.dataInicio} onChange={(e) => setForm({ ...form, dataInicio: e.target.value })} className={inputCls} required />
                </Campo>
                {form.status === "cancelado" && (
                  <p className="text-sm text-muted">No cancelamento, o número do processo, o número do tipo, a comunicação interna, a origem, a data de início e o link de cancelamento são obrigatórios.</p>
                )}
                {pedePrevisao(form.status) && (
                  <Campo label="Data do prazo">
                    <input type="date" value={form.previsao} onChange={(e) => setForm({ ...form, previsao: e.target.value })} className={inputCls} required />
                  </Campo>
                )}
                {form.status === "encerrado" && (
                  <Campo label="Data de encerramento">
                    <input type="date" value={form.encerramento} onChange={(e) => setForm({ ...form, encerramento: e.target.value })} className={inputCls} required />
                  </Campo>
                )}
                {form.status !== "encerrado" && form.status !== "cancelado" && (
                <Campo label={form.status === "execucao" ? "Avisar dias antes do fim da vigência" : pedePrevisao(form.status) ? "Avisar dias antes do prazo" : "Avisar dias antes da previsão"}>
                  <select
                    value={form.alertaDias}
                    onChange={(e) => setForm({ ...form, alertaDias: Number(e.target.value) })}
                    className={inputCls}
                  >
                    {ALERTAS.map((dias) => (
                      <option key={dias} value={dias}>
                        {dias === 1 ? "1 dia" : `${dias} dias`}
                      </option>
                    ))}
                  </select>
                </Campo>
                )}
                {form.status !== "execucao" && form.status !== "encerrado" && (
                  <Campo label="Valor estimado">
                    <input
                      value={form.valorEstimado}
                      onChange={(e) => setForm({ ...form, valorEstimado: mascaraReais(e.target.value) })}
                      className={inputCls}
                      inputMode="decimal"
                      placeholder="0,00"
                    />
                  </Campo>
                )}
                {form.status === "encerrado" && (
                  <div className="flex flex-col gap-3 rounded-2xl border border-line bg-paper p-3">
                    <p className="text-sm text-muted">Este processo não continua. Informe quem foi contratado e o valor da contratação ou aquisição.</p>
                    <Campo label="Contratado ou fornecedor">
                      <input
                        value={form.contratado}
                        onChange={(e) => setForm({ ...form, contratado: e.target.value })}
                        className={inputCls}
                        placeholder="Nome ou razão social"
                        required
                      />
                    </Campo>
                    <Campo label="CPF ou CNPJ">
                      <input
                        value={form.documento}
                        onChange={(e) => setForm({ ...form, documento: mascaraDocumento(e.target.value) })}
                        className={inputCls}
                        inputMode="numeric"
                        placeholder="000.000.000-00"
                        required
                      />
                    </Campo>
                    {permiteDoisContratados(form.tipo) && (
                      <SegundoContratado
                        nome={form.contratado2}
                        documento={form.documento2}
                        onChange={(contratado2, documento2) => setForm({ ...form, contratado2, documento2 })}
                      />
                    )}
                    <Campo label="Valor da contratação ou aquisição">
                      <input
                        value={form.valorTotal}
                        onChange={(e) => setForm({ ...form, valorTotal: mascaraReais(e.target.value) })}
                        className={inputCls}
                        inputMode="decimal"
                        placeholder="0,00"
                        required
                      />
                    </Campo>
                  </div>
                )}
                {form.status === "execucao" && (
                  <div className="flex flex-col gap-3 rounded-2xl border border-line bg-paper p-3">
                    <p className="text-sm text-muted">A execução inclui o contrato. O aviso conta do fim da vigência.</p>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <Campo label="Vigência — início">
                        <input type="date" value={form.vigenciaInicio} onChange={(e) => setForm({ ...form, vigenciaInicio: e.target.value })} className={inputCls} required />
                      </Campo>
                      <Campo label="Vigência — fim">
                        <input type="date" value={form.vigenciaFim} onChange={(e) => setForm({ ...form, vigenciaFim: e.target.value })} className={inputCls} required />
                      </Campo>
                    </div>
                    <Campo label="Contratado ou fornecedor">
                      <input
                        value={form.contratado}
                        onChange={(e) => setForm({ ...form, contratado: e.target.value })}
                        className={inputCls}
                        placeholder="Nome ou razão social"
                        required
                      />
                    </Campo>
                    <Campo label="CPF ou CNPJ">
                      <input
                        value={form.documento}
                        onChange={(e) => setForm({ ...form, documento: mascaraDocumento(e.target.value) })}
                        className={inputCls}
                        inputMode="numeric"
                        placeholder="000.000.000-00"
                      />
                    </Campo>
                    {permiteDoisContratados(form.tipo) && (
                      <SegundoContratado
                        nome={form.contratado2}
                        documento={form.documento2}
                        onChange={(contratado2, documento2) => setForm({ ...form, contratado2, documento2 })}
                      />
                    )}
                    <div className="grid gap-3 sm:grid-cols-2">
                      <Campo label="Valor anual">
                        <input
                          value={form.valorTotal}
                          onChange={(e) => setForm({ ...form, valorTotal: mascaraReais(e.target.value) })}
                          className={inputCls}
                          inputMode="decimal"
                          placeholder="0,00"
                          required
                        />
                      </Campo>
                      <Campo label="Valor mensal">
                        <input
                          value={form.valorMensal}
                          onChange={(e) => setForm({ ...form, valorMensal: mascaraReais(e.target.value) })}
                          className={inputCls}
                          inputMode="decimal"
                          placeholder="0,00"
                          required
                        />
                      </Campo>
                    </div>
                  </div>
                )}
                <Campo label="Nota do lançamento">
                  <textarea
                    value={form.nota}
                    onChange={(e) => setForm({ ...form, nota: e.target.value })}
                    className="min-h-20 w-full rounded-xl border border-line bg-paper px-3 py-2 text-sm text-ink"
                  />
                </Campo>
                </>
                )}
              </div>
              <div className="flex flex-col gap-3 border-t border-line px-5 py-4">
                {erros.length > 0 && (
                  <ul className="rounded-xl bg-seal-soft px-3 py-2 text-sm text-seal">
                    {erros.map((erro) => (
                      <li key={erro}>{erro}</li>
                    ))}
                  </ul>
                )}
                <div className="flex gap-2">
                <Dialog.Close type="button" className="inline-flex h-11 flex-1 items-center justify-center rounded-xl border border-line text-sm font-medium">
                  Cancelar
                </Dialog.Close>
                <button type="submit" className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-pine text-sm font-medium text-sheet">
                  <Plus className="size-4" />
                  Salvar
                </button>
                </div>
              </div>
            </form>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      <Dialog.Root
        open={andamentoId !== null}
        onOpenChange={(open) => {
          if (open) return;
          setAndamentoId(null);
          setLinksAndamento({});
          setEscolhaLink(false);
        }}
      >
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-10 bg-ink/40" />
          <Dialog.Content className="fixed inset-x-3 top-1/2 z-10 max-h-[90vh] -translate-y-1/2 overflow-y-auto rounded-2xl border border-line bg-sheet p-5 md:left-1/2 md:w-full md:max-w-md md:-translate-x-1/2">
            <Dialog.Title className="font-display text-2xl text-ink">Andamento</Dialog.Title>
            <form
              className="mt-4 flex flex-col gap-3"
              onSubmit={(e) => {
                e.preventDefault();
                void registrarAndamento();
              }}
            >
              <Campo label="Status">
                <select
                  value={statusAndamento}
                  onChange={(e) => setStatusAndamento(e.target.value as StatusAdmin)}
                  className={inputCls}
                >
                  {listaCodigos("administrativo").map((status) => (
                    <option key={status} value={status}>{statusAdminLabel(status)}</option>
                  ))}
                </select>
              </Campo>
              <Campo label="O que aconteceu">
                <textarea
                  value={notaAndamento}
                  onChange={(e) => setNotaAndamento(e.target.value)}
                  className="min-h-24 w-full rounded-xl border border-line bg-paper px-3 py-2 text-sm text-ink"
                />
              </Campo>
              {TIPOS_LINK_ANDAMENTO.filter((item) => item.id in linksAndamento).map((item) => (
                <Campo key={item.id} label={item.rotulo}>
                  <input
                    type="url"
                    inputMode="url"
                    value={linksAndamento[item.id] ?? ""}
                    onChange={(e) => setLinksAndamento({ ...linksAndamento, [item.id]: e.target.value })}
                    className={inputCls}
                    placeholder="https://"
                  />
                </Campo>
              ))}
              <button
                type="button"
                onClick={() => setEscolhaLink(true)}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-line px-4 text-sm font-medium text-ink"
              >
                <Link2 className="size-4" />
                Adicionar link
              </button>
              {(() => {
                const atual = lista.find((item) => item.id === andamentoId);
                const simples = atual ? tipoSimples(atual.tipo) : false;
                const mudou = statusAndamento !== atual?.status;
                if (simples) return null;
                if (mudou && statusAndamento === "execucao") {
                  return (
                    <div className="grid gap-3 sm:grid-cols-2">
                      <Campo label="Vigência — início">
                        <input type="date" value={vigenciaInicioAnd} onChange={(e) => setVigenciaInicioAnd(e.target.value)} className={inputCls} required />
                      </Campo>
                      <Campo label="Vigência — fim">
                        <input type="date" value={vigenciaFimAnd} onChange={(e) => setVigenciaFimAnd(e.target.value)} className={inputCls} required />
                      </Campo>
                    </div>
                  );
                }
                if (mudou && statusAndamento === "encerrado") {
                  return (
                    <div className="flex flex-col gap-3">
                      <Campo label="Data de encerramento">
                        <input type="date" value={novoEncerramento} onChange={(e) => setNovoEncerramento(e.target.value)} className={inputCls} required />
                      </Campo>
                      {!atual?.possuiContrato && (
                        <div className="flex flex-col gap-3 rounded-2xl border border-line bg-paper p-3">
                          <p className="text-sm text-muted">Este processo não continua. Informe quem foi contratado e o valor da contratação ou aquisição.</p>
                          <Campo label="Contratado ou fornecedor">
                            <input value={contratadoAnd} onChange={(e) => setContratadoAnd(e.target.value)} className={inputCls} placeholder="Nome ou razão social" required />
                          </Campo>
                          <Campo label="CPF ou CNPJ">
                            <input value={documentoAnd} onChange={(e) => setDocumentoAnd(mascaraDocumento(e.target.value))} className={inputCls} inputMode="numeric" placeholder="000.000.000-00" required />
                          </Campo>
                          {atual && permiteDoisContratados(atual.tipo) && (
                            <SegundoContratado
                              nome={contratado2And}
                              documento={documento2And}
                              onChange={(nome, documento) => {
                                setContratado2And(nome);
                                setDocumento2And(documento);
                              }}
                            />
                          )}
                          <Campo label="Valor da contratação ou aquisição">
                            <input value={valorAnd} onChange={(e) => setValorAnd(mascaraReais(e.target.value))} className={inputCls} inputMode="decimal" placeholder="0,00" required />
                          </Campo>
                        </div>
                      )}
                    </div>
                  );
                }
                if (pedePrevisao(statusAndamento) && statusAndamento !== "cancelado") {
                  return (
                    <Campo label="Data do prazo">
                      <input type="date" value={novoEncerramento} onChange={(e) => setNovoEncerramento(e.target.value)} className={inputCls} required />
                    </Campo>
                  );
                }
                return null;
              })()}
              <button type="submit" className="inline-flex h-11 items-center justify-center rounded-xl bg-pine text-sm font-medium text-sheet">
                Registrar
              </button>
            </form>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      <Dialog.Root open={escolhaLink} onOpenChange={setEscolhaLink}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-30 bg-ink/50" />
          <Dialog.Content className="fixed inset-x-3 top-1/2 z-30 max-h-[90vh] -translate-y-1/2 overflow-y-auto rounded-2xl border border-line bg-sheet p-5 md:left-1/2 md:w-full md:max-w-sm md:-translate-x-1/2">
            <Dialog.Title className="font-display text-2xl text-ink">Qual link?</Dialog.Title>
            <Dialog.Description className="mt-1 text-sm text-muted">Escolha o link. O campo volta na tela de andamento.</Dialog.Description>
            <div className="mt-4 flex flex-col gap-2">
              {TIPOS_LINK_ANDAMENTO.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    const processo = lista.find((atual) => atual.id === andamentoId);
                    setLinksAndamento((previo) => ({
                      ...previo,
                      [item.id]: previo[item.id] ?? (processo ? processo[item.campo] : ""),
                    }));
                    setEscolhaLink(false);
                  }}
                  className="inline-flex h-11 items-center rounded-xl border border-line px-3 text-left text-sm font-medium text-ink"
                >
                  {item.rotulo}
                </button>
              ))}
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      <Dialog.Root open={deleteId !== null} onOpenChange={(open) => !open && setDeleteId(null)}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-10 bg-ink/40" />
          <Dialog.Content className="fixed inset-x-3 top-1/2 z-10 -translate-y-1/2 rounded-2xl border border-line bg-sheet p-5 md:left-1/2 md:w-full md:max-w-sm md:-translate-x-1/2">
            <Dialog.Title className="font-display text-2xl text-ink">Excluir processo?</Dialog.Title>
            <Dialog.Description className="mt-1 text-sm text-muted">O lançamento e o histórico saem da lista.</Dialog.Description>
            <div className="mt-4 flex gap-2">
              <Dialog.Close type="button" className="inline-flex h-11 flex-1 items-center justify-center rounded-xl border border-line text-sm font-medium">
                Cancelar
              </Dialog.Close>
              <button
                type="button"
                onClick={() => {
                  if (!deleteId) return;
                  const id = deleteId;
                  setDeleteId(null);
                  void persistir(
                    lista.filter((item) => item.id !== id),
                    null,
                    id,
                    "Processo excluído",
                  );
                }}
                className="inline-flex h-11 flex-1 items-center justify-center rounded-xl bg-seal text-sm font-medium text-sheet"
              >
                Excluir
              </button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
    </SoltarProcessoContext.Provider>
  );
}

function CardAdmin({
  processo,
  equipes,
  onMover,
  onEditar,
  onAndamento,
  onExcluir,
}: {
  processo: ProcessoAdmin;
  equipes: { id: string; nome: string }[];
  onMover: (id: string, equipeId: string | null) => void;
  onEditar: () => void;
  onAndamento: () => void;
  onExcluir: () => void;
}) {
  const [detalhes, setDetalhes] = useState(false);
  const [moverAberto, setMoverAberto] = useState(false);
  const u = urgenciaAdmin(processo);
  const tom = TOM[u];
  return (
    <li
      draggable
      onDragStart={(evento) => {
        evento.dataTransfer.setData("text/plain", processo.id);
        evento.dataTransfer.effectAllowed = "move";
      }}
      className="relative flex h-full cursor-grab flex-col overflow-hidden rounded-2xl border border-line bg-sheet active:cursor-grabbing"
    >
      <span className={`absolute inset-y-0 left-0 w-1.5 ${tom.bar}`} />
      <div className="flex flex-1 flex-col px-3 py-3 pl-4">
        <span className={`w-fit rounded-full px-2 py-0.5 text-[11px] font-medium ${tom.badge}`}>{prazoAdminLabel(processo)}</span>
        <p className="mt-2 truncate font-display text-xl leading-none tracking-tight text-ink">
          {processo.numero ? rotuloNumero(processo.numero, processo.numeroAno) : statusAdminLabel(processo.status)}
        </p>
        <p className="mt-1 truncate text-sm leading-tight text-pine">
          {processo.tipo}
          {processo.tipo !== "Outros" && processo.tipoNumero != null && processo.tipoAno != null
            ? ` · ${String(processo.tipoNumero).padStart(2, "0")}/${processo.tipoAno}`
            : ""}
        </p>
        {processo.referencia && <p className="mt-1 truncate text-sm font-medium text-ink">{processo.referencia}</p>}
        <p className="mt-1 truncate text-xs text-muted">{statusAdminLabel(processo.status)}</p>
        <div className="mt-auto flex flex-wrap gap-1.5 pt-3">
          <button type="button" onClick={onAndamento} className="inline-flex h-8 items-center rounded-lg bg-pine-soft px-2.5 text-xs font-medium text-pine">
            Andamento
          </button>
          <button type="button" onClick={() => setDetalhes(true)} className="inline-flex h-8 items-center rounded-lg border border-line px-2.5 text-xs font-medium text-ink">
            Detalhes
          </button>
          <button type="button" onClick={() => setMoverAberto((v) => !v)} className="inline-flex h-8 items-center rounded-lg border border-line px-2.5 text-xs font-medium text-ink">
            Mover
          </button>
          <button type="button" onClick={onEditar} className="inline-flex h-8 items-center gap-1 rounded-lg border border-line px-2.5 text-xs font-medium text-ink">
            <Pencil className="size-3.5" />
            Editar
          </button>
          <button type="button" onClick={onExcluir} className="inline-flex h-8 items-center gap-1 rounded-lg border border-line px-2.5 text-xs font-medium text-seal">
            <Trash2 className="size-3.5" />
            Excluir
          </button>
        </div>
        {moverAberto && (
          <div className="mt-2 flex flex-col gap-1 rounded-xl border border-line bg-paper p-2">
            <p className="px-2 text-xs text-muted">Ou arraste o card até a equipe.</p>
            {processo.equipeId && (
              <button type="button" onClick={() => { setMoverAberto(false); onMover(processo.id, null); }} className="h-9 rounded-lg px-2 text-left text-sm font-medium text-ink hover:bg-sheet">
                Só meus
              </button>
            )}
            {equipes.filter((equipe) => equipe.id !== processo.equipeId).map((equipe) => (
              <button key={equipe.id} type="button" onClick={() => { setMoverAberto(false); onMover(processo.id, equipe.id); }} className="h-9 rounded-lg px-2 text-left text-sm font-medium text-ink hover:bg-sheet">
                {equipe.nome}
              </button>
            ))}
            {!processo.equipeId && equipes.length === 0 && (
              <p className="px-2 text-sm text-muted">Crie uma equipe para mover o processo.</p>
            )}
          </div>
        )}
      </div>
      <Dialog.Root open={detalhes} onOpenChange={setDetalhes}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-20 bg-ink/40" />
          <Dialog.Content className="fixed inset-x-3 top-4 bottom-4 z-20 flex flex-col overflow-hidden rounded-2xl border border-line bg-sheet md:inset-auto md:top-1/2 md:left-1/2 md:max-h-[90vh] md:w-full md:max-w-lg md:-translate-x-1/2 md:-translate-y-1/2">
            <div className="flex items-start justify-between gap-3 border-b border-line px-5 py-4">
              <div>
                <Dialog.Title className="font-display text-2xl text-ink">
                  {processo.numero ? rotuloNumero(processo.numero, processo.numeroAno) : "Processo"}
                </Dialog.Title>
                <Dialog.Description className="mt-1 text-sm text-pine">
                  {processo.tipo}
                  {processo.tipo !== "Outros" && processo.tipoNumero != null && processo.tipoAno != null
                    ? ` · ${String(processo.tipoNumero).padStart(2, "0")}/${processo.tipoAno}`
                    : ""}
                </Dialog.Description>
              </div>
              <Dialog.Close className="grid size-10 place-items-center rounded-lg text-muted" aria-label="Fechar">
                <X className="size-4" />
              </Dialog.Close>
            </div>
            <div className="overflow-y-auto px-5 py-4">
              <dl className="grid grid-cols-2 gap-x-3 gap-y-3 text-sm">
                <Info rotulo="Número do processo" valor={processo.numero ? rotuloNumero(processo.numero, processo.numeroAno) : "—"} />
                <Info rotulo="Número do tipo" valor={processo.tipoNumero != null ? `${String(processo.tipoNumero).padStart(2, "0")}/${processo.tipoAno ?? ""}` : "—"} />
                <Info rotulo="Referência" valor={processo.referencia || "—"} />
                <Info rotulo="Status" valor={statusAdminLabel(processo.status)} />
                <Info rotulo="Objeto" valor={processo.objeto || "—"} largo justificar />
                <Info rotulo="Comunicação interna" valor={processo.ciNumero != null ? formatarPeca(processo.ciNumero, processo.ciAno) : "—"} />
                <Info rotulo="Origem da CI" valor={processo.ciOrigem || "—"} />
                <Info rotulo="Parecer" valor={processo.parecerNa ? "N/A" : processo.parecerNumero != null ? formatarPeca(processo.parecerNumero, processo.parecerAno) : "—"} />
                <Info rotulo="Início" valor={tipoSimples(processo.tipo) ? "—" : formatDate(processo.dataInicio)} />
                <Info rotulo="Prazo" valor={processo.previsaoEtapa ? formatDate(processo.previsaoEtapa) : "—"} />
                <Info rotulo="Encerramento" valor={tipoSimples(processo.tipo) ? "—" : formatDate(processo.encerramento)} />
                <Info rotulo="Aviso" valor={`${processo.alertaDias} dias antes`} />
                <Info rotulo="Contratado ou fornecedor" valor={processo.contratado || "—"} />
                <Info rotulo="CPF ou CNPJ" valor={processo.documento || "—"} />
                {processo.contratado2 ? (
                  <>
                    <Info rotulo="Segundo contratado ou fornecedor" valor={processo.contratado2} />
                    <Info rotulo="CPF ou CNPJ" valor={processo.documento2 || "—"} />
                  </>
                ) : null}
                <Info rotulo="Vigência" valor={processo.vigenciaInicio ? `${formatDate(processo.vigenciaInicio)} a ${processo.vigenciaFim ? formatDate(processo.vigenciaFim) : "—"}` : "—"} largo />
                <Info rotulo="Valor estimado" valor={formatarReais(processo.valorEstimadoCentavos)} />
                {processo.possuiContrato ? (
                  <>
                    <Info rotulo="Valor anual" valor={formatarReais(processo.valorTotalCentavos)} />
                    <Info rotulo="Valor mensal" valor={formatarReais(processo.valorMensalCentavos)} />
                  </>
                ) : (
                  <Info rotulo="Valor da contratação" valor={formatarReais(processo.valorTotalCentavos)} />
                )}
                <Info rotulo="Lançado por" valor={processo.autorNome || "sem nome"} />
                <Info rotulo="Equipe" valor={equipes.find((equipe) => equipe.id === processo.equipeId)?.nome ?? "Só meus"} />
              </dl>
              <div className="mt-4 flex flex-col gap-2">
                {processo.linkAberturaNa ? (
                  <p className="inline-flex h-11 items-center rounded-xl border border-line bg-paper px-3 text-sm font-medium text-ink">Publicação: N/A</p>
                ) : processo.linkAbertura ? (
                  <BotaoLink href={processo.linkAbertura} texto="Publicação">
                    <Megaphone className="size-4" />
                  </BotaoLink>
                ) : null}
                {processo.linkRetificacao && (
                  <BotaoLink href={processo.linkRetificacao} texto="Retificação">
                    <FilePen className="size-4" />
                  </BotaoLink>
                )}
                {processo.linkCancelamentoNa ? (
                  <p className="inline-flex h-11 items-center rounded-xl border border-line bg-paper px-3 text-sm font-medium text-ink">Cancelamento: N/A</p>
                ) : processo.linkCancelamento ? (
                  <BotaoLink href={processo.linkCancelamento} texto="Cancelamento">
                    <Ban className="size-4" />
                  </BotaoLink>
                ) : null}
                {processo.linkHomologacaoNa ? (
                  <p className="inline-flex h-11 items-center rounded-xl border border-line bg-paper px-3 text-sm font-medium text-ink">Homologação: N/A</p>
                ) : processo.linkHomologacao ? (
                  <BotaoLink href={processo.linkHomologacao} texto="Homologação">
                    <BadgeCheck className="size-4" />
                  </BotaoLink>
                ) : null}
                {processo.linkPncpNa ? (
                  <p className="inline-flex h-11 items-center rounded-xl border border-line bg-paper px-3 text-sm font-medium text-ink">PNCP: N/A</p>
                ) : processo.linkPncp ? (
                  <BotaoLink href={processo.linkPncp} texto="PNCP">
                    <BandeiraBrasil />
                  </BotaoLink>
                ) : null}
              </div>
              <h3 className="mt-5 font-display text-xl text-ink">Histórico</h3>
              {processo.historico.length === 0 ? (
                <p className="mt-2 text-sm text-muted">Nenhum lançamento.</p>
              ) : (
                <ol className="mt-2 flex flex-col gap-2">
                  {[...processo.historico].reverse().map((item) => (
                    <li key={item.id} className="text-sm">
                      <span className="text-xs text-muted">
                        {new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(item.em))}
                        {" · "}
                        {item.autorNome || "sem nome"}
                      </span>
                      <span className="mt-0.5 block text-ink">{item.texto}</span>
                      {item.link && (
                        <a
                          href={item.link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mt-1 inline-flex items-center gap-1 text-pine"
                        >
                          <Link2 className="size-3.5" />
                          Link
                        </a>
                      )}
                    </li>
                  ))}
                </ol>
              )}
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </li>
  );
}

function ControlePecas({
  titulo,
  nota,
  linhas,
  onAnotar,
}: {
  titulo: string;
  nota: string;
  linhas: LinhaControle[];
  onAnotar?: (linha: LinhaControle, dados: { destino: string; desativada: boolean }) => void;
}) {
  const anos = [...new Set(linhas.map((linha) => linha.ano))].sort((a, b) => b - a);
  const [anoEscolhido, setAnoEscolhido] = useState<number | null>(null);
  const ano = anoEscolhido != null && anos.includes(anoEscolhido) ? anoEscolhido : anos[0];
  const visiveis = linhas.filter((linha) => linha.ano === ano);
  return (
    <div className="rounded-2xl border border-line bg-sheet p-4">
      <h2 className="font-display text-2xl text-ink">{titulo}</h2>
      <p className="mt-1 text-sm text-muted">{nota}</p>
      {anos.length > 1 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {anos.map((opcao) => (
            <button
              key={opcao}
              type="button"
              onClick={() => setAnoEscolhido(opcao)}
              className={
                "inline-flex h-9 items-center rounded-full px-3 text-sm font-medium " +
                (opcao === ano ? "bg-ink text-sheet" : "border border-line bg-paper text-ink")
              }
            >
              {opcao}
            </button>
          ))}
        </div>
      )}
      {visiveis.length === 0 ? (
        <p className="mt-4 text-sm text-muted">Nada lançado ainda.</p>
      ) : (
        <>
          <ul className="mt-4 flex flex-col gap-2 md:hidden">
            {visiveis.map((linha) => (
              <li key={`${linha.ano}-${linha.numero}`} className="rounded-xl border border-line bg-paper p-3 text-sm">
                <div className="flex items-start justify-between gap-2">
                  <NumeroControle linha={linha} />
                  {onAnotar && <MenuComunicacao linha={linha} onAnotar={onAnotar} />}
                </div>
                <p className="mt-1 text-ink">
                  {linha.falta && linha.destino ? (
                    <>
                      <span className="font-medium">{linha.destino}</span>
                      <span className="mt-0.5 block text-xs text-muted">Não lançada em processo administrativo</span>
                    </>
                  ) : linha.falta ? (
                    "Não lançada"
                  ) : (
                    linha.referencia || "Sem referência"
                  )}
                </p>
                {linha.destino && !linha.falta ? <p className="mt-1 text-muted">Para: {linha.destino}</p> : null}
                {!linha.falta && <p className="mt-1 text-muted">Processo {linha.processo}</p>}
              </li>
            ))}
          </ul>
          <div className="mt-4 hidden md:block">
            <table className="w-full border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-line text-muted">
                  <th className="py-2 pr-3 font-medium">Número</th>
                  <th className="py-2 pr-3 font-medium">Referência</th>
                  <th className="py-2 pr-3 font-medium">Processo</th>
                  {onAnotar ? <th className="w-12 py-2 font-medium"><span className="sr-only">Ações</span></th> : null}
                </tr>
              </thead>
              <tbody>
                {visiveis.map((linha) => (
                  <tr key={`${linha.ano}-${linha.numero}`} className="border-b border-line">
                    <td className="py-2 pr-3 font-medium text-ink">
                      <NumeroControle linha={linha} />
                    </td>
                    <td className="py-2 pr-3 text-ink">
                      {linha.falta && linha.destino ? (
                        <>
                          <span className="font-medium">{linha.destino}</span>
                          <span className="mt-0.5 block text-xs font-normal text-muted">Não lançada em processo administrativo</span>
                        </>
                      ) : (
                        <>
                          {linha.falta ? "Não lançada" : linha.referencia || "Sem referência"}
                          {linha.destino ? <span className="block text-xs text-muted">Para: {linha.destino}</span> : null}
                        </>
                      )}
                    </td>
                    <td className="py-2 pr-3 text-ink">{linha.falta ? "—" : linha.processo}</td>
                    {onAnotar ? (
                      <td className="py-2 text-right">
                        <MenuComunicacao linha={linha} onAnotar={onAnotar} />
                      </td>
                    ) : null}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

function NumeroControle({ linha }: { linha: LinhaControle }) {
  return (
    <span className="inline-flex items-center gap-2">
      {linha.desativada ? (
        <Ban className="size-4 shrink-0 text-seal" aria-label="Desativada" />
      ) : linha.falta && !linha.destino ? (
        <TriangleAlert className="size-4 shrink-0 text-brass" aria-label="Não lançada" />
      ) : null}
      {formatarPeca(linha.numero, linha.ano)}
    </span>
  );
}

function MenuComunicacao({
  linha,
  onAnotar,
}: {
  linha: LinhaControle;
  onAnotar: (linha: LinhaControle, dados: { destino: string; desativada: boolean }) => void;
}) {
  const [aberto, setAberto] = useState(false);
  const [destino, setDestino] = useState(linha.destino);
  useEffect(() => setDestino(linha.destino), [linha.destino]);
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setAberto((valor) => !valor)}
        className="grid size-9 place-items-center rounded-lg text-muted"
        aria-label={`Ações da comunicação ${formatarPeca(linha.numero, linha.ano)}`}
        aria-expanded={aberto}
      >
        <MoreVertical className="size-4" />
      </button>
      {aberto && (
        <div className="absolute right-0 z-20 mt-1 w-64 rounded-xl border border-line bg-sheet p-3 shadow-lg">
          <label className="block text-xs font-medium text-ink">
            Para onde foi
            <input
              value={destino}
              onChange={(evento) => setDestino(evento.target.value)}
              className={`${inputCls} mt-1`}
              placeholder="Destino"
              autoComplete="off"
            />
          </label>
          <button
            type="button"
            onClick={() => {
              onAnotar(linha, { destino, desativada: linha.desativada });
              setAberto(false);
            }}
            className="mt-2 inline-flex h-9 w-full items-center justify-center rounded-lg bg-pine text-sm font-medium text-sheet"
          >
            Salvar
          </button>
          <button
            type="button"
            onClick={() => {
              onAnotar(linha, { destino, desativada: !linha.desativada });
              setAberto(false);
            }}
            className="mt-2 inline-flex h-9 w-full items-center justify-center rounded-lg border border-line text-sm font-medium text-ink"
          >
            {linha.desativada ? "Reativar" : "Desativar"}
          </button>
        </div>
      )}
    </div>
  );
}

function ControleSetores({
  grupos,
}: {
  grupos: { origem: string; itens: { numero: number; ano: number; referencia: string; processo: string }[] }[];
}) {
  const anos = [...new Set(grupos.flatMap((grupo) => grupo.itens.map((item) => item.ano)))].sort((a, b) => b - a);
  const [anoEscolhido, setAnoEscolhido] = useState<number | null>(null);
  const ano = anoEscolhido != null && anos.includes(anoEscolhido) ? anoEscolhido : anos[0];
  const visiveis = grupos
    .map((grupo) => ({ origem: grupo.origem, itens: grupo.itens.filter((item) => item.ano === ano) }))
    .filter((grupo) => grupo.itens.length > 0);
  return (
    <div className="rounded-2xl border border-line bg-sheet p-4">
      <h2 className="font-display text-2xl text-ink">Comunicações Internas - Setores</h2>
      <p className="mt-1 text-sm text-muted">As comunicações que não são da Gerência Administrativa, juntas por setor.</p>
      {anos.length > 1 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {anos.map((opcao) => (
            <button
              key={opcao}
              type="button"
              onClick={() => setAnoEscolhido(opcao)}
              className={
                "inline-flex h-9 items-center rounded-full px-3 text-sm font-medium " +
                (opcao === ano ? "bg-ink text-sheet" : "border border-line bg-paper text-ink")
              }
            >
              {opcao}
            </button>
          ))}
        </div>
      )}
      {visiveis.length === 0 ? (
        <p className="mt-4 text-sm text-muted">Nenhuma comunicação de outros setores.</p>
      ) : (
        <div className="mt-4">
          <ul className="flex flex-col gap-4 md:hidden">
            {visiveis.map((grupo) => (
              <li key={grupo.origem}>
                <p className="text-sm font-medium text-ink">{grupo.origem}</p>
                <ul className="mt-2 flex flex-col gap-2">
                  {grupo.itens.map((item) => (
                    <li key={`${grupo.origem}-${item.ano}-${item.numero}-${item.processo}`} className="rounded-xl border border-line bg-paper p-3 text-sm">
                      <p className="font-medium text-ink">{formatarPeca(item.numero, item.ano)}</p>
                      <p className="mt-1 text-ink">{item.referencia || "Sem referência"}</p>
                      <p className="mt-1 text-muted">Processo {item.processo}</p>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full table-fixed border-collapse text-left text-sm">
              <colgroup>
                <col className="w-[7.5rem]" />
                <col />
                <col className="w-[8.5rem]" />
              </colgroup>
              <thead>
                <tr className="border-b border-line text-muted">
                  <th className="py-2 pr-3 font-medium">Número</th>
                  <th className="py-2 pr-3 font-medium">Referência</th>
                  <th className="py-2 font-medium">Processo</th>
                </tr>
              </thead>
              {visiveis.map((grupo) => (
                <tbody key={grupo.origem}>
                  <tr>
                    <td colSpan={3} className="pt-4 pb-1 font-medium text-ink">
                      {grupo.origem}
                    </td>
                  </tr>
                  {grupo.itens.map((item) => (
                    <tr key={`${grupo.origem}-${item.ano}-${item.numero}-${item.processo}`} className="border-b border-line">
                      <td className="py-2 pr-3 font-medium text-ink">{formatarPeca(item.numero, item.ano)}</td>
                      <td className="py-2 pr-3 text-ink">{item.referencia || "Sem referência"}</td>
                      <td className="py-2 text-ink">{item.processo}</td>
                    </tr>
                  ))}
                </tbody>
              ))}
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function RelatorioPecas({
  ano,
  onAno,
  relatorio,
  onGerar,
}: {
  ano: string;
  onAno: (ano: string) => void;
  relatorio: { rotulo: string; itens: ProcessoAdmin[] } | null;
  onGerar: () => void;
}) {
  return (
    <>
      <div className="no-print rounded-2xl border border-line bg-sheet p-4">
        <h2 className="font-display text-2xl text-ink">Comunicações e pareceres</h2>
        <p className="mt-1 text-sm text-muted">
          Lista à parte, com o número de cada peça e a referência do processo administrativo.
        </p>
        <div className="mt-4 max-w-xs">
          <Campo label="Ano da peça">
            <select value={ano} onChange={(e) => onAno(e.target.value)} className={inputCls}>
              <option value="todos">Todos os anos</option>
              {anosDePeca().map((opcao) => (
                <option key={opcao} value={opcao}>
                  {opcao}
                </option>
              ))}
            </select>
          </Campo>
        </div>
        <button
          type="button"
          onClick={onGerar}
          className="mt-4 inline-flex h-11 items-center gap-2 rounded-xl bg-pine px-4 text-sm font-medium text-sheet"
        >
          <FileText className="size-4" />
          Gerar relatório
        </button>
      </div>
      {relatorio && (
        <article className="relatorio-folha rounded-2xl border border-line bg-sheet p-4 md:p-6">
                <Timbrado />
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-pine">Processos administrativos</p>
              <h2 className="font-display text-2xl text-ink sm:text-3xl">Comunicações internas e pareceres</h2>
              <p className="mt-1 text-sm text-muted">
                {relatorio.rotulo} · {relatorio.itens.length}{" "}
                {relatorio.itens.length === 1 ? "processo" : "processos"}
              </p>
            </div>
            <BotaoRelatorio />
          </div>
          {relatorio.itens.length === 0 ? (
            <p className="mt-4 text-sm text-muted">Nenhuma comunicação interna ou parecer neste recorte.</p>
          ) : (
            <>
            <ul className="relatorio-cards mt-4 flex flex-col gap-3 md:hidden">
              {relatorio.itens.map((item) => (
                <li key={item.id} className="rounded-xl border border-line bg-paper p-3 text-sm">
                  <p className="font-medium text-ink">{rotuloNumero(item.numero, item.numeroAno)}</p>
                  <p className="mt-1 text-ink">{item.referencia || "Sem referência"}</p>
                  <p className="mt-2 text-muted">Comunicação interna</p>
                  <p className="text-ink">{formatarPeca(item.ciNumero, item.ciAno)}</p>
                  <p className="mt-2 text-muted">Origem</p>
                  <p className="break-words text-ink">{item.ciOrigem || "—"}</p>
                  <p className="mt-2 text-muted">Parecer</p>
                  <p className="text-ink">{item.parecerNa ? "N/A" : formatarPeca(item.parecerNumero, item.parecerAno)}</p>
                </li>
              ))}
            </ul>
            <div className="relatorio-tabela-wrap mt-4 hidden md:block">
              <table className="relatorio-tabela w-full border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-line text-xs text-muted">
                    <th className="py-2 pr-3 font-medium">Processo</th>
                    <th className="py-2 pr-3 font-medium">Referência</th>
                    <th className="py-2 pr-3 font-medium">Comunicação interna</th>
                    <th className="py-2 pr-3 font-medium">Origem</th>
                    <th className="py-2 font-medium">Parecer</th>
                  </tr>
                </thead>
                <tbody>
                  {relatorio.itens.map((item) => (
                    <tr key={item.id} className="border-b border-line align-top">
                      <td className="py-2 pr-3 font-medium text-ink">{rotuloNumero(item.numero, item.numeroAno)}</td>
                      <td className="py-2 pr-3 text-ink">{item.referencia || "—"}</td>
                      <td className="py-2 pr-3 text-ink">{formatarPeca(item.ciNumero, item.ciAno)}</td>
                      <td className="py-2 pr-3 text-ink">{item.ciOrigem || "—"}</td>
                      <td className="py-2 text-ink">{item.parecerNa ? "N/A" : formatarPeca(item.parecerNumero, item.parecerAno)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            </>
          )}
          <TimbradoRodape />
        </article>
      )}
    </>
  );
}

function compararNumeroProcesso(a: ProcessoAdmin, b: ProcessoAdmin) {
  const ano = (a.numeroAno ?? 0) - (b.numeroAno ?? 0);
  if (ano !== 0) return ano;
  return a.numero.localeCompare(b.numero, "pt-BR", { numeric: true });
}

const LINKS_LANCAMENTO = [
  { id: "publicacao", falta: "Publicação", rotulo: "Link de publicação" },
  { id: "homologacao", falta: "Homologação", rotulo: "Link de homologação" },
  { id: "pncp", falta: "PNCP", rotulo: "Link do PNCP" },
  { id: "cancelamento", falta: "Cancelamento", rotulo: "Link de cancelamento" },
] as const;

type LinkLancamento = (typeof LINKS_LANCAMENTO)[number]["id"];

function aplicarLink(processo: ProcessoAdmin, id: LinkLancamento, url: string, na: boolean, autorNome: string): ProcessoAdmin {
  const atualizado: ProcessoAdmin = { ...processo };
  const opcao = LINKS_LANCAMENTO.find((item) => item.id === id);
  if (id === "publicacao") {
    atualizado.linkAbertura = na ? "" : url;
    atualizado.linkAberturaNa = na;
  } else if (id === "homologacao") {
    atualizado.linkHomologacao = na ? "" : url;
    atualizado.linkHomologacaoNa = na;
  } else if (id === "pncp") {
    atualizado.linkPncp = na ? "" : url;
    atualizado.linkPncpNa = na;
  } else {
    atualizado.linkCancelamento = na ? "" : url;
    atualizado.linkCancelamentoNa = na;
  }
  const texto = na ? `Marcou ${opcao?.falta.toLowerCase() ?? "o link"} como N/A.` : `Adicionou o link de ${opcao?.falta.toLowerCase() ?? "processo"}.`;
  atualizado.historico = [...processo.historico, evento(texto, autorNome, na ? undefined : url)];
  return atualizado;
}

function LinksFaltando({
  processos,
  autorNome,
  onSalvar,
}: {
  processos: ProcessoAdmin[];
  autorNome: string;
  onSalvar: (processo: ProcessoAdmin) => void;
}) {
  const [alvo, setAlvo] = useState<ProcessoAdmin | null>(null);
  const [escolhido, setEscolhido] = useState<LinkLancamento | null>(null);
  const [url, setUrl] = useState("");
  const [erroLink, setErroLink] = useState("");
  const linhas = processos
    .map((processo) => ({ processo, falta: linksEmFalta(processo) }))
    .filter((item) => item.falta.length > 0)
    .sort((a, b) => compararNumeroProcesso(a.processo, b.processo));
  const opcoes = alvo ? LINKS_LANCAMENTO.filter((item) => linksEmFalta(alvo).includes(item.falta)) : [];
  const opcao = opcoes.find((item) => item.id === escolhido) ?? null;

  function fechar() {
    setAlvo(null);
    setEscolhido(null);
    setUrl("");
    setErroLink("");
  }

  function gravar(atualizado: ProcessoAdmin) {
    onSalvar(atualizado);
    if (linksEmFalta(atualizado).length === 0) fechar();
    else {
      setAlvo(atualizado);
      setEscolhido(null);
      setUrl("");
      setErroLink("");
    }
  }

  return (
    <div>
      <h2 className="font-display text-2xl text-ink">Links</h2>
      <p className="mt-1 text-sm text-muted">
        Processos com link em branco, do menor número para o maior. Quando todos os links estão lançados, o processo sai da lista. Pronto pagamento, doações e outros não entram.
      </p>
      {linhas.length === 0 ? (
        <p className="mt-4 text-sm text-muted">Nenhum link faltando.</p>
      ) : (
        <div className="mt-4">
          <table className="w-full border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-line text-muted">
                <th className="py-2 pr-3 font-medium">Processo</th>
                <th className="py-2 pr-3 font-medium">Tipo</th>
                <th className="py-2 pr-3 font-medium">Número do tipo</th>
                <th className="py-2 pr-3 font-medium">Faltando</th>
                <th className="w-12 py-2 font-medium"><span className="sr-only">Ações</span></th>
              </tr>
            </thead>
            <tbody>
              {linhas.map((item, indice) => (
                <tr key={item.processo.id} className={"border-b border-line " + (indice % 2 === 0 ? "bg-pine/5" : "")}>
                  <td className="py-2 pr-3 font-medium text-ink">{rotuloNumero(item.processo.numero, item.processo.numeroAno)}</td>
                  <td className="py-2 pr-3 text-ink">{item.processo.tipo}</td>
                  <td className="py-2 pr-3 text-ink">
                    {item.processo.tipoNumero != null ? `${String(item.processo.tipoNumero).padStart(2, "0")}/${item.processo.tipoAno ?? ""}` : "—"}
                  </td>
                  <td className="py-2 pr-3 text-ink">{item.falta.join(", ")}</td>
                  <td className="py-2 text-right">
                    <MenuLancamento
                      processo={item.processo}
                      onLancar={() => {
                        setAlvo(item.processo);
                        setEscolhido(null);
                        setUrl("");
                        setErroLink("");
                      }}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Dialog.Root open={alvo !== null} onOpenChange={(aberto) => !aberto && fechar()}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-30 bg-ink/50" />
          <Dialog.Content className="fixed inset-x-3 top-1/2 z-30 max-h-[90vh] -translate-y-1/2 overflow-y-auto rounded-2xl border border-line bg-sheet p-5 md:left-1/2 md:w-full md:max-w-sm md:-translate-x-1/2">
            <Dialog.Title className="font-display text-2xl text-ink">Qual link?</Dialog.Title>
            <Dialog.Description className="mt-1 text-sm text-muted">
              {alvo ? `${rotuloNumero(alvo.numero, alvo.numeroAno)} · ${alvo.tipo}` : "Escolha o link."}
            </Dialog.Description>
            {!opcao ? (
              <div className="mt-4 flex flex-col gap-2">
                {opcoes.map((item) => (
                  <div key={item.id} className="flex h-11 items-center rounded-xl border border-line">
                    <button
                      type="button"
                      onClick={() => {
                        setEscolhido(item.id);
                        setUrl("");
                        setErroLink("");
                      }}
                      className="min-w-0 flex-1 px-3 text-left text-sm font-medium text-ink"
                    >
                      {item.rotulo}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (!alvo) return;
                        gravar(aplicarLink(alvo, item.id, "", true, autorNome));
                      }}
                      className="mr-1 inline-flex h-8 items-center rounded-lg bg-paper px-2.5 text-xs font-medium text-ink"
                    >
                      N/A
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <form
                className="mt-4 flex flex-col gap-3"
                onSubmit={(eventoForm) => {
                  eventoForm.preventDefault();
                  if (!alvo) return;
                  const endereco = normalizarLink(url) || "";
                  if (!endereco) {
                    setErroLink(url.trim() ? "O link está inválido." : "Informe o link.");
                    return;
                  }
                  gravar(aplicarLink(alvo, opcao.id, endereco, false, autorNome));
                }}
              >
                <input
                  type="url"
                  inputMode="url"
                  value={url}
                  onChange={(evento) => setUrl(evento.target.value)}
                  className={inputCls}
                  placeholder="https://"
                  autoComplete="off"
                  required
                />
                {erroLink ? <p className="text-sm text-seal">{erroLink}</p> : null}
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setEscolhido(null);
                      setUrl("");
                      setErroLink("");
                    }}
                    className="inline-flex h-11 flex-1 items-center justify-center rounded-xl border border-line text-sm font-medium text-ink"
                  >
                    Voltar
                  </button>
                  <button type="submit" className="inline-flex h-11 flex-1 items-center justify-center rounded-xl bg-pine text-sm font-medium text-sheet">
                    Salvar
                  </button>
                </div>
              </form>
            )}
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}

function MenuLancamento({ processo, onLancar }: { processo: ProcessoAdmin; onLancar: () => void }) {
  const [aberto, setAberto] = useState(false);
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setAberto((valor) => !valor)}
        className="grid size-9 place-items-center rounded-lg text-muted"
        aria-label={`Ações do processo ${rotuloNumero(processo.numero, processo.numeroAno)}`}
        aria-expanded={aberto}
      >
        <MoreVertical className="size-4" />
      </button>
      {aberto && (
        <div className="absolute right-0 z-20 mt-1 w-44 rounded-xl border border-line bg-sheet p-1 shadow-lg">
          <button
            type="button"
            onClick={() => {
              setAberto(false);
              onLancar();
            }}
            className="flex h-9 w-full items-center rounded-lg px-3 text-left text-sm font-medium text-ink hover:bg-paper"
          >
            Lançamento
          </button>
        </div>
      )}
    </div>
  );
}

function CamposLinks({ form, onChange }: { form: FormAdmin; onChange: (form: FormAdmin) => void }) {
  const obrigatorio = exigeLinks(form.tipo);
  const podeNa = permitePublicacaoNa(form.tipo);
  const na = podeNa && form.linkAberturaNa;
  return (
    <>
      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between gap-3">
          <span className="text-sm font-medium text-ink">Link de publicação</span>
          {podeNa && (
            <label className="flex items-center gap-2 text-sm font-medium text-ink">
              <input
                type="checkbox"
                checked={form.linkAberturaNa}
                onChange={(evento) => onChange({ ...form, linkAberturaNa: evento.target.checked, linkAbertura: evento.target.checked ? "" : form.linkAbertura })}
              />
              N/A
            </label>
          )}
        </div>
        {na ? (
          <p className="text-xs text-muted">Fica como N/A.</p>
        ) : (
          <input
            type="url"
            inputMode="url"
            value={form.linkAbertura}
            onChange={(e) => onChange({ ...form, linkAbertura: e.target.value, linkAberturaNa: false })}
            className={inputCls}
            placeholder="https://"
            required={obrigatorio}
          />
        )}
      </div>
      <Campo label="Houve retificação?">
        <select
          value={form.houveRetificacao ? "sim" : "nao"}
          onChange={(e) => {
            const sim = e.target.value === "sim";
            onChange({ ...form, houveRetificacao: sim, linkRetificacao: sim ? form.linkRetificacao : "" });
          }}
          className={inputCls}
        >
          <option value="nao">Não</option>
          <option value="sim">Sim</option>
        </select>
      </Campo>
      {form.houveRetificacao && (
        <Campo label="Link da retificação">
          <input
            type="url"
            inputMode="url"
            value={form.linkRetificacao}
            onChange={(e) => onChange({ ...form, linkRetificacao: e.target.value })}
            className={inputCls}
            placeholder="https://"
            required
          />
        </Campo>
      )}
      <Campo label="Link de homologação">
        <input
          type="url"
          inputMode="url"
          value={form.linkHomologacao}
          onChange={(e) => onChange({ ...form, linkHomologacao: e.target.value, linkHomologacaoNa: false })}
          className={inputCls}
          placeholder="https://"
        />
      </Campo>
      <Campo label="Link do PNCP">
        <input
          type="url"
          inputMode="url"
          value={form.linkPncp}
          onChange={(e) => onChange({ ...form, linkPncp: e.target.value, linkPncpNa: false })}
          className={inputCls}
          placeholder="https://"
        />
      </Campo>
      {form.status === "cancelado" && (
        <Campo label="Link de cancelamento">
          <input
            type="url"
            inputMode="url"
            value={form.linkCancelamento}
            onChange={(e) => onChange({ ...form, linkCancelamento: e.target.value, linkCancelamentoNa: false })}
            className={inputCls}
            placeholder="https://"
            required
          />
        </Campo>
      )}
    </>
  );
}

function BotaoLink({ href, texto, children }: { href: string; texto: string; children: ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex h-11 items-center gap-2 rounded-xl border border-line bg-paper px-3 text-sm font-medium text-ink"
    >
      {children}
      {texto}
    </a>
  );
}

function BandeiraBrasil() {
  return (
    <svg viewBox="0 0 20 14" className="h-3.5 w-5 shrink-0 rounded-[2px]" aria-hidden>
      <rect width="20" height="14" fill="#009b3a" />
      <polygon points="10,1.2 18.6,7 10,12.8 1.4,7" fill="#fedf00" />
      <circle cx="10" cy="7" r="2.7" fill="#002776" />
    </svg>
  );
}

function SegundoContratado({ nome, documento, onChange }: { nome: string; documento: string; onChange: (nome: string, documento: string) => void }) {
  return (
    <>
      <Campo label="Segundo contratado ou fornecedor">
        <input
          value={nome}
          onChange={(e) => onChange(e.target.value, documento)}
          className={inputCls}
          placeholder="Opcional"
          autoComplete="off"
        />
      </Campo>
      <Campo label="CPF ou CNPJ do segundo">
        <input
          value={documento}
          onChange={(e) => onChange(nome, mascaraDocumento(e.target.value))}
          className={inputCls}
          inputMode="numeric"
          placeholder="Opcional"
          autoComplete="off"
        />
      </Campo>
    </>
  );
}

function CartaoProcesso({ item }: { item: ProcessoAdmin }) {
  const marco = marcoAdmin(item);
  return (
    <li className="rounded-xl border border-line bg-paper p-3 text-sm">
      <div className="flex items-start justify-between gap-3">
        <p className="font-medium text-ink">{rotuloNumero(item.numero, item.numeroAno)}</p>
        <p className="shrink-0 text-right text-ink">
          {item.valorTotalCentavos != null ? formatarReais(item.valorTotalCentavos) : item.valorEstimadoCentavos != null ? `${formatarReais(item.valorEstimadoCentavos)} estimado` : "—"}
        </p>
      </div>
      <p className="mt-1 break-words text-pine">{rotuloTipo(item.tipo, item.tipoNumero, item.tipoAno)}</p>
      <p className="mt-1 break-words text-ink">{item.referencia || "Sem referência"}</p>
      <p className="mt-1 text-muted">
        {statusAdminLabel(item.status)}
        {marco.data ? ` · ${formatDate(marco.data)}` : ""}
      </p>
      <p className="mt-1 break-words text-ink">
        {item.possuiContrato ? item.contratado || "Contrato" : item.contratado || "Sem contrato"}
        {item.contratado2 ? ` · ${item.contratado2}` : ""}
        {item.valorMensalCentavos != null ? ` · ${formatarReais(item.valorMensalCentavos)} / mês` : ""}
      </p>
    </li>
  );
}

function PecaCampos({
  titulo,
  numero,
  ano,
  onNumero,
  onAno,
  rotulo,
  obrigatorio = true,
  na = false,
  onNa,
}: {
  titulo: string;
  numero: string;
  ano: number;
  onNumero: (valor: string) => void;
  onAno: (ano: number) => void;
  rotulo?: (numero: number, ano: number) => string;
  obrigatorio?: boolean;
  na?: boolean;
  onNa?: (valor: boolean) => void;
}) {
  const pronto = numeroPeca(numero);
  const previa = na ? "N/A" : pronto == null ? "número/ano" : rotulo ? rotulo(pronto, ano) : `${pronto}/${ano}`;
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-line bg-paper p-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium text-ink">{titulo}</p>
        {onNa && (
          <label className="flex items-center gap-2 text-sm font-medium text-ink">
            <input type="checkbox" checked={na} onChange={(evento) => onNa(evento.target.checked)} />
            N/A
          </label>
        )}
      </div>
      {!na && (
        <div className="grid gap-3 sm:grid-cols-[1fr_9rem]">
          <Campo label="Número">
            <input
              value={numero}
              onChange={(e) => onNumero(e.target.value.replace(/\D/g, "").slice(0, 6))}
              className={inputCls}
              inputMode="numeric"
              placeholder="Ex.: 12"
              required={obrigatorio}
            />
          </Campo>
          <Campo label="Ano">
            <select value={ano} onChange={(e) => onAno(Number(e.target.value))} className={inputCls}>
              {anosDePeca().map((opcao) => (
                <option key={opcao} value={opcao}>
                  {opcao}
                </option>
              ))}
            </select>
          </Campo>
        </div>
      )}
      <p className="text-xs text-muted">Fica como {previa}.</p>
    </div>
  );
}

function mascaraCnpj(texto: string) {
  const d = texto.replace(/\D/g, "").slice(0, 14);
  if (d.length <= 2) return d;
  if (d.length <= 5) return `${d.slice(0, 2)}.${d.slice(2)}`;
  if (d.length <= 8) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5)}`;
  if (d.length <= 12) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8)}`;
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
}

function ConsultaCnpj() {
  const [numero, setNumero] = useState("");
  const [consulta, setConsulta] = useState<ConsultaCnpj | null>(null);
  const [erro, setErro] = useState("");
  const [ocupado, setOcupado] = useState(false);

  async function consultar() {
    const digitos = numero.replace(/\D/g, "");
    if (digitos.length !== 14) {
      setErro("Informe o CNPJ completo.");
      setConsulta(null);
      return;
    }
    setOcupado(true);
    setErro("");
    try {
      const resultado = await consultarCnpj({ data: digitos });
      setConsulta(resultado);
    } catch (err) {
      setConsulta(null);
      setErro(mensagemErro(err));
    } finally {
      setOcupado(false);
    }
  }

  const campos = consulta
    ? [
        ["Razão social", consulta.razaoSocial],
        ["Nome fantasia", consulta.nomeFantasia],
        ["Situação", consulta.situacao],
        ["Abertura", consulta.abertura],
        ["Natureza jurídica", consulta.natureza],
        ["Porte", consulta.porte],
        ["Capital social", consulta.capital],
        ["CNAE", consulta.cnae],
        ["Endereço", consulta.endereco],
        ["CEP", consulta.cep],
        ["Telefone", consulta.telefone],
        ["E-mail", consulta.email],
      ].filter(([, valor]) => valor)
    : [];

  return (
    <div>
      <h2 className="font-display text-2xl text-ink">Consulta CNPJ</h2>
      <p className="mt-1 text-sm text-muted">Consulta a situação cadastral na Receita Federal sem sair do Auxilia Legis.</p>
      <form
        className="mt-4 flex flex-col gap-2 sm:flex-row"
        onSubmit={(evento) => {
          evento.preventDefault();
          void consultar();
        }}
      >
        <input
          value={numero}
          onChange={(evento) => setNumero(mascaraCnpj(evento.target.value))}
          inputMode="numeric"
          autoComplete="off"
          placeholder="00.000.000/0000-00"
          className={inputCls + " sm:max-w-xs"}
        />
        <button
          type="submit"
          disabled={ocupado}
          className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-pine px-4 text-sm font-medium text-sheet disabled:opacity-60"
        >
          <Search className="size-4" />
          {ocupado ? "Consultando…" : "Consultar"}
        </button>
      </form>
      {erro ? <p className="mt-3 text-sm text-seal">{erro}</p> : null}
      {consulta ? (
        <div className="mt-4 rounded-2xl border border-line bg-sheet p-4">
          <p className="text-xs text-muted">{consulta.cnpj}</p>
          <dl className="mt-3 grid gap-3 sm:grid-cols-2">
            {campos.map(([rotulo, valor]) => (
              <div key={rotulo} className={rotulo === "Endereço" || rotulo === "Razão social" || rotulo === "CNAE" ? "sm:col-span-2" : undefined}>
                <dt className="text-xs text-muted">{rotulo}</dt>
                <dd className="text-sm text-ink">{valor}</dd>
              </div>
            ))}
          </dl>
          {consulta.socios.length > 0 && (
            <div className="mt-4">
              <h3 className="text-sm font-medium text-ink">Quadro societário</h3>
              <ul className="mt-2 flex flex-col gap-2">
                {consulta.socios.map((socio) => (
                  <li key={socio.nome + socio.qualificacao} className="text-sm text-ink">
                    {socio.nome}
                    {socio.qualificacao ? <span className="text-muted"> · {socio.qualificacao}</span> : null}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}

function Info({ rotulo, valor, largo, justificar }: { rotulo: string; valor: string; largo?: boolean; justificar?: boolean }) {
  return (
    <div className={largo ? "col-span-2" : undefined}>
      <dt className="text-xs text-muted">{rotulo}</dt>
      <dd className={justificar ? "text-justify text-ink" : "text-ink"}>{valor}</dd>
    </div>
  );
}

function Campo({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex min-w-0 max-w-full flex-col gap-1 text-sm font-medium text-ink">
      {label}
      {children}
    </label>
  );
}

function Resumo({ valor, rotulo, tom }: { valor: number; rotulo: string; tom: "seal" | "brass" | "pine" }) {
  const cor = tom === "seal" ? "text-seal" : tom === "brass" ? "text-brass" : "text-pine";
  return (
    <div className="rounded-2xl border border-line bg-sheet px-3 py-3">
      <p className={`font-display text-3xl leading-none ${cor}`}>{valor}</p>
      <p className="mt-1 text-xs leading-tight text-muted">{rotulo}</p>
    </div>
  );
}

function GuiaBotao({ ativo, onClick, children }: { ativo: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        "inline-flex h-11 items-center gap-2 rounded-xl px-4 text-sm font-medium " +
        (ativo ? "bg-ink text-sheet" : "border border-line bg-sheet text-ink")
      }
    >
      {children}
    </button>
  );
}

function Aba({
  ativo,
  onClick,
  children,
  ink,
}: {
  ativo: boolean;
  onClick: () => void;
  children: ReactNode;
  ink?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        "h-10 shrink-0 rounded-full px-3 text-sm font-medium " +
        (ativo ? (ink ? "bg-ink text-sheet" : "bg-pine text-sheet") : "border border-line bg-sheet text-ink")
      }
    >
      {children}
    </button>
  );
}
