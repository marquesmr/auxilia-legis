import { pendingMigrations } from "../../scripts/migration-plan.mjs";
import {
  buscarCopia,
  conflitoDeGravacao,
  etagAtual,
  gravarCopia,
  nuvemConfigurada,
} from "./banco-nuvem";

/** Qual banco está ativo. */
export type DbSource = "neon" | "pglite";

// DATABASE_URL vazio conta como ausente. Senão a produção cairia no PGLite sem avisar.
const rawDatabaseUrl =
  typeof process !== "undefined" ? process.env.DATABASE_URL : undefined;
const databaseUrl =
  rawDatabaseUrl && rawDatabaseUrl.trim() ? rawDatabaseUrl : undefined;

/** Neon se houver DATABASE_URL; senão PGLite embutido, inclusive na prévia. */
export const dbSource: DbSource = databaseUrl ? "neon" : "pglite";

/** Consulta compartilhada: template marcado ou `.query()`, sempre um array de linhas. */
export interface Sql {
  <T = Record<string, unknown>>(
    strings: TemplateStringsArray,
    ...values: unknown[]
  ): Promise<T[]>;
  query<T = Record<string, unknown>>(
    text: string,
    params?: unknown[],
  ): Promise<T[]>;
}

/** Promessas no globalThis: o HMR recria o módulo e duas iniciais correndo abririam outro pool ou repetiriam a migração. Falha limpa o slot para a próxima tentativa. */
const globalRef = globalThis as typeof globalThis & {
  __pgSqlPromise__?: Promise<Sql>;
};

/** pg e PGLite leem os tipos de forma diferente. Int8 vira número, data vira AAAA-MM-DD, intervalo vira texto. Acima de 2^53 o int8 perde precisão. */
const OID_INT8 = 20;
const OID_DATE = 1082;
const OID_INTERVAL = 1186;
const identity = (v: string) => v;

type Run = <T>(text: string, params: unknown[]) => Promise<T[]>;

type Trafego = { consultas: number; bytesIda: number; bytesVolta: number; desde: number };

function somarTrafego(ida: number, volta: number) {
  const caixa = globalThis as typeof globalThis & { __appTrafego__?: Trafego };
  const atual = (caixa.__appTrafego__ ??= { consultas: 0, bytesIda: 0, bytesVolta: 0, desde: Date.now() });
  atual.consultas += 1;
  atual.bytesIda += ida;
  atual.bytesVolta += volta;
}

export function lerTrafego(): Trafego {
  const caixa = globalThis as typeof globalThis & { __appTrafego__?: Trafego };
  return { ...(caixa.__appTrafego__ ?? { consultas: 0, bytesIda: 0, bytesVolta: 0, desde: Date.now() }) };
}

/** Envolve o executor na interface Sql. */
function toSql(run: Run): Sql {
  const medido: Run = async <T>(text: string, params: unknown[]) => {
    const ida =
      Buffer.byteLength(text) +
      params.reduce((total: number, valor) => total + Buffer.byteLength(valor == null ? "" : String(valor)), 0);
    const rows = await run<T>(text, params);
    let volta = 0;
    try {
      volta = Buffer.byteLength(JSON.stringify(rows));
    } catch {
      volta = 0;
    }
    somarTrafego(ida, volta);
    return rows;
  };
  const sql = (async <T = Record<string, unknown>>(
    strings: TemplateStringsArray,
    ...values: unknown[]
  ): Promise<T[]> => {
    let text = strings[0];
    for (let i = 0; i < values.length; i += 1) text += `$${i + 1}${strings[i + 1]}`;
    return medido<T>(text, values);
  }) as unknown as Sql;
  sql.query = <T = Record<string, unknown>>(text: string, params: unknown[] = []) => medido<T>(text, params);
  return sql;
}

function createNeonSql(): Promise<Sql> {
  globalRef.__pgSqlPromise__ ??= (async () => {
    // Um pool por processo. Instância quente da Vercel reaproveita.
    const { Pool, types } = await import("pg");
    types.setTypeParser(OID_INT8, Number);
    types.setTypeParser(OID_DATE, identity);
    types.setTypeParser(OID_INTERVAL, identity);
    const pool = new Pool({ connectionString: databaseUrl });
    return toSql(async <T>(text: string, params: unknown[]) => {
      const res = await pool.query(text, params);
      return res.rows as T[];
    });
  })().catch((err) => {
    globalRef.__pgSqlPromise__ = undefined;
    throw err;
  });
  return globalRef.__pgSqlPromise__;
}

async function createPgliteSql(): Promise<Sql> {
  await exclusivo(() => alinharComNuvem());
  return toSql(async <T>(text: string, params: unknown[]) => {
    const resultado = await consultarPglite<T>(text, params);
    return resultado.rows;
  });
}

let sqlPromise: Promise<Sql> | null = null;

async function createSql(): Promise<Sql> {
  if (typeof window !== "undefined") {
    throw new Error(
      "@/lib/db is server-only — call getSql() from a createServerFn handler " +
        "or a server route loader, never from client code.",
    );
  }
  return dbSource === "neon" ? createNeonSql() : createPgliteSql();
}

