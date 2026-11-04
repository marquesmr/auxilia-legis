import { createServerFn } from "@tanstack/react-start";
import { getSql } from "@/lib/db";
import { authMiddleware } from "@/lib/auth/middleware";

export type SituacaoFrota = "disponivel" | "em_uso" | "manutencao" | "baixado";

export type VeiculoFrota = {
  id: string;
  placa: string;
  descricao: string;
  marca: string;
  ano: number | null;
  chassi: string;
  renavam: string;
  tipo: string;
  combustivel: string;
  capacidade: string;
  posse: string;
  km: number;
  situacao: SituacaoFrota;
  setor: string;
  equipeId: string | null;
  seguroApolice: string;
  seguroCobertura: string;
  seguroVence: string;
};

export type CondutorFrota = {
  id: string;
  nome: string;
  cnh: string;
  categoria: string;
  validade: string;
  pontuacao: number;
  historico: string;
  treinamentos: string;
  toxicologico: string;
  equipeId: string | null;
};

export type AbastecimentoFrota = {
  id: string;
  veiculoId: string;
  data: string;
  hora: string;
  posto: string;
  odometro: number;
  medidor: "km" | "horas";
  tipo: string;
  litros: number;
};

export type ManutencaoFrota = {
  id: string;
  veiculoId: string;
  classe: "preventiva" | "corretiva" | "pneu";
  item: string;
  data: string;
  km: number;
  proximaData: string;
  proximoKm: number | null;
  oficina: string;
  diasParada: number;
  custo: number;
  pressao: string;
  sulco: string;
  detalhe: string;
};

export type SaidaFrota = {
  id: string;
  veiculoId: string;
  condutorId: string;
  motorista: string;
  destino: string;
  motivo: string;
  finalidade: string;
  cliente: string;
  carga: string;
  ordem: string;
  saidaEm: string;
  horaSaida: string;
  kmSaida: number;
  retornoEm: string | null;
  horaRetorno: string;
  kmRetorno: number | null;
  velocidade: number | null;
  freadas: number | null;
  ocioso: number | null;
  desvio: string;
};

export type MultaFrota = {
  id: string;
  veiculoId: string;
  condutorId: string;
  data: string;
  local: string;
  gravidade: string;
  valor: number;
  desconto: boolean;
  pontos: number;
};

export type AgendamentoFrota = {
  id: string;
  veiculoId: string;
  userId: string;
  nome: string;
  dia: string;
  horaInicio: string;
  horaFim: string;
  horaSaida: string;
  kmSaida: number | null;
  horaRetorno: string;
  kmRetorno: number | null;
};

export type SinistroFrota = {
  id: string;
  veiculoId: string;
  condutorId: string;
  data: string;
  boletim: string;
  avaria: string;
  custo: number;
  relato: string;
};

const TIPOS = ["Carro", "Moto", "Van", "Caminhão", "Ônibus", "Outro"];
const COMBUSTIVEIS = ["Flex", "Gasolina", "Etanol", "Diesel", "GNV", "Elétrico"];
const SITUACOES: SituacaoFrota[] = ["disponivel", "em_uso", "manutencao", "baixado"];
const CATEGORIAS = ["A", "B", "C", "D", "E", "AB", "AC", "AD", "AE"];
const GRAVIDADES = ["Leve", "Média", "Grave", "Gravíssima"];
const FINALIDADES = ["Cliente", "Entrega", "Carga", "Ordem de serviço", "Outro"];

function texto(valor: unknown, max: number, nome: string) {
  if (typeof valor !== "string" || !valor.trim()) throw new Error(`Informe ${nome}.`);
  return valor.trim().slice(0, max);
}

function placaOk(valor: unknown) {
  const placa = typeof valor === "string" ? valor.toUpperCase().replace(/[^A-Z0-9]/g, "") : "";
  if (!/^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}$/.test(placa)) throw new Error("Placa inválida. Use o padrão antigo ou o Mercosul.");
  return placa;
}

function anoOk(valor: unknown) {
  if (valor == null || valor === "") return null;
  const ano = Number(valor);
  const atual = new Date().getFullYear() + 1;
  if (!Number.isInteger(ano) || ano < 1950 || ano > atual) throw new Error("Ano do veículo inválido.");
  return ano;
}

function kmOk(valor: unknown, nome: string) {
  const km = Number(valor);
  if (!Number.isInteger(km) || km < 0 || km > 10_000_000) throw new Error(`${nome} inválida.`);
  return km;
}

function dataOk(valor: unknown, nome: string) {
  if (typeof valor !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(valor)) throw new Error(`${nome} inválida.`);
  return valor;
}

function equipeOk(valor: unknown) {
  if (valor == null || valor === "") return null;
  if (typeof valor !== "string" || !valor.trim()) throw new Error("Equipe inválida.");
  return valor.trim().slice(0, 80);
}

