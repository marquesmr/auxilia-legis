export type AreaStatus = "legislativo" | "administrativo";

export type StatusItem = {
  id: string;
  area: AreaStatus;
  codigo: string;
  nome: string;
  ordem: number;
  encerra: boolean;
  fixo: boolean;
  tramiteDias: number | null;
  tramiteCodigo: string | null;
};

const PADRAO: StatusItem[] = [
  item("leg-andamento", "legislativo", "andamento", "Em andamento", 1, false),
  item("leg-concluido", "legislativo", "concluido", "Arquivado", 2, true),
  item("adm-proposta", "administrativo", "proposta", "Recebendo proposta", 1, false),
  item("adm-pareceres", "administrativo", "pareceres", "Pareceres", 2, false),
  item("adm-assinatura", "administrativo", "assinatura", "Assinatura de contrato", 3, false),
  item("adm-execucao", "administrativo", "execucao", "Execução", 4, false),
  item("adm-encerrado", "administrativo", "encerrado", "Encerrado", 5, true),
  item("adm-cancelado", "administrativo", "cancelado", "Cancelado", 6, true),
];

function item(id: string, area: AreaStatus, codigo: string, nome: string, ordem: number, encerra: boolean): StatusItem {
  return { id, area, codigo, nome, ordem, encerra, fixo: true, tramiteDias: null, tramiteCodigo: null };
}

let catalogo: StatusItem[] = PADRAO;

export function definirStatus(lista: StatusItem[]) {
  if (lista.length) catalogo = lista;
}

export function statusDaArea(area: AreaStatus): StatusItem[] {
  const lista = catalogo.filter((status) => status.area === area).sort((a, b) => a.ordem - b.ordem || a.nome.localeCompare(b.nome, "pt"));
  return lista.length ? lista : PADRAO.filter((status) => status.area === area);
}

export function nomeStatus(area: AreaStatus, codigo: string): string {
  return statusDaArea(area).find((status) => status.codigo === codigo)?.nome ?? codigo;
}

export function encerraStatus(area: AreaStatus, codigo: string): boolean {
  if (codigo === "concluido" || codigo === "encerrado" || codigo === "cancelado") return true;
  return statusDaArea(area).find((status) => status.codigo === codigo)?.encerra ?? false;
}

export function listaCodigos(area: AreaStatus): string[] {
  return statusDaArea(area).map((status) => status.codigo);
}