/** Cliente SQL só no servidor. Neon ou PGLite, memoizado. O esquema vem de migrations/*.sql, nunca inline. */
export function getSql(): Promise<Sql> {
  sqlPromise ??= createSql().catch((err) => {
    sqlPromise = null; // falha não fica memorizada
    throw err;
  });
  return sqlPromise;
}

/** PGLite da prévia, o mesmo do Better Auth. Com DATABASE_URL, lança erro. */
export async function getPglite(): Promise<import("@electric-sql/pglite").PGlite> {
  if (dbSource !== "pglite") {
    throw new Error("getPglite() is only available on the PGLite fallback (no DATABASE_URL)");
  }
  await exclusivo(() => alinharComNuvem());
  const pg = estadoBanco().pg;
  if (!pg) throw new Error("PGLite instance failed to initialize");
  return pg;
}

/** Abre o PGLite e aplica as migrações antes do tráfego. No Neon não faz nada. */
export function ensureDbReady(): Promise<void> {
  if (dbSource !== "pglite") return Promise.resolve();
  return getSql().then(() => undefined);
}

// Sobe o PGLite assim que o módulo carrega no Node. No navegador este caminho não roda.
const globalBoot = globalThis as typeof globalThis & {
  __pgBootstrapPromise__?: Promise<void>;
};

type Pglite = import("@electric-sql/pglite").PGlite;

type BancoEstado = {
  pg: Pglite | null;
  etag: string | null;
  ultimoCheck: number;
  cadeia: Promise<void>;
  tx: number;
  sujou: boolean;
  suspenso: number;
  migrado: boolean;
  repetir: boolean;
  copia?: Promise<void>;
  forcar: boolean;
};

function estadoBanco(): BancoEstado {
  const g = globalThis as typeof globalThis & { __bancoEstado__?: BancoEstado };
  g.__bancoEstado__ ??= {
    pg: null,
    etag: null,
    ultimoCheck: 0,
    cadeia: Promise.resolve(),
    tx: 0,
    sujou: false,
    suspenso: 0,
    migrado: false,
    repetir: false,
    forcar: false,
  };
  return g.__bancoEstado__;
}

function exclusivo<T>(fn: () => Promise<T>): Promise<T> {
  const estado = estadoBanco();
  const corre = estado.cadeia.then(fn, fn);
  estado.cadeia = corre.then(
    () => undefined,
    () => undefined,
  );
  return corre;
}

function mutacao(text: string) {
  const s = textoSql(text);
  if (/^(insert|update|delete|alter|drop|truncate)\b/.test(s)) return true;
  return /^with\b/.test(s) && /\b(insert|update|delete)\b/.test(s);
}

function gravaDados(text: string) {
  const s = textoSql(text);
  if (/^(insert|update|delete)\b/.test(s)) return true;
  return /^with\b/.test(s) && /\b(insert|update|delete)\b/.test(s);
}

function textoSql(text: string) {
  return text
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/--[^\n]*/g, " ")
    .trim()
    .toLowerCase();
}

async function criarPglite(carga?: Blob) {
  const { PGlite } = await import("@electric-sql/pglite");
  const pg = new PGlite({
    parsers: {
      [OID_INT8]: Number,
      [OID_DATE]: identity,
      [OID_INTERVAL]: identity,
    },
    ...(carga ? { loadDataDir: carga } : {}),
  });
  await pg.waitReady;
  await pg.exec(
    "create table if not exists _migrations (name text primary key, applied_at timestamptz not null default now())",
  );
  return pg;
}

async function migrar(pg: Pglite) {
  const migrations = import.meta.glob("/migrations/*.sql", {
    query: "?raw",
    import: "default",
    eager: true,
  }) as Record<string, string>;
  const feitas = await pg.query<{ name: string }>("select name from _migrations");
  const done = feitas.rows.map((r) => r.name);
  for (const { name, path } of pendingMigrations(Object.keys(migrations), done)) {
    await pg.transaction(async (tx) => {
      await tx.exec(migrations[path]);
      await tx.query("insert into _migrations (name) values ($1)", [name]);
    });
  }
}

async function aplicarCopia(etag: string, blob: Blob) {
  const estado = estadoBanco();
  const novo = await criarPglite(blob);
  try {
    await migrar(novo);
  } catch (err) {
    await novo.close().catch(() => undefined);
    throw err;
  }
  if (estado.pg && !estado.pg.closed) await estado.pg.close().catch(() => undefined);
  estado.pg = novo;
  estado.etag = etag;
  estado.migrado = true;
  estado.ultimoCheck = Date.now();
  console.info("[banco] snapshot carregado");
}

const INTERVALO_NUVEM_MS = 8_000;