async function garantirFrota() {
  const sql = await getSql();
  await sql`
    create table if not exists frota_veiculos (
      id text primary key,
      user_id text not null references "user" (id) on delete cascade,
      team_id text,
      placa text not null,
      descricao text not null,
      ano integer,
      tipo text not null,
      combustivel text not null,
      km integer not null default 0,
      situacao text not null,
      setor text not null default '',
      created_at timestamptz not null default now()
    )
  `;
  await sql`
    create table if not exists frota_saidas (
      id text primary key,
      veiculo_id text not null references frota_veiculos (id) on delete cascade,
      user_id text not null,
      motorista text not null,
      destino text not null,
      motivo text not null default '',
      saida_em date not null,
      km_saida integer not null,
      retorno_em date,
      km_retorno integer,
      created_at timestamptz not null default now()
    )
  `;
  await sql`alter table frota_veiculos add column if not exists marca text not null default ''`;
  await sql`alter table frota_veiculos add column if not exists chassi text not null default ''`;
  await sql`alter table frota_veiculos add column if not exists renavam text not null default ''`;
  await sql`alter table frota_veiculos add column if not exists capacidade text not null default ''`;
  await sql`alter table frota_veiculos add column if not exists posse text not null default 'Próprio'`;
  await sql`alter table frota_veiculos add column if not exists ipva date`;
  await sql`alter table frota_veiculos add column if not exists licenciamento date`;
  await sql`alter table frota_veiculos add column if not exists seguro_apolice text not null default ''`;
  await sql`alter table frota_veiculos add column if not exists seguro_cobertura text not null default ''`;
  await sql`alter table frota_veiculos add column if not exists seguro_vence date`;
  await sql`alter table frota_veiculos add column if not exists inspecao date`;
  await sql`alter table frota_veiculos add column if not exists cronotacografo date`;
  await sql`alter table frota_saidas add column if not exists condutor_id text not null default ''`;
  await sql`alter table frota_saidas add column if not exists finalidade text not null default ''`;
  await sql`alter table frota_saidas add column if not exists cliente text not null default ''`;
  await sql`alter table frota_saidas add column if not exists carga text not null default ''`;
  await sql`alter table frota_saidas add column if not exists ordem text not null default ''`;
  await sql`alter table frota_saidas add column if not exists hora_saida text not null default ''`;
  await sql`alter table frota_saidas add column if not exists hora_retorno text not null default ''`;
  await sql`alter table frota_saidas add column if not exists velocidade integer`;
  await sql`alter table frota_saidas add column if not exists freadas integer`;
  await sql`alter table frota_saidas add column if not exists ocioso integer`;
  await sql`alter table frota_saidas add column if not exists desvio text not null default ''`;
  await sql`
    create table if not exists frota_condutores (
      id text primary key,
      user_id text not null,
      team_id text,
      nome text not null,
      cnh text not null,
      categoria text not null,
      validade date,
      pontuacao integer not null default 0,
      historico text not null default '',
      treinamentos text not null default '',
      toxicologico date,
      created_at timestamptz not null default now()
    )
  `;
  await sql`
    create table if not exists frota_abastecimentos (
      id text primary key,
      veiculo_id text not null references frota_veiculos (id) on delete cascade,
      user_id text not null,
      data date not null,
      hora text not null default '',
      posto text not null,
      odometro integer not null,
      medidor text not null,
      tipo text not null,
      litros numeric not null,
      created_at timestamptz not null default now()
    )
  `;
  await sql`
    create table if not exists frota_manutencoes (
      id text primary key,
      veiculo_id text not null references frota_veiculos (id) on delete cascade,
      user_id text not null,
      classe text not null,
      item text not null,
      data date not null,
      km integer not null default 0,
      proxima_data date,
      proximo_km integer,
      oficina text not null default '',
      dias_parada integer not null default 0,
      custo integer not null default 0,
      pressao text not null default '',
      sulco text not null default '',
      detalhe text not null default '',
      created_at timestamptz not null default now()
    )
  `;
  await sql`
    create table if not exists frota_multas (
      id text primary key,
      veiculo_id text not null references frota_veiculos (id) on delete cascade,
      condutor_id text not null default '',
      user_id text not null,
      data date not null,
      local text not null,
      gravidade text not null,
      valor integer not null default 0,
      desconto boolean not null default false,
      pontos integer not null default 0,
      created_at timestamptz not null default now()
    )
  `;
  await sql`
    create table if not exists frota_sinistros (
      id text primary key,
      veiculo_id text not null references frota_veiculos (id) on delete cascade,
      condutor_id text not null default '',
      user_id text not null,
      data date not null,
      boletim text not null default '',
      avaria text not null,
      custo integer not null default 0,
      relato text not null default '',
      created_at timestamptz not null default now()
    )
  `;
  await sql`
    create table if not exists frota_agendamentos (
      id text primary key,
      veiculo_id text not null references frota_veiculos (id) on delete cascade,
      user_id text not null,
      nome text not null,
      dia date not null,
      hora_inicio text not null,
      hora_fim text not null,
      hora_saida text not null default '',
      km_saida integer,
      hora_retorno text not null default '',
      km_retorno integer,
      created_at timestamptz not null default now()
    )
  `;
  return sql;
}

async function exigirAdminFrota(userId: string) {
  const sql = await getSql();
  const perfil = await sql<{ papel: string; bloqueado: boolean }>`
    select papel, bloqueado from usuario_perfil where user_id = ${userId}
  `;
  if (perfil[0]?.papel !== "administrador" || perfil[0]?.bloqueado) {
    throw new Error("O módulo Frotas ainda está só para o administrador.");
  }
}

async function exigirEquipe(userId: string, equipeId: string | null) {
  if (!equipeId) return;
  const sql = await getSql();
  const membro = await sql<{ ok: number }>`
    select 1 as ok from equipe_membros where equipe_id = ${equipeId} and user_id = ${userId}
  `;
  if (!membro.length) throw new Error("Você não faz parte desta equipe.");
}

function situacaoOk(valor: unknown): SituacaoFrota {
  if (typeof valor === "string" && SITUACOES.includes(valor as SituacaoFrota)) return valor as SituacaoFrota;
  throw new Error("Situação inválida.");
}

function dataOpcional(valor: unknown) {
  if (valor == null || valor === "") return "";
  return dataOk(valor, "A data");
}

function horaOpcional(valor: unknown) {
  if (valor == null || valor === "") return "";
  if (typeof valor !== "string" || !/^\d{2}:\d{2}$/.test(valor)) throw new Error("Horário inválido.");
  return valor;
}

function opcional(valor: unknown, max: number) {
  if (typeof valor !== "string") return "";
  return valor.trim().slice(0, max);
}

function inteiro(valor: unknown, nome: string, max = 10_000_000) {
  if (valor == null || valor === "") return 0;
  const numero = Number(valor);
  if (!Number.isInteger(numero) || numero < 0 || numero > max) throw new Error(`${nome} inválido.`);
  return numero;
}

function inteiroOuNulo(valor: unknown, nome: string) {
  if (valor == null || valor === "") return null;
  return inteiro(valor, nome);
}

function dinheiro(valor: unknown) {
  if (typeof valor === "number" && Number.isFinite(valor)) return Math.round(valor);
  return inteiro(valor, "O valor", 100_000_000);
}

function litrosOk(valor: unknown) {
  const litros = Number(valor);
  if (!Number.isFinite(litros) || litros <= 0 || litros > 10000) throw new Error("Quantidade de litros inválida.");
  return Math.round(litros * 1000) / 1000;
}

function dia(valor: unknown) {
  if (!valor) return "";
  if (valor instanceof Date) return valor.toISOString().slice(0, 10);
  return String(valor).slice(0, 10);
}

function txt(item: Record<string, unknown>, chave: string) {
  return String(item[chave] ?? "");
}

function num(item: Record<string, unknown>, chave: string) {
  const valor = item[chave];
  if (valor == null || valor === "") return 0;
  return Number(valor);
}

function numOuNulo(item: Record<string, unknown>, chave: string) {
  const valor = item[chave];
  if (valor == null || valor === "") return null;
  return Number(valor);
}

function mapaVeiculo(item: Record<string, unknown>): VeiculoFrota {
  return {
    id: txt(item, "id"),
    placa: txt(item, "placa"),
    descricao: txt(item, "descricao"),
    marca: txt(item, "marca"),
    ano: item.ano == null ? null : Number(item.ano),
    chassi: txt(item, "chassi"),
    renavam: txt(item, "renavam"),
    tipo: txt(item, "tipo"),
    combustivel: txt(item, "combustivel"),
    capacidade: txt(item, "capacidade"),
    posse: txt(item, "posse") === "Alugado" ? "Alugado" : "Próprio",
    km: num(item, "km"),
    situacao: situacaoOk(item.situacao),
    setor: txt(item, "setor"),
    equipeId: item.team_id ? String(item.team_id) : null,
    seguroApolice: txt(item, "seguro_apolice"),
    seguroCobertura: txt(item, "seguro_cobertura"),
    seguroVence: dia(item.seguro_vence),
  };
}

