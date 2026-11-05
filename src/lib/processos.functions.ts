import { createServerFn } from "@tanstack/react-start";
import { getSql } from "@/lib/db";
import { authMiddleware } from "@/lib/auth/middleware";
import { TIPOS_LEI, type AlcanceVeto, type Andamento, type Processo, type RetornoLegislativo, type StatusProcesso, type TipoLei, type TipoProcesso } from "@/lib/prazos";

function exigirProcesso(input: unknown): Processo {
  if (!input || typeof input !== "object") throw new Error("Dados inválidos");
  const bruto = input as Partial<Processo>;
  const numero = typeof bruto.numero === "string" ? bruto.numero.trim() : "";
  const parte = typeof bruto.parte === "string" ? bruto.parte.trim() : "";
  const assunto = typeof bruto.assunto === "string" ? bruto.assunto.trim() : "";
  const id = typeof bruto.id === "string" ? bruto.id.trim() : "";
  if (!id || !numero || !parte || !assunto) throw new Error("Dados inválidos");
  const tipo = typeof bruto.tipo === "string" ? bruto.tipo.trim().replace(/\s+/g, " ") : "";
  if (!/^[\p{L}\p{N}][\p{L}\p{N} .\/'-]{1,39}$/u.test(tipo)) throw new Error("Tipo inválido");
  if (typeof bruto.status !== "string" || !/^[a-z0-9-]{2,40}$/.test(bruto.status)) throw new Error("Status inválido");
  if (!dataOk(bruto.dataLancamento) || !dataOk(bruto.prazo)) throw new Error("Data inválida");
  const alerta = Number(bruto.alertaDias);
  if (!Number.isInteger(alerta) || alerta < 0 || alerta > 60) throw new Error("Antecedência inválida");
  const retorno = retornoOk(bruto.retorno);
  const vetoAlcance = alcanceOk(bruto.vetoAlcance);
  const leiTipo = leiTipoOk(bruto.leiTipo);
  const leiNumero = numeroOk(bruto.leiNumero);
  const leiAno = anoOk(bruto.leiAno);
  const apreciacaoPrazo = dataOpcional(bruto.apreciacaoPrazo);
  if (retorno === "veto") {
    if (!vetoAlcance) throw new Error("Informe se o veto é integral ou parcial.");
    if (leiNumero == null || leiAno == null) throw new Error("Informe o número e o ano do veto.");
    if (!apreciacaoPrazo) throw new Error("Informe o prazo de apreciação do veto.");
  }
  if (retorno === "sancionada") {
    if (!leiTipo) throw new Error("Informe o tipo de lei.");
    if (leiNumero == null || leiAno == null) throw new Error("Informe o número e o ano da lei.");
  }
  return {
    id: id.slice(0, 80),
    numero: numero.slice(0, 80),
    parte: parte.slice(0, 160),
    assunto: assunto.slice(0, 240),
    tipo: tipo as TipoProcesso,
    dataLancamento: bruto.dataLancamento as string,
    prazo: bruto.prazo as string,
    alertaDias: alerta,
    status: bruto.status,
    historico: historicoOk(bruto.historico),
    equipeId: equipeIdOk(bruto.equipeId),
    autorId: typeof bruto.autorId === "string" && bruto.autorId.trim() ? bruto.autorId.trim().slice(0, 80) : null,
    autorNome: typeof bruto.autorNome === "string" ? bruto.autorNome.trim().slice(0, 80) : "",
    retorno,
    vetoAlcance: retorno === "veto" ? vetoAlcance : null,
    leiTipo: retorno === "sancionada" ? leiTipo : null,
    leiNumero: retorno ? leiNumero : null,
    leiAno: retorno ? leiAno : null,
    apreciacaoPrazo: retorno === "veto" ? apreciacaoPrazo : null,
  };
}

function equipeIdOk(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const id = value.trim();
  return id ? id.slice(0, 80) : null;
}

function dataOk(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function dataOpcional(value: unknown): string | null {
  if (value == null || value === "") return null;
  if (!dataOk(value)) throw new Error("Data inválida");
  return value;
}

function retornoOk(value: unknown): RetornoLegislativo | null {
  if (value == null || value === "") return null;
  if (value === "veto" || value === "sancionada") return value;
  throw new Error("Retorno inválido");
}

function alcanceOk(value: unknown): AlcanceVeto | null {
  if (value == null || value === "") return null;
  if (value === "integral" || value === "parcial") return value;
  return null;
}

function leiTipoOk(value: unknown): TipoLei | null {
  if (typeof value !== "string" || !value.trim()) return null;
  return (TIPOS_LEI as readonly string[]).includes(value) ? (value as TipoLei) : null;
}

function numeroOk(value: unknown): number | null {
  if (value == null || value === "") return null;
  const n = Number(value);
  if (!Number.isInteger(n) || n < 1 || n > 999999) throw new Error("Número inválido");
  return n;
}

function anoOk(value: unknown): number | null {
  if (value == null || value === "") return null;
  const n = Number(value);
  if (!Number.isInteger(n) || n < 2000 || n > 2100) throw new Error("Ano inválido");
  return n;
}

let schemaPronto: Promise<void> | null = null;

async function garantirColunas(sql: Awaited<ReturnType<typeof getSql>>) {
  if (!schemaPronto) {
    schemaPronto = (async () => {
      const comandos = [
        "alter table processos add column if not exists retorno text",
        "alter table processos add column if not exists veto_alcance text",
        "alter table processos add column if not exists lei_tipo text",
        "alter table processos add column if not exists lei_numero integer",
        "alter table processos add column if not exists lei_ano integer",
        "alter table processos add column if not exists apreciacao_prazo date",
        "alter table processos add column if not exists em_manutencao boolean not null default false",
      ];
      for (const comando of comandos) await sql.query(comando);
    })().catch((err) => {
      schemaPronto = null;
      throw err;
    });
  }
  await schemaPronto;
}

const SELECT_PROC = `
  p.id, p.numero, p.parte, p.assunto, p.tipo, p.data_lancamento, p.prazo,
  p.alerta_dias, p.status, p.historico, p.team_id, p.retorno, p.veto_alcance,
  p.lei_tipo, p.lei_numero, p.lei_ano, p.apreciacao_prazo,
  coalesce(nullif(p.autor_id, ''), p.user_id) as autor_id,
  coalesce(nullif(p.autor_nome, ''), u.name, '') as autor_nome
`;

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
        ...(typeof nota.link === "string" && /^https?:\/\//i.test(nota.link.trim()) ? { link: nota.link.trim().slice(0, 500) } : {}),
      },
    ];
  });
}

