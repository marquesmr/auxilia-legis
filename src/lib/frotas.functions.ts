import { createServerFn } from "@tanstack/react-start";
import { getSql } from "@/lib/db";
import { authMiddleware } from "@/lib/auth/middleware";

export type SituacaoFrota = "disponivel" | "em_uso" | "manutencao" | "baixado";

export type VeiculoFrota = {
  id: string;
  placa: string;
  descricao: string;
  ano: number | null;
  tipo: string;
  combustivel: string;
  km: number;
  situacao: SituacaoFrota;
  setor: string;
  equipeId: string | null;
};

export type SaidaFrota = {
  id: string;
  veiculoId: string;
  motorista: string;
  destino: string;
  motivo: string;
  saidaEm: string;
  kmSaida: number;
  retornoEm: string | null;
  kmRetorno: number | null;
};

const TIPOS = ["Carro", "Moto", "Van", "Caminhão", "Ônibus", "Outro"];
const COMBUSTIVEIS = ["Flex", "Gasolina", "Etanol", "Diesel", "Elétrico"];
const SITUACOES: SituacaoFrota[] = ["disponivel", "em_uso", "manutencao", "baixado"];

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

function dia(valor: unknown) {
  if (valor instanceof Date) return valor.toISOString().slice(0, 10);
  return String(valor ?? "").slice(0, 10);
}

export const listarFrotas = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => equipeOk(input && typeof input === "object" ? (input as { equipeId?: unknown }).equipeId : input))
  .handler(async ({ context, data: equipeId }) => {
    await exigirAdminFrota(context.userId);
    const sql = await garantirFrota();
    await exigirEquipe(context.userId, equipeId);
    const veiculos = equipeId
      ? await sql<{ id: string; placa: string; descricao: string; ano: number | null; tipo: string; combustivel: string; km: number; situacao: string; setor: string; team_id: string | null }>`
          select id, placa, descricao, ano, tipo, combustivel, km, situacao, setor, team_id
          from frota_veiculos where team_id = ${equipeId} order by placa
        `
      : await sql<{ id: string; placa: string; descricao: string; ano: number | null; tipo: string; combustivel: string; km: number; situacao: string; setor: string; team_id: string | null }>`
          select id, placa, descricao, ano, tipo, combustivel, km, situacao, setor, team_id
          from frota_veiculos where user_id = ${context.userId} and team_id is null order by placa
        `;
    const saidas = equipeId
      ? await sql<{ id: string; veiculo_id: string; motorista: string; destino: string; motivo: string; saida_em: string; km_saida: number; retorno_em: string | null; km_retorno: number | null }>`
          select s.id, s.veiculo_id, s.motorista, s.destino, s.motivo, s.saida_em, s.km_saida, s.retorno_em, s.km_retorno
          from frota_saidas s
          join frota_veiculos v on v.id = s.veiculo_id
          where v.team_id = ${equipeId}
          order by s.saida_em desc, s.created_at desc
        `
      : await sql<{ id: string; veiculo_id: string; motorista: string; destino: string; motivo: string; saida_em: string; km_saida: number; retorno_em: string | null; km_retorno: number | null }>`
          select s.id, s.veiculo_id, s.motorista, s.destino, s.motivo, s.saida_em, s.km_saida, s.retorno_em, s.km_retorno
          from frota_saidas s
          join frota_veiculos v on v.id = s.veiculo_id
          where v.user_id = ${context.userId} and v.team_id is null
          order by s.saida_em desc, s.created_at desc
        `;
    return {
      veiculos: veiculos.map((item) => ({
        id: item.id,
        placa: item.placa,
        descricao: item.descricao,
        ano: item.ano,
        tipo: item.tipo,
        combustivel: item.combustivel,
        km: Number(item.km),
        situacao: situacaoOk(item.situacao),
        setor: item.setor,
        equipeId: item.team_id,
      })),
      saidas: saidas.map((item) => ({
        id: item.id,
        veiculoId: item.veiculo_id,
        motorista: item.motorista,
        destino: item.destino,
        motivo: item.motivo,
        saidaEm: dia(item.saida_em),
        kmSaida: Number(item.km_saida),
        retornoEm: item.retorno_em ? dia(item.retorno_em) : null,
        kmRetorno: item.km_retorno == null ? null : Number(item.km_retorno),
      })),
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
      ano: anoOk(bruto.ano),
      tipo,
      combustivel,
      km: kmOk(bruto.km, "A quilometragem"),
      situacao: situacaoOk(bruto.situacao),
      setor: typeof bruto.setor === "string" ? bruto.setor.trim().slice(0, 80) : "",
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
          ano = ${data.ano},
          tipo = ${data.tipo},
          combustivel = ${data.combustivel},
          km = ${data.km},
          situacao = ${data.situacao},
          setor = ${data.setor}
        where id = ${id}
      `;
    } else {
      await sql`
        insert into frota_veiculos (id, user_id, team_id, placa, descricao, ano, tipo, combustivel, km, situacao, setor)
        values (${id}, ${context.userId}, ${data.equipeId}, ${data.placa}, ${data.descricao}, ${data.ano}, ${data.tipo}, ${data.combustivel}, ${data.km}, ${data.situacao}, ${data.setor})
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
    return {
      veiculoId,
      equipeId: equipeOk(bruto.equipeId),
      motorista: texto(bruto.motorista, 80, "o motorista"),
      destino: texto(bruto.destino, 120, "o destino"),
      motivo: typeof bruto.motivo === "string" ? bruto.motivo.trim().slice(0, 200) : "",
      saidaEm: dataOk(bruto.saidaEm, "A data de saída"),
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
      insert into frota_saidas (id, veiculo_id, user_id, motorista, destino, motivo, saida_em, km_saida)
      values (${id}, ${data.veiculoId}, ${context.userId}, ${data.motorista}, ${data.destino}, ${data.motivo}, ${data.saidaEm}, ${data.kmSaida})
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
      kmRetorno: kmOk(bruto.kmRetorno, "A quilometragem de retorno"),
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
    await sql`update frota_saidas set retorno_em = ${data.retornoEm}, km_retorno = ${data.kmRetorno} where id = ${data.saidaId}`;
    await sql`update frota_veiculos set situacao = 'disponivel', km = ${data.kmRetorno} where id = ${veiculoId}`;
    return { ok: true };
  });