function mapaCondutor(item: Record<string, unknown>): CondutorFrota {
  return {
    id: txt(item, "id"),
    nome: txt(item, "nome"),
    cnh: txt(item, "cnh"),
    categoria: txt(item, "categoria"),
    validade: dia(item.validade),
    pontuacao: num(item, "pontuacao"),
    historico: txt(item, "historico"),
    treinamentos: txt(item, "treinamentos"),
    toxicologico: dia(item.toxicologico),
    equipeId: item.team_id ? String(item.team_id) : null,
  };
}

function mapaAbastecimento(item: Record<string, unknown>): AbastecimentoFrota {
  return {
    id: txt(item, "id"),
    veiculoId: txt(item, "veiculo_id"),
    data: dia(item.data),
    hora: txt(item, "hora"),
    posto: txt(item, "posto"),
    odometro: num(item, "odometro"),
    medidor: item.medidor === "horas" ? "horas" : "km",
    tipo: txt(item, "tipo"),
    litros: num(item, "litros"),
  };
}

function mapaManutencao(item: Record<string, unknown>): ManutencaoFrota {
  const classe = item.classe === "corretiva" || item.classe === "pneu" ? item.classe : "preventiva";
  return {
    id: txt(item, "id"),
    veiculoId: txt(item, "veiculo_id"),
    classe,
    item: txt(item, "item"),
    data: dia(item.data),
    km: num(item, "km"),
    proximaData: dia(item.proxima_data),
    proximoKm: numOuNulo(item, "proximo_km"),
    oficina: txt(item, "oficina"),
    diasParada: num(item, "dias_parada"),
    custo: num(item, "custo"),
    pressao: txt(item, "pressao"),
    sulco: txt(item, "sulco"),
    detalhe: txt(item, "detalhe"),
  };
}

function mapaSaida(item: Record<string, unknown>): SaidaFrota {
  return {
    id: txt(item, "id"),
    veiculoId: txt(item, "veiculo_id"),
    condutorId: txt(item, "condutor_id"),
    motorista: txt(item, "motorista"),
    destino: txt(item, "destino"),
    motivo: txt(item, "motivo"),
    finalidade: txt(item, "finalidade"),
    cliente: txt(item, "cliente"),
    carga: txt(item, "carga"),
    ordem: txt(item, "ordem"),
    saidaEm: dia(item.saida_em),
    horaSaida: txt(item, "hora_saida"),
    kmSaida: num(item, "km_saida"),
    retornoEm: item.retorno_em ? dia(item.retorno_em) : null,
    horaRetorno: txt(item, "hora_retorno"),
    kmRetorno: numOuNulo(item, "km_retorno"),
    velocidade: numOuNulo(item, "velocidade"),
    freadas: numOuNulo(item, "freadas"),
    ocioso: numOuNulo(item, "ocioso"),
    desvio: txt(item, "desvio"),
  };
}

function mapaMulta(item: Record<string, unknown>): MultaFrota {
  return {
    id: txt(item, "id"),
    veiculoId: txt(item, "veiculo_id"),
    condutorId: txt(item, "condutor_id"),
    data: dia(item.data),
    local: txt(item, "local"),
    gravidade: txt(item, "gravidade"),
    valor: num(item, "valor"),
    desconto: Boolean(item.desconto),
    pontos: num(item, "pontos"),
  };
}

function mapaSinistro(item: Record<string, unknown>): SinistroFrota {
  return {
    id: txt(item, "id"),
    veiculoId: txt(item, "veiculo_id"),
    condutorId: txt(item, "condutor_id"),
    data: dia(item.data),
    boletim: txt(item, "boletim"),
    avaria: txt(item, "avaria"),
    custo: num(item, "custo"),
    relato: txt(item, "relato"),
  };
}

function mapaAgendamento(item: Record<string, unknown>): AgendamentoFrota {
  return {
    id: txt(item, "id"),
    veiculoId: txt(item, "veiculo_id"),
    userId: txt(item, "user_id"),
    nome: txt(item, "nome"),
    dia: dia(item.dia),
    horaInicio: txt(item, "hora_inicio"),
    horaFim: txt(item, "hora_fim"),
    horaSaida: txt(item, "hora_saida"),
    kmSaida: numOuNulo(item, "km_saida"),
    horaRetorno: txt(item, "hora_retorno"),
    kmRetorno: numOuNulo(item, "km_retorno"),
  };
}

export const listarFrotas = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => equipeOk(input && typeof input === "object" ? (input as { equipeId?: unknown }).equipeId : input))
  .handler(async ({ context, data: equipeId }) => {
    await exigirAdminFrota(context.userId);
    const sql = await garantirFrota();
    await exigirEquipe(context.userId, equipeId);
    const veiculos = equipeId
      ? await sql<Record<string, unknown>>`select * from frota_veiculos where team_id = ${equipeId} order by placa`
      : await sql<Record<string, unknown>>`select * from frota_veiculos where user_id = ${context.userId} and team_id is null order by placa`;
    const saidas = equipeId
      ? await sql<Record<string, unknown>>`
          select s.* from frota_saidas s
          join frota_veiculos v on v.id = s.veiculo_id
          where v.team_id = ${equipeId}
          order by s.saida_em desc, s.created_at desc
        `
      : await sql<Record<string, unknown>>`
          select s.* from frota_saidas s
          join frota_veiculos v on v.id = s.veiculo_id
          where v.user_id = ${context.userId} and v.team_id is null
          order by s.saida_em desc, s.created_at desc
        `;
    const condutores = equipeId
      ? await sql<Record<string, unknown>>`select * from frota_condutores where team_id = ${equipeId} order by nome`
      : await sql<Record<string, unknown>>`select * from frota_condutores where user_id = ${context.userId} and team_id is null order by nome`;
    const filtroFilhos = equipeId
      ? sql<Record<string, unknown>>`select id from frota_veiculos where team_id = ${equipeId}`
      : sql<Record<string, unknown>>`select id from frota_veiculos where user_id = ${context.userId} and team_id is null`;
    const donos = new Set((await filtroFilhos).map((item) => String(item.id)));
    const [abastecimentos, manutencoes, multas, sinistros, agendamentos] = await Promise.all([
      sql<Record<string, unknown>>`select * from frota_abastecimentos order by data desc, created_at desc`,
      sql<Record<string, unknown>>`select * from frota_manutencoes order by data desc, created_at desc`,
      sql<Record<string, unknown>>`select * from frota_multas order by data desc, created_at desc`,
      sql<Record<string, unknown>>`select * from frota_sinistros order by data desc, created_at desc`,
      sql<Record<string, unknown>>`select * from frota_agendamentos order by dia, hora_inicio`,
    ]);
    const doEscopo = (lista: Record<string, unknown>[]) => lista.filter((item) => donos.has(String(item.veiculo_id)));
    return {
      veiculos: veiculos.map(mapaVeiculo),
      saidas: saidas.map(mapaSaida),
      condutores: condutores.map(mapaCondutor),
      abastecimentos: doEscopo(abastecimentos).map(mapaAbastecimento),
      manutencoes: doEscopo(manutencoes).map(mapaManutencao),
      multas: doEscopo(multas).map(mapaMulta),
      sinistros: doEscopo(sinistros).map(mapaSinistro),
      agendamentos: doEscopo(agendamentos).map(mapaAgendamento),
    };
  });