async function alinharComNuvem(forcar = false) {
  const estado = estadoBanco();
  if (estado.suspenso > 0 && estado.pg && estado.migrado) return;
  if (!nuvemConfigurada()) {
    if (!estado.pg) estado.pg = await criarPglite();
    if (!estado.migrado) {
      await migrar(estado.pg);
      estado.migrado = true;
    }
    return;
  }
  // Leitura reutiliza a cópia da memória. Só consulta a nuvem de tempos em
  // tempos, ou na hora de gravar, para não baixar o banco a cada clique.
  const fresco = forcar || !estado.pg || Date.now() - estado.ultimoCheck >= INTERVALO_NUVEM_MS;
  if (fresco) {
    const copia = await buscarCopia(estado.etag);
    estado.ultimoCheck = Date.now();
    if (copia.tipo === "nova") {
      await aplicarCopia(copia.etag, copia.blob);
      return;
    }
    if (!estado.pg) estado.pg = await criarPglite();
  }
  if (estado.pg && !estado.migrado) {
    await migrar(estado.pg);
    estado.migrado = true;
  }
}

async function gravarUmaVez() {
  const estado = estadoBanco();
  if (!estado.pg || !nuvemConfigurada()) return;
  const pg = estado.pg;
  const [condicao, arquivo] = await Promise.all([
    estado.forcar ? Promise.resolve(null) : etagAtual(),
    pg.dumpDataDir("gzip"),
  ]);
  try {
    estado.etag = await gravarCopia(arquivo, condicao);
    estado.ultimoCheck = Date.now();
    console.info("[banco] snapshot guardado");
  } catch (err) {
    if (!conflitoDeGravacao(err)) {
      console.error("[banco] falha ao guardar", err);
      throw err;
    }
    if (estado.forcar) {
      throw new Error("A restauração cruzou com outra gravação. Restaure o arquivo de novo.");
    }
    try {
      estado.etag = await gravarCopia(arquivo, null);
      estado.ultimoCheck = Date.now();
      console.warn("[banco] conflito de etag; snapshot gravado sem condição");
    } catch (err2) {
      console.error("[banco] falha ao guardar", err2);
      throw new Error("Não foi possível guardar os dados agora. Tente de novo em instantes.");
    }
  }
}

async function persistir(): Promise<void> {
  const estado = estadoBanco();
  if (!nuvemConfigurada() || estado.suspenso > 0) return;
  estado.repetir = true;
  if (!estado.copia) {
    estado.copia = (async () => {
      try {
        await exclusivo(async () => {
          while (estadoBanco().repetir) {
            estadoBanco().repetir = false;
            await gravarUmaVez();
          }
        });
      } finally {
        estadoBanco().copia = undefined;
      }
    })();
  }
  await estado.copia;
  if (estadoBanco().repetir) return persistir();
}

export async function consultarPglite<T = Record<string, unknown>>(
  text: string,
  params: unknown[] = [],
): Promise<{ rows: T[]; affectedRows?: number }> {
  let copiar = false;
  const resultado = await exclusivo(async () => {
    const estado = estadoBanco();
    if (estado.tx === 0) await alinharComNuvem(gravaDados(text));
    const pg = estado.pg;
    if (!pg) throw new Error("Banco indisponível.");
    const resposta = await pg.query<T>(text, params);
    if (mutacao(text) && (resposta.affectedRows ?? 1) > 0) {
      if (estado.tx > 0) estado.sujou = true;
      else if (estado.suspenso === 0) copiar = true;
    }
    return { rows: resposta.rows, affectedRows: resposta.affectedRows };
  });
  if (copiar) await persistir();
  return resultado;
}

export async function iniciarTransacaoPglite() {
  await exclusivo(async () => {
    await alinharComNuvem(true);
    estadoBanco().tx += 1;
  });
}

export async function concluirTransacaoPglite(commit: boolean) {
  let copiar = false;
  await exclusivo(async () => {
    const estado = estadoBanco();
    estado.tx = Math.max(0, estado.tx - 1);
    if (estado.tx === 0 && commit && estado.sujou && estado.suspenso === 0) copiar = true;
    if (estado.tx === 0) estado.sujou = false;
  });
  if (copiar) await persistir();
}

export async function semPersistencia<T>(fn: () => Promise<T>): Promise<T> {
  const estado = estadoBanco();
  estado.suspenso += 1;
  try {
    return await fn();
  } finally {
    estado.suspenso -= 1;
  }
}

export async function puxarNuvem() {
  if (dbSource !== "pglite") return;
  await exclusivo(() => alinharComNuvem(true));
}

export async function copiarBancoAgora() {
  if (dbSource !== "pglite") return;
  const estado = estadoBanco();
  estado.forcar = true;
  try {
    await persistir();
  } finally {
    estado.forcar = false;
  }
}

if (typeof window === "undefined" && dbSource === "pglite") {
  estadoBanco().migrado = false;
  globalBoot.__pgBootstrapPromise__ ??= ensureDbReady().catch((err) => {
    globalBoot.__pgBootstrapPromise__ = undefined;
    console.error("[db] PGLite bootstrap failed:", err);
    throw err;
  });
}