type Linha = {
  id: string;
  numero: string;
  parte: string;
  assunto: string;
  tipo: string;
  data_lancamento: string;
  prazo: string;
  alerta_dias: number;
  status: string;
  historico: string;
  retorno: string | null;
  veto_alcance: string | null;
  lei_tipo: string | null;
  lei_numero: number | null;
  lei_ano: number | null;
  apreciacao_prazo: string | null;
  team_id: string | null;
  autor_id: string | null;
  autor_nome: string;
};

function linhaParaProcesso(linha: Linha): Processo {
  let historico: Andamento[] = [];
  try {
    historico = historicoOk(JSON.parse(linha.historico));
  } catch {
    historico = [];
  }
  const tipo = typeof linha.tipo === "string" && linha.tipo.trim() ? (linha.tipo as TipoProcesso) : "Outros";
  const status = typeof linha.status === "string" && /^[a-z0-9-]{2,40}$/.test(linha.status) ? linha.status : "andamento";
  return {
    id: linha.id,
    numero: linha.numero,
    parte: linha.parte,
    assunto: linha.assunto,
    tipo,
    dataLancamento: String(linha.data_lancamento).slice(0, 10),
    prazo: String(linha.prazo).slice(0, 10),
    alertaDias: Number(linha.alerta_dias),
    status,
    historico,
    equipeId: linha.team_id,
    autorId: linha.autor_id,
    autorNome: linha.autor_nome ?? "",
    retorno: linha.retorno === "veto" || linha.retorno === "sancionada" ? linha.retorno : null,
    vetoAlcance: linha.veto_alcance === "integral" || linha.veto_alcance === "parcial" ? linha.veto_alcance : null,
    leiTipo: leiTipoOk(linha.lei_tipo),
    leiNumero: linha.lei_numero,
    leiAno: linha.lei_ano,
    apreciacaoPrazo: linha.apreciacao_prazo ? String(linha.apreciacao_prazo).slice(0, 10) : null,
  };
}

export async function processosDaConta(userId: string, equipeId: string | null) {
  const sql = await getSql();
  await garantirColunas(sql);
  if (!equipeId) {
    const linhas = await sql.query<Linha>(
      `select ${SELECT_PROC}
       from processos p
       left join "user" u on u.id = p.user_id
       where p.user_id = $1 and p.team_id is null
       order by p.prazo asc`,
      [userId],
    );
    return linhas.map(linhaParaProcesso);
  }
  const membro = await sql<{ ok: number }>`
    select 1 as ok from equipe_membros where equipe_id = ${equipeId} and user_id = ${userId}
  `;
  if (!membro.length) throw new Error("Você não faz parte desta equipe.");
  const linhas = await sql.query<Linha>(
    `select ${SELECT_PROC}
     from processos p
     left join "user" u on u.id = p.user_id
     where p.team_id = $1
     order by p.prazo asc`,
    [equipeId],
  );
  return linhas.map(linhaParaProcesso);
}