export const salvarVeiculo = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => {
    if (!input || typeof input !== "object") throw new Error("Dados inválidos");
    const bruto = input as Record<string, unknown>;
    const tipo = texto(bruto.tipo, 40, "o tipo");
    if (!TIPOS.includes(tipo)) throw new Error("Tipo inválido.");
    const combustivel = texto(bruto.combustivel, 40, "o combustível");
    if (!COMBUSTIVEIS.includes(combustivel)) throw new Error("Combustível inválido.");
    return {
      id: typeof bruto.id === "string" ? bruto.id.trim().slice(0, 80) : "",
      equipeId: equipeOk(bruto.equipeId),
      placa: placaOk(bruto.placa),
      descricao: texto(bruto.descricao, 80, "o modelo"),
      marca: opcional(bruto.marca, 80),
      ano: anoOk(bruto.ano),
      chassi: opcional(bruto.chassi, 40),
      renavam: opcional(bruto.renavam, 20),
      tipo,
      combustivel,
      capacidade: opcional(bruto.capacidade, 80),
      posse: bruto.posse === "Alugado" ? "Alugado" : "Próprio",
      km: kmOk(bruto.km, "A quilometragem"),
      situacao: situacaoOk(bruto.situacao),
      setor: opcional(bruto.setor, 80),
      seguroApolice: opcional(bruto.seguroApolice, 80),
      seguroCobertura: opcional(bruto.seguroCobertura, 200),
      seguroVence: dataOpcional(bruto.seguroVence),
    };
  })
  .handler(async ({ context, data }) => {
    await exigirAdminFrota(context.userId);
    const { exigirEscrita } = await import("./gestao.server");
    await exigirEscrita(context.userId);
    const sql = await garantirFrota();
    await exigirEquipe(context.userId, data.equipeId);
    const repetida = data.equipeId
      ? await sql<{ id: string }>`select id from frota_veiculos where team_id = ${data.equipeId} and placa = ${data.placa} and id <> ${data.id}`
      : await sql<{ id: string }>`select id from frota_veiculos where user_id = ${context.userId} and team_id is null and placa = ${data.placa} and id <> ${data.id}`;
    if (repetida.length) throw new Error("Já existe um veículo com esta placa.");
    const id = data.id || crypto.randomUUID();
    if (data.id) {
      const atual = await sql<{ user_id: string; team_id: string | null }>`select user_id, team_id from frota_veiculos where id = ${id}`;
      if (!atual.length) throw new Error("Veículo não encontrado.");
      if (atual[0].team_id !== data.equipeId) throw new Error("Veículo não encontrado.");
      if (!data.equipeId && atual[0].user_id !== context.userId) throw new Error("Veículo não encontrado.");
      await sql`
        update frota_veiculos set
          placa = ${data.placa},
          descricao = ${data.descricao},
          marca = ${data.marca},
          ano = ${data.ano},
          chassi = ${data.chassi},
          renavam = ${data.renavam},
          tipo = ${data.tipo},
          combustivel = ${data.combustivel},
          capacidade = ${data.capacidade},
          posse = ${data.posse},
          km = ${data.km},
          situacao = ${data.situacao},
          setor = ${data.setor},
          seguro_apolice = ${data.seguroApolice},
          seguro_cobertura = ${data.seguroCobertura},
          seguro_vence = ${data.seguroVence || null}
        where id = ${id}
      `;
    } else {
      await sql`
        insert into frota_veiculos (
          id, user_id, team_id, placa, descricao, marca, ano, chassi, renavam, tipo, combustivel,
          capacidade, posse, km, situacao, setor, seguro_apolice, seguro_cobertura, seguro_vence
        )
        values (
          ${id}, ${context.userId}, ${data.equipeId}, ${data.placa}, ${data.descricao}, ${data.marca}, ${data.ano},
          ${data.chassi}, ${data.renavam}, ${data.tipo}, ${data.combustivel}, ${data.capacidade}, ${data.posse},
          ${data.km}, ${data.situacao}, ${data.setor},
          ${data.seguroApolice}, ${data.seguroCobertura}, ${data.seguroVence || null}
        )
      `;
    }
    return { id };
  });

export const excluirVeiculo = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => {
    if (!input || typeof input !== "object") throw new Error("Dados inválidos");
    const bruto = input as { id?: unknown; equipeId?: unknown };
    const id = typeof bruto.id === "string" ? bruto.id.trim().slice(0, 80) : "";
    if (!id) throw new Error("Veículo inválido.");
    return { id, equipeId: equipeOk(bruto.equipeId) };
  })
  .handler(async ({ context, data }) => {
    await exigirAdminFrota(context.userId);
    const { exigirEscrita } = await import("./gestao.server");
    await exigirEscrita(context.userId);
    const sql = await garantirFrota();
    await exigirEquipe(context.userId, data.equipeId);
    if (data.equipeId) {
      await sql`delete from frota_veiculos where id = ${data.id} and team_id = ${data.equipeId}`;
    } else {
      await sql`delete from frota_veiculos where id = ${data.id} and user_id = ${context.userId} and team_id is null`;
    }
    return { ok: true };
  });

export const registrarSaida = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => {
    if (!input || typeof input !== "object") throw new Error("Dados inválidos");
    const bruto = input as Record<string, unknown>;
    const veiculoId = typeof bruto.veiculoId === "string" ? bruto.veiculoId.trim().slice(0, 80) : "";
    if (!veiculoId) throw new Error("Veículo inválido.");
    const finalidade = opcional(bruto.finalidade, 40);
    if (finalidade && !FINALIDADES.includes(finalidade)) throw new Error("Finalidade inválida.");
    return {
      veiculoId,
      equipeId: equipeOk(bruto.equipeId),
      condutorId: opcional(bruto.condutorId, 80),
      motorista: texto(bruto.motorista, 80, "o motorista"),
      destino: texto(bruto.destino, 120, "o destino"),
      motivo: opcional(bruto.motivo, 200),
      finalidade,
      cliente: opcional(bruto.cliente, 120),
      carga: opcional(bruto.carga, 120),
      ordem: opcional(bruto.ordem, 80),
      saidaEm: dataOk(bruto.saidaEm, "A data de saída"),
      horaSaida: horaOpcional(bruto.horaSaida),
      kmSaida: kmOk(bruto.kmSaida, "A quilometragem de saída"),
    };
  })
  .handler(async ({ context, data }) => {
    await exigirAdminFrota(context.userId);
    const { exigirEscrita } = await import("./gestao.server");
    await exigirEscrita(context.userId);
    const sql = await garantirFrota();
    await exigirEquipe(context.userId, data.equipeId);
    const veiculo = data.equipeId
      ? await sql<{ situacao: string; km: number }>`select situacao, km from frota_veiculos where id = ${data.veiculoId} and team_id = ${data.equipeId}`
      : await sql<{ situacao: string; km: number }>`select situacao, km from frota_veiculos where id = ${data.veiculoId} and user_id = ${context.userId} and team_id is null`;
    if (!veiculo.length) throw new Error("Veículo não encontrado.");
    if (veiculo[0].situacao === "baixado") throw new Error("Veículo baixado não pode sair.");
    if (veiculo[0].situacao === "manutencao") throw new Error("Veículo em manutenção não pode sair.");
    if (veiculo[0].situacao === "em_uso") throw new Error("Este veículo já está em uma saída.");
    if (data.kmSaida < Number(veiculo[0].km)) throw new Error("A quilometragem de saída não pode ser menor que a atual.");
    const id = crypto.randomUUID();
    await sql`
      insert into frota_saidas (
        id, veiculo_id, user_id, condutor_id, motorista, destino, motivo, finalidade, cliente, carga, ordem, saida_em, hora_saida, km_saida
      )
      values (
        ${id}, ${data.veiculoId}, ${context.userId}, ${data.condutorId}, ${data.motorista}, ${data.destino}, ${data.motivo},
        ${data.finalidade}, ${data.cliente}, ${data.carga}, ${data.ordem}, ${data.saidaEm}, ${data.horaSaida}, ${data.kmSaida}
      )
    `;
    await sql`update frota_veiculos set situacao = 'em_uso', km = ${data.kmSaida} where id = ${data.veiculoId}`;
    return { id };
  });

