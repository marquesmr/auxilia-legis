export type Dotacao = {
  ficha: number;
  conta: string;
  descricao: string;
  fonte: string;
};

const FONTE = "1.500.000.0000";

const CONTAS: [number, string, string][] = [
  [1, "01.01.01.01.031.0001.1001.4.4.90.51.00", "Obras e Instalações"],
  [2, "01.01.01.01.031.0001.1002.4.4.90.52.00", "Equipamento e Material Permanente"],
  [3, "01.01.01.01.031.0001.2001.3.1.90.11.00", "Vencimentos e Vantagens Fixas"],
  [4, "01.01.01.01.031.0001.2001.3.1.90.13.00", "Obrigações Patronais"],
  [5, "01.01.01.01.031.0001.2001.3.3.90.30.00", "Material de Consumo"],
  [6, "01.01.01.01.031.0001.2001.3.3.90.36.00", "Outros Serviços de Terceiros"],
  [7, "01.01.01.01.031.0001.2001.3.3.90.39.00", "Outros Serviços de Terceiros — Pessoa Física"],
  [8, "01.01.01.01.031.0001.2002.3.1.90.11.00", "Vencimentos e Vantagens Fixas"],
  [9, "01.01.01.01.031.0001.2002.3.1.90.13.00", "Obrigações Patronais"],
  [10, "01.01.01.01.031.0001.2002.3.3.90.30.00", "Material de Consumo"],
  [11, "01.01.01.01.031.0001.2002.3.3.90.36.00", "Outros Serviços de Terceiros"],
  [12, "01.01.01.01.031.0001.2002.3.3.90.39.00", "Outros Serviços de Terceiros — Pessoa Física"],
  [13, "01.01.01.01.031.0001.2003.3.1.90.11.00", "Vencimentos e Vantagens Fixas"],
  [14, "01.01.01.01.031.0001.2003.3.1.90.13.00", "Obrigações Patronais"],
  [15, "01.01.01.01.031.0001.2003.3.3.90.14.00", "Diárias — Pessoal Civil"],
  [16, "01.01.01.01.031.0001.2003.3.3.90.93.00", "Indenizações e Restituições"],
  [17, "01.01.01.01.031.0001.2004.3.1.90.04.00", "Contratação por Tempo Determinado"],
  [18, "01.01.01.01.031.0001.2004.3.1.90.11.00", "Vencimentos e Vantagens Fixas"],
  [19, "01.01.01.01.031.0001.2004.3.1.90.13.00", "Obrigações Patronais"],
  [20, "01.01.01.01.031.0001.2004.3.1.90.94.00", "Indenizações e Restituições"],
  [21, "01.01.01.01.031.0001.2004.3.3.90.14.00", "Diárias — Pessoal Civil"],
  [22, "01.01.01.01.031.0001.2004.3.3.90.30.00", "Material de Consumo"],
  [23, "01.01.01.01.031.0001.2004.3.3.90.31.00", "Premiação"],
  [24, "01.01.01.01.031.0001.2004.3.3.90.35.00", "Serviços de Consultoria"],
  [25, "01.01.01.01.031.0001.2004.3.3.90.36.00", "Outros Serviços de Terceiros"],
  [26, "01.01.01.01.031.0001.2004.3.3.90.39.00", "Outros Serviços de Terceiros — Pessoa Física"],
  [27, "01.01.01.01.031.0001.2004.3.3.90.40.00", "Serviços de TI e Comunicação — Pessoa Jurídica"],
  [28, "01.01.01.01.031.0001.2004.3.3.90.46.00", "Auxílio-alimentação"],
  [29, "01.01.01.01.031.0001.2004.3.3.90.49.00", "Auxílio-Transporte"],
  [30, "01.01.01.01.031.0001.2004.3.3.90.93.00", "Indenizações e Restituições"],
];

export const DOTACOES: Dotacao[] = CONTAS.map(([ficha, conta, descricao]) => ({ ficha, conta, descricao, fonte: FONTE }));

export function fichaDotacao(valor: string) {
  const numero = Number(valor.replace(/\D/g, ""));
  if (!Number.isInteger(numero) || numero < 1) return null;
  return DOTACOES.find((item) => item.ficha === numero) ?? null;
}

export function dotacaoDocumento(conta: string) {
  const partes = conta.split(".");
  if (partes.length < 8) return conta;
  return `${partes.slice(0, 3).join(".")}. ${partes.slice(3, 7).join(".")} ${partes.slice(7).join(".")}`;
}

export function fichaDocumento(ficha: number) {
  return String(ficha).padStart(2, "0");
}