export const listarProcessos = createServerFn({ method: "GET" })
  .validator((equipeId: unknown) => {
    if (equipeId == null || equipeId === "") return null;
    if (typeof equipeId !== "string" || !equipeId.trim()) throw new Error("Dados inválidos");
    return equipeId.trim().slice(0, 80);
  })
  .middleware([authMiddleware])
  .handler(async ({ context, data: equipeId }) => processosDaConta(context.userId, equipeId));

export const salvarProcesso = createServerFn({ method: "POST" })
  .validator(exigirProcesso)
  .middleware([authMiddleware])
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    await garantirColunas(sql);
    const { conferirAba, anotarUso, exigirEscrita } = await import("./gestao.server");
    await exigirEscrita(context.userId);
    await conferirAba("legislativo", data.tipo);
    const eu = await sql<{ name: string | null }>`select name from "user" where id = ${context.userId}`;
    const autorNome = (eu[0]?.name || "Sem nome").trim().slice(0, 80) || "Sem nome";
    if (data.equipeId) {
      const membro = await sql<{ ok: number }>`
        select 1 as ok from equipe_membros where equipe_id = ${data.equipeId} and user_id = ${context.userId}
      `;
      if (!membro.length) throw new Error("Você não faz parte desta equipe.");
    }
    const existente = await sql<{ historico: string; user_id: string; team_id: string | null }>`
      select historico, user_id, team_id from processos where id = ${data.id}
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
        { id: crypto.randomUUID(), em: new Date().toISOString(), texto: "Lançou o processo.", autorNome },
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
          update processos set
            numero = ${data.numero},
            parte = ${data.parte},
            assunto = ${data.assunto},
            tipo = ${data.tipo},
            data_lancamento = ${data.dataLancamento},
            prazo = ${data.prazo},
            alerta_dias = ${data.alertaDias},
            status = ${data.status},
            historico = ${historicoJson},
            retorno = ${data.retorno},
            veto_alcance = ${data.vetoAlcance},
            lei_tipo = ${data.leiTipo},
            lei_numero = ${data.leiNumero},
            lei_ano = ${data.leiAno},
            apreciacao_prazo = ${data.apreciacaoPrazo}
          where id = ${data.id}
            and (
              (${data.equipeId}::text is not null and team_id = ${data.equipeId})
              or (${data.equipeId}::text is null and team_id is null and user_id = ${context.userId})
            )
          returning id
        `
      : await sql<{ id: string }>`
          insert into processos (
            id, user_id, numero, parte, assunto, tipo, data_lancamento, prazo, alerta_dias, status, historico, team_id, autor_id, autor_nome,
            retorno, veto_alcance, lei_tipo, lei_numero, lei_ano, apreciacao_prazo, em_manutencao
          ) values (
            ${data.id}, ${context.userId}, ${data.numero}, ${data.parte}, ${data.assunto}, ${data.tipo},
            ${data.dataLancamento}, ${data.prazo}, ${data.alertaDias}, ${data.status}, ${historicoJson},
            ${data.equipeId}, ${context.userId}, ${autorNome},
            ${data.retorno}, ${data.vetoAlcance}, ${data.leiTipo}, ${data.leiNumero}, ${data.leiAno}, ${data.apreciacaoPrazo},
            false
          )
          returning id
        `;
    if (!salvos.length) throw new Error("Não foi possível salvar");
    if (!existente.length) {
      const { backupAoLancar } = await import("./gestao.server");
      await backupAoLancar();
    }
    void anotarUso(context.userId, existente.length ? "Alterou processo legislativo" : "Lançou processo legislativo", `${data.numero} · ${data.tipo}`).catch(() => undefined);
    return { id: salvos[0].id };
  });

export const apagarProcesso = createServerFn({ method: "POST" })
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
      delete from processos
      where id = ${id}
        and (
          (team_id is null and user_id = ${context.userId})
          or team_id in (select equipe_id from equipe_membros where user_id = ${context.userId})
        )
    `;
    void anotarUso(context.userId, "Excluiu processo legislativo", id).catch(() => undefined);
    return { id };
  });

export const moverProcesso = createServerFn({ method: "POST" })
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
    const { exigirEscrita } = await import("./gestao.server");
    await exigirEscrita(context.userId);
    if (data.equipeId) {
      const membro = await sql<{ ok: number }>`
        select 1 as ok from equipe_membros where equipe_id = ${data.equipeId} and user_id = ${context.userId}
      `;
      if (!membro.length) throw new Error("Você não faz parte desta equipe.");
    }
    const existente = await sql<{ historico: string; user_id: string; team_id: string | null }>`
      select historico, user_id, team_id from processos where id = ${data.id}
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
      const lido = JSON.parse(row.historico || "[]") as unknown;
      historico = Array.isArray(lido) ? (lido as Andamento[]) : [];
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
      update processos
      set team_id = ${data.equipeId}, user_id = ${dono}, historico = ${JSON.stringify(historico)}
      where id = ${data.id}
      returning id
    `;
    if (!salvos.length) throw new Error("Não foi possível mover");
    return { id: salvos[0].id };
  });