export const registrarRetorno = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => {
    if (!input || typeof input !== "object") throw new Error("Dados inválidos");
    const bruto = input as Record<string, unknown>;
    const saidaId = typeof bruto.saidaId === "string" ? bruto.saidaId.trim().slice(0, 80) : "";
    if (!saidaId) throw new Error("Saída inválida.");
    return {
      saidaId,
      equipeId: equipeOk(bruto.equipeId),
      retornoEm: dataOk(bruto.retornoEm, "A data de retorno"),
      horaRetorno: horaOpcional(bruto.horaRetorno),
      kmRetorno: kmOk(bruto.kmRetorno, "A quilometragem de retorno"),
      velocidade: inteiroOuNulo(bruto.velocidade, "A velocidade"),
      freadas: inteiroOuNulo(bruto.freadas, "As freadas"),
      ocioso: inteiroOuNulo(bruto.ocioso, "O tempo ocioso"),
      desvio: opcional(bruto.desvio, 300),
    };
  })
  .handler(async ({ context, data }) => {
    await exigirAdminFrota(context.userId);
    const { exigirEscrita } = await import("./gestao.server");
    await exigirEscrita(context.userId);
    const sql = await garantirFrota();
    await exigirEquipe(context.userId, data.equipeId);
    const saida = await sql<{ veiculo_id: string; saida_em: string; km_saida: number; retorno_em: string | null }>`
      select veiculo_id, saida_em, km_saida, retorno_em from frota_saidas where id = ${data.saidaId}
    `;
    if (!saida.length || saida[0].retorno_em) throw new Error("Esta saída já foi encerrada.");
    if (data.retornoEm < dia(saida[0].saida_em)) throw new Error("O retorno não pode ser antes da saída.");
    if (data.kmRetorno < Number(saida[0].km_saida)) throw new Error("A quilometragem de retorno não pode ser menor que a da saída.");
    const veiculoId = saida[0].veiculo_id;
    const dono = data.equipeId
      ? await sql<{ id: string }>`select id from frota_veiculos where id = ${veiculoId} and team_id = ${data.equipeId}`
      : await sql<{ id: string }>`select id from frota_veiculos where id = ${veiculoId} and user_id = ${context.userId} and team_id is null`;
    if (!dono.length) throw new Error("Veículo não encontrado.");
    await sql`
      update frota_saidas set
        retorno_em = ${data.retornoEm},
        hora_retorno = ${data.horaRetorno},
        km_retorno = ${data.kmRetorno},
        velocidade = ${data.velocidade},
        freadas = ${data.freadas},
        ocioso = ${data.ocioso},
        desvio = ${data.desvio}
      where id = ${data.saidaId}
    `;
    await sql`update frota_veiculos set situacao = 'disponivel', km = ${data.kmRetorno} where id = ${veiculoId}`;
    return { ok: true };
  });

async function preparar(userId: string, equipeId: string | null) {
  await exigirAdminFrota(userId);
  const { exigirEscrita } = await import("./gestao.server");
  await exigirEscrita(userId);
  const sql = await garantirFrota();
  await exigirEquipe(userId, equipeId);
  return sql;
}

async function veiculoDoEscopo(sql: Awaited<ReturnType<typeof getSql>>, userId: string, equipeId: string | null, veiculoId: string) {
  const linhas = equipeId
    ? await sql<{ id: string; km: number }>`select id, km from frota_veiculos where id = ${veiculoId} and team_id = ${equipeId}`
    : await sql<{ id: string; km: number }>`select id, km from frota_veiculos where id = ${veiculoId} and user_id = ${userId} and team_id is null`;
  if (!linhas.length) throw new Error("Veículo não encontrado.");
  return linhas[0];
}

function idOk(valor: unknown, nome: string) {
  const id = typeof valor === "string" ? valor.trim().slice(0, 80) : "";
  if (!id) throw new Error(`${nome} inválido.`);
  return id;
}

export const salvarCondutor = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => {
    if (!input || typeof input !== "object") throw new Error("Dados inválidos");
    const bruto = input as Record<string, unknown>;
    const categoria = texto(bruto.categoria, 4, "a categoria da CNH");
    if (!CATEGORIAS.includes(categoria)) throw new Error("Categoria da CNH inválida.");
    return {
      id: opcional(bruto.id, 80),
      equipeId: equipeOk(bruto.equipeId),
      nome: texto(bruto.nome, 80, "o nome"),
      cnh: texto(bruto.cnh, 20, "o número da CNH"),
      categoria,
      validade: dataOpcional(bruto.validade),
      pontuacao: inteiro(bruto.pontuacao, "A pontuação", 100),
      historico: opcional(bruto.historico, 500),
      treinamentos: opcional(bruto.treinamentos, 500),
      toxicologico: dataOpcional(bruto.toxicologico),
    };
  })
  .handler(async ({ context, data }) => {
    const sql = await preparar(context.userId, data.equipeId);
    const id = data.id || crypto.randomUUID();
    if (data.id) {
      const atual = data.equipeId
        ? await sql<{ id: string }>`select id from frota_condutores where id = ${id} and team_id = ${data.equipeId}`
        : await sql<{ id: string }>`select id from frota_condutores where id = ${id} and user_id = ${context.userId} and team_id is null`;
      if (!atual.length) throw new Error("Condutor não encontrado.");
      await sql`
        update frota_condutores set
          nome = ${data.nome}, cnh = ${data.cnh}, categoria = ${data.categoria}, validade = ${data.validade || null},
          pontuacao = ${data.pontuacao}, historico = ${data.historico}, treinamentos = ${data.treinamentos}, toxicologico = ${data.toxicologico || null}
        where id = ${id}
      `;
    } else {
      await sql`
        insert into frota_condutores (id, user_id, team_id, nome, cnh, categoria, validade, pontuacao, historico, treinamentos, toxicologico)
        values (${id}, ${context.userId}, ${data.equipeId}, ${data.nome}, ${data.cnh}, ${data.categoria}, ${data.validade || null}, ${data.pontuacao}, ${data.historico}, ${data.treinamentos}, ${data.toxicologico || null})
      `;
    }
    return { id };
  });

export const excluirCondutor = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => {
    if (!input || typeof input !== "object") throw new Error("Dados inválidos");
    const bruto = input as Record<string, unknown>;
    return { id: idOk(bruto.id, "Condutor"), equipeId: equipeOk(bruto.equipeId) };
  })
  .handler(async ({ context, data }) => {
    const sql = await preparar(context.userId, data.equipeId);
    if (data.equipeId) await sql`delete from frota_condutores where id = ${data.id} and team_id = ${data.equipeId}`;
    else await sql`delete from frota_condutores where id = ${data.id} and user_id = ${context.userId} and team_id is null`;
    return { ok: true };
  });

export const salvarAbastecimento = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => {
    if (!input || typeof input !== "object") throw new Error("Dados inválidos");
    const bruto = input as Record<string, unknown>;
    const tipo = texto(bruto.tipo, 40, "o combustível");
    if (!COMBUSTIVEIS.includes(tipo)) throw new Error("Combustível inválido.");
    const medidor = bruto.medidor === "horas" ? "horas" : "km";
    return {
      id: opcional(bruto.id, 80),
      equipeId: equipeOk(bruto.equipeId),
      veiculoId: idOk(bruto.veiculoId, "Veículo"),
      data: dataOk(bruto.data, "A data"),
      hora: horaOpcional(bruto.hora),
      posto: texto(bruto.posto, 80, "o posto"),
      odometro: kmOk(bruto.odometro, medidor === "horas" ? "O horímetro" : "O odômetro"),
      medidor,
      tipo,
      litros: litrosOk(bruto.litros),
    };
  })
  .handler(async ({ context, data }) => {
    const sql = await preparar(context.userId, data.equipeId);
    const veiculo = await veiculoDoEscopo(sql, context.userId, data.equipeId, data.veiculoId);
    const id = data.id || crypto.randomUUID();
    if (data.id) {
      const atual = await sql<{ id: string }>`select id from frota_abastecimentos where id = ${id} and veiculo_id = ${data.veiculoId}`;
      if (!atual.length) throw new Error("Abastecimento não encontrado.");
      await sql`
        update frota_abastecimentos set
          data = ${data.data}, hora = ${data.hora}, posto = ${data.posto}, odometro = ${data.odometro},
          medidor = ${data.medidor}, tipo = ${data.tipo}, litros = ${data.litros}
        where id = ${id}
      `;
    } else {
      await sql`
        insert into frota_abastecimentos (id, veiculo_id, user_id, data, hora, posto, odometro, medidor, tipo, litros)
        values (${id}, ${data.veiculoId}, ${context.userId}, ${data.data}, ${data.hora}, ${data.posto}, ${data.odometro}, ${data.medidor}, ${data.tipo}, ${data.litros})
      `;
    }
    if (data.medidor === "km" && data.odometro > Number(veiculo.km)) {
      await sql`update frota_veiculos set km = ${data.odometro} where id = ${data.veiculoId}`;
    }
    return { id };
  });

export const excluirAbastecimento = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => {
    if (!input || typeof input !== "object") throw new Error("Dados inválidos");
    const bruto = input as Record<string, unknown>;
    return { id: idOk(bruto.id, "Abastecimento"), equipeId: equipeOk(bruto.equipeId), veiculoId: idOk(bruto.veiculoId, "Veículo") };
  })
  .handler(async ({ context, data }) => {
    const sql = await preparar(context.userId, data.equipeId);
    await veiculoDoEscopo(sql, context.userId, data.equipeId, data.veiculoId);
    await sql`delete from frota_abastecimentos where id = ${data.id} and veiculo_id = ${data.veiculoId}`;
    return { ok: true };
  });

export const salvarManutencao = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => {
    if (!input || typeof input !== "object") throw new Error("Dados inválidos");
    const bruto = input as Record<string, unknown>;
    const classe = bruto.classe;
    if (classe !== "preventiva" && classe !== "corretiva" && classe !== "pneu") throw new Error("Tipo de manutenção inválido.");
    return {
      id: opcional(bruto.id, 80),
      equipeId: equipeOk(bruto.equipeId),
      veiculoId: idOk(bruto.veiculoId, "Veículo"),
      classe,
      item: texto(bruto.item, 80, "o serviço"),
      data: dataOk(bruto.data, "A data"),
      km: kmOk(bruto.km ?? 0, "A quilometragem"),
      proximaData: dataOpcional(bruto.proximaData),
      proximoKm: inteiroOuNulo(bruto.proximoKm, "A próxima quilometragem"),
      oficina: opcional(bruto.oficina, 80),
      diasParada: inteiro(bruto.diasParada, "Os dias parados", 3650),
      custo: dinheiro(bruto.custo),
      pressao: opcional(bruto.pressao, 20),
      sulco: opcional(bruto.sulco, 20),
      detalhe: opcional(bruto.detalhe, 400),
    };
  })
  .handler(async ({ context, data }) => {
    const sql = await preparar(context.userId, data.equipeId);
    await veiculoDoEscopo(sql, context.userId, data.equipeId, data.veiculoId);
    const id = data.id || crypto.randomUUID();
    if (data.id) {
      const atual = await sql<{ id: string }>`select id from frota_manutencoes where id = ${id} and veiculo_id = ${data.veiculoId}`;
      if (!atual.length) throw new Error("Manutenção não encontrada.");
      await sql`
        update frota_manutencoes set
          classe = ${data.classe}, item = ${data.item}, data = ${data.data}, km = ${data.km},
          proxima_data = ${data.proximaData || null}, proximo_km = ${data.proximoKm}, oficina = ${data.oficina},
          dias_parada = ${data.diasParada}, custo = ${data.custo}, pressao = ${data.pressao}, sulco = ${data.sulco}, detalhe = ${data.detalhe}
        where id = ${id}
      `;
    } else {
      await sql`
        insert into frota_manutencoes (
          id, veiculo_id, user_id, classe, item, data, km, proxima_data, proximo_km, oficina, dias_parada, custo, pressao, sulco, detalhe
        ) values (
          ${id}, ${data.veiculoId}, ${context.userId}, ${data.classe}, ${data.item}, ${data.data}, ${data.km},
          ${data.proximaData || null}, ${data.proximoKm}, ${data.oficina}, ${data.diasParada}, ${data.custo}, ${data.pressao}, ${data.sulco}, ${data.detalhe}
        )
      `;
    }
    if (data.classe === "corretiva") {
      await sql`update frota_veiculos set situacao = 'manutencao' where id = ${data.veiculoId} and situacao <> 'baixado' and situacao <> 'em_uso'`;
    }
    return { id };
  });

export const excluirManutencao = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => {
    if (!input || typeof input !== "object") throw new Error("Dados inválidos");
    const bruto = input as Record<string, unknown>;
    return { id: idOk(bruto.id, "Manutenção"), equipeId: equipeOk(bruto.equipeId), veiculoId: idOk(bruto.veiculoId, "Veículo") };
  })
  .handler(async ({ context, data }) => {
    const sql = await preparar(context.userId, data.equipeId);
    await veiculoDoEscopo(sql, context.userId, data.equipeId, data.veiculoId);
    await sql`delete from frota_manutencoes where id = ${data.id} and veiculo_id = ${data.veiculoId}`;
    return { ok: true };
  });

export const salvarMulta = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => {
    if (!input || typeof input !== "object") throw new Error("Dados inválidos");
    const bruto = input as Record<string, unknown>;
    const gravidade = texto(bruto.gravidade, 20, "a gravidade");
    if (!GRAVIDADES.includes(gravidade)) throw new Error("Gravidade inválida.");
    return {
      id: opcional(bruto.id, 80),
      equipeId: equipeOk(bruto.equipeId),
      veiculoId: idOk(bruto.veiculoId, "Veículo"),
      condutorId: opcional(bruto.condutorId, 80),
      data: dataOk(bruto.data, "A data"),
      local: texto(bruto.local, 160, "o local"),
      gravidade,
      valor: dinheiro(bruto.valor),
      desconto: bruto.desconto === true,
      pontos: inteiro(bruto.pontos, "Os pontos", 20),
    };
  })
  .handler(async ({ context, data }) => {
    const sql = await preparar(context.userId, data.equipeId);
    await veiculoDoEscopo(sql, context.userId, data.equipeId, data.veiculoId);
    const id = data.id || crypto.randomUUID();
    let pontosAntes = 0;
    let condutorAntes = "";
    if (data.id) {
      const atual = await sql<{ pontos: number; condutor_id: string }>`select pontos, condutor_id from frota_multas where id = ${id} and veiculo_id = ${data.veiculoId}`;
      if (!atual.length) throw new Error("Multa não encontrada.");
      pontosAntes = Number(atual[0].pontos);
      condutorAntes = atual[0].condutor_id;
      await sql`
        update frota_multas set
          condutor_id = ${data.condutorId}, data = ${data.data}, local = ${data.local}, gravidade = ${data.gravidade},
          valor = ${data.valor}, desconto = ${data.desconto}, pontos = ${data.pontos}
        where id = ${id}
      `;
    } else {
      await sql`
        insert into frota_multas (id, veiculo_id, condutor_id, user_id, data, local, gravidade, valor, desconto, pontos)
        values (${id}, ${data.veiculoId}, ${data.condutorId}, ${context.userId}, ${data.data}, ${data.local}, ${data.gravidade}, ${data.valor}, ${data.desconto}, ${data.pontos})
      `;
    }
    if (condutorAntes && condutorAntes !== data.condutorId) {
      await sql`update frota_condutores set pontuacao = greatest(0, pontuacao - ${pontosAntes}) where id = ${condutorAntes}`;
      pontosAntes = 0;
    }
    if (data.condutorId) {
      const delta = data.pontos - (condutorAntes === data.condutorId ? pontosAntes : 0);
      await sql`update frota_condutores set pontuacao = greatest(0, pontuacao + ${delta}) where id = ${data.condutorId}`;
    }
    return { id };
  });

export const excluirMulta = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => {
    if (!input || typeof input !== "object") throw new Error("Dados inválidos");
    const bruto = input as Record<string, unknown>;
    return { id: idOk(bruto.id, "Multa"), equipeId: equipeOk(bruto.equipeId), veiculoId: idOk(bruto.veiculoId, "Veículo") };
  })
  .handler(async ({ context, data }) => {
    const sql = await preparar(context.userId, data.equipeId);
    await veiculoDoEscopo(sql, context.userId, data.equipeId, data.veiculoId);
    const atual = await sql<{ pontos: number; condutor_id: string }>`select pontos, condutor_id from frota_multas where id = ${data.id}`;
    if (atual[0]?.condutor_id) {
      await sql`update frota_condutores set pontuacao = greatest(0, pontuacao - ${Number(atual[0].pontos)}) where id = ${atual[0].condutor_id}`;
    }
    await sql`delete from frota_multas where id = ${data.id} and veiculo_id = ${data.veiculoId}`;
    return { ok: true };
  });

export const salvarSinistro = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => {
    if (!input || typeof input !== "object") throw new Error("Dados inválidos");
    const bruto = input as Record<string, unknown>;
    return {
      id: opcional(bruto.id, 80),
      equipeId: equipeOk(bruto.equipeId),
      veiculoId: idOk(bruto.veiculoId, "Veículo"),
      condutorId: opcional(bruto.condutorId, 80),
      data: dataOk(bruto.data, "A data"),
      boletim: opcional(bruto.boletim, 40),
      avaria: texto(bruto.avaria, 200, "a avaria"),
      custo: dinheiro(bruto.custo),
      relato: opcional(bruto.relato, 500),
    };
  })
  .handler(async ({ context, data }) => {
    const sql = await preparar(context.userId, data.equipeId);
    await veiculoDoEscopo(sql, context.userId, data.equipeId, data.veiculoId);
    const id = data.id || crypto.randomUUID();
    if (data.id) {
      const atual = await sql<{ id: string }>`select id from frota_sinistros where id = ${id} and veiculo_id = ${data.veiculoId}`;
      if (!atual.length) throw new Error("Sinistro não encontrado.");
      await sql`
        update frota_sinistros set
          condutor_id = ${data.condutorId}, data = ${data.data}, boletim = ${data.boletim}, avaria = ${data.avaria}, custo = ${data.custo}, relato = ${data.relato}
        where id = ${id}
      `;
    } else {
      await sql`
        insert into frota_sinistros (id, veiculo_id, condutor_id, user_id, data, boletim, avaria, custo, relato)
        values (${id}, ${data.veiculoId}, ${data.condutorId}, ${context.userId}, ${data.data}, ${data.boletim}, ${data.avaria}, ${data.custo}, ${data.relato})
      `;
    }
    return { id };
  });

export const excluirSinistro = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => {
    if (!input || typeof input !== "object") throw new Error("Dados inválidos");
    const bruto = input as Record<string, unknown>;
    return { id: idOk(bruto.id, "Sinistro"), equipeId: equipeOk(bruto.equipeId), veiculoId: idOk(bruto.veiculoId, "Veículo") };
  })
  .handler(async ({ context, data }) => {
    const sql = await preparar(context.userId, data.equipeId);
    await veiculoDoEscopo(sql, context.userId, data.equipeId, data.veiculoId);
    await sql`delete from frota_sinistros where id = ${data.id} and veiculo_id = ${data.veiculoId}`;
    return { ok: true };
  });

function horaCheia(valor: unknown, nome: string) {
  if (typeof valor !== "string" || !/^\d{2}:\d{2}$/.test(valor)) throw new Error(`${nome} inválido.`);
  return valor;
}

function agoraSaoPaulo() {
  const partes = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date());
  const ler = (tipo: string) => partes.find((item) => item.type === tipo)?.value ?? "";
  return { dia: `${ler("year")}-${ler("month")}-${ler("day")}`, hora: `${ler("hour")}:${ler("minute")}` };
}

export const salvarAgendamento = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => {
    if (!input || typeof input !== "object") throw new Error("Dados inválidos");
    const bruto = input as Record<string, unknown>;
    const horaInicio = horaCheia(bruto.horaInicio, "A hora de início");
    const horaFim = horaCheia(bruto.horaFim, "A hora de término");
    if (horaFim <= horaInicio) throw new Error("O término precisa ser depois do início.");
    return {
      equipeId: equipeOk(bruto.equipeId),
      veiculoId: idOk(bruto.veiculoId, "Veículo"),
      nome: texto(bruto.nome, 80, "o seu nome"),
      dia: dataOk(bruto.dia, "O dia"),
      horaInicio,
      horaFim,
    };
  })
  .handler(async ({ context, data }) => {
    const sql = await preparar(context.userId, data.equipeId);
    await veiculoDoEscopo(sql, context.userId, data.equipeId, data.veiculoId);
    const choque = await sql<{ id: string }>`
      select id from frota_agendamentos
      where veiculo_id = ${data.veiculoId} and dia = ${data.dia}
        and hora_inicio < ${data.horaFim} and hora_fim > ${data.horaInicio}
        and hora_retorno = ''
    `;
    if (choque.length) throw new Error("Esse veículo já está agendado nesse horário.");
    const id = crypto.randomUUID();
    await sql`
      insert into frota_agendamentos (id, veiculo_id, user_id, nome, dia, hora_inicio, hora_fim)
      values (${id}, ${data.veiculoId}, ${context.userId}, ${data.nome}, ${data.dia}, ${data.horaInicio}, ${data.horaFim})
    `;
    return { id };
  });

export const excluirAgendamento = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => {
    if (!input || typeof input !== "object") throw new Error("Dados inválidos");
    const bruto = input as Record<string, unknown>;
    return { id: idOk(bruto.id, "Agendamento"), equipeId: equipeOk(bruto.equipeId), veiculoId: idOk(bruto.veiculoId, "Veículo") };
  })
  .handler(async ({ context, data }) => {
    const sql = await preparar(context.userId, data.equipeId);
    await veiculoDoEscopo(sql, context.userId, data.equipeId, data.veiculoId);
    const atual = await sql<{ hora_saida: string }>`select hora_saida from frota_agendamentos where id = ${data.id} and veiculo_id = ${data.veiculoId}`;
    if (!atual.length) throw new Error("Agendamento não encontrado.");
    if (atual[0].hora_saida) throw new Error("Essa saída já foi lançada e não pode ser desmarcada.");
    await sql`delete from frota_agendamentos where id = ${data.id}`;
    return { ok: true };
  });

export const lancarSaidaAgendada = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => {
    if (!input || typeof input !== "object") throw new Error("Dados inválidos");
    const bruto = input as Record<string, unknown>;
    return {
      id: idOk(bruto.id, "Agendamento"),
      equipeId: equipeOk(bruto.equipeId),
      horaSaida: horaCheia(bruto.horaSaida, "A hora da saída"),
      kmSaida: kmOk(bruto.kmSaida, "A quilometragem de saída"),
    };
  })
  .handler(async ({ context, data }) => {
    const sql = await preparar(context.userId, data.equipeId);
    const item = await sql<{ veiculo_id: string; user_id: string; dia: string; hora_inicio: string; hora_fim: string; hora_saida: string }>`
      select veiculo_id, user_id, dia, hora_inicio, hora_fim, hora_saida from frota_agendamentos where id = ${data.id}
    `;
    if (!item.length || item[0].user_id !== context.userId) throw new Error("Agendamento não encontrado.");
    if (item[0].hora_saida) throw new Error("A saída já foi lançada.");
    const agora = agoraSaoPaulo();
    const diaAgora = dia(item[0].dia);
    if (agora.dia !== diaAgora || agora.hora < item[0].hora_inicio || agora.hora > item[0].hora_fim) {
      throw new Error("A saída só pode ser lançada dentro do horário agendado.");
    }
    await veiculoDoEscopo(sql, context.userId, data.equipeId, item[0].veiculo_id);
    const veiculo = await sql<{ km: number; situacao: string }>`select km, situacao from frota_veiculos where id = ${item[0].veiculo_id}`;
    if (veiculo[0]?.situacao === "em_uso") throw new Error("Este veículo já está em uma saída.");
    if (data.kmSaida < Number(veiculo[0]?.km ?? 0)) throw new Error("A quilometragem de saída não pode ser menor que a atual.");
    await sql`update frota_agendamentos set hora_saida = ${data.horaSaida}, km_saida = ${data.kmSaida} where id = ${data.id}`;
    await sql`update frota_veiculos set situacao = 'em_uso', km = ${data.kmSaida} where id = ${item[0].veiculo_id}`;
    return { ok: true };
  });

export const lancarRetornoAgendado = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => {
    if (!input || typeof input !== "object") throw new Error("Dados inválidos");
    const bruto = input as Record<string, unknown>;
    return {
      id: idOk(bruto.id, "Agendamento"),
      equipeId: equipeOk(bruto.equipeId),
      horaRetorno: horaCheia(bruto.horaRetorno, "A hora do retorno"),
      kmRetorno: kmOk(bruto.kmRetorno, "A quilometragem de retorno"),
    };
  })
  .handler(async ({ context, data }) => {
    const sql = await preparar(context.userId, data.equipeId);
    const item = await sql<{ veiculo_id: string; user_id: string; hora_saida: string; km_saida: number | null; hora_retorno: string }>`
      select veiculo_id, user_id, hora_saida, km_saida, hora_retorno from frota_agendamentos where id = ${data.id}
    `;
    if (!item.length || item[0].user_id !== context.userId) throw new Error("Agendamento não encontrado.");
    if (!item[0].hora_saida) throw new Error("Lance a saída antes do retorno.");
    if (item[0].hora_retorno) throw new Error("O retorno já foi lançado.");
    if (item[0].km_saida != null && data.kmRetorno < Number(item[0].km_saida)) throw new Error("A quilometragem de retorno não pode ser menor que a da saída.");
    await veiculoDoEscopo(sql, context.userId, data.equipeId, item[0].veiculo_id);
    await sql`update frota_agendamentos set hora_retorno = ${data.horaRetorno}, km_retorno = ${data.kmRetorno} where id = ${data.id}`;
    await sql`update frota_veiculos set situacao = 'disponivel', km = ${data.kmRetorno} where id = ${item[0].veiculo_id}`;
    return { ok: true };
  });

