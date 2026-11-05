/** Dialeto Kysely do Better Auth sobre o PGLite. Lazy: `getClient` só na 1ª conexão, depois das migrations. */
import type { PGlite } from "@electric-sql/pglite";
import {
  CompiledQuery,
  type DatabaseConnection,
  type DatabaseIntrospector,
  type Dialect,
  type Driver,
  type Kysely,
  PostgresAdapter,
  PostgresIntrospector,
  PostgresQueryCompiler,
  type QueryCompiler,
  type QueryResult,
  type TransactionSettings,
} from "kysely";
import { concluirTransacaoPglite, consultarPglite, iniciarTransacaoPglite } from "../db";

type Client = PGlite;

export function pgliteDialect(
  getClient: () => Promise<Client> | Client,
): Dialect {
  return {
    createAdapter: () => new PostgresAdapter(),
    createDriver: () => new LazyPGliteDriver(getClient),
    createQueryCompiler: (): QueryCompiler => new PostgresQueryCompiler(),
    createIntrospector: (db: Kysely<unknown>): DatabaseIntrospector =>
      new PostgresIntrospector(db),
  };
}

class LazyPGliteDriver implements Driver {
  private client: Client | undefined;
  private connection: PGliteConnection | undefined;
  private queue: Array<(con: PGliteConnection) => void> = [];

  constructor(private readonly getClient: () => Promise<Client> | Client) {}

  async init(): Promise<void> {
    this.client = await this.getClient();
  }

  async acquireConnection(): Promise<DatabaseConnection> {
    if (this.client === undefined) {
      this.client = await this.getClient();
    }
    if (this.connection !== undefined) {
      return new Promise((resolve) => {
        this.queue.push(resolve);
      });
    }
    this.connection = new PGliteConnection(this.client);
    return this.connection;
  }

  async releaseConnection(connection: DatabaseConnection): Promise<void> {
    if (connection !== this.connection) {
      throw new Error("Invalid connection");
    }
    const next = this.queue.shift();
    if (next === undefined) {
      this.connection = undefined;
      return;
    }
    next(this.connection);
  }

  async beginTransaction(
    conn: DatabaseConnection,
    settings: TransactionSettings,
  ): Promise<void> {
    await iniciarTransacaoPglite();
    const c = conn as PGliteConnection;
    try {
      if (settings.isolationLevel) {
        await c.executeQuery(
          CompiledQuery.raw(
            `start transaction isolation level ${settings.isolationLevel}`,
          ),
        );
      } else {
        await c.executeQuery(CompiledQuery.raw("begin"));
      }
    } catch (err) {
      await concluirTransacaoPglite(false);
      throw err;
    }
  }

  async commitTransaction(conn: DatabaseConnection): Promise<void> {
    let gravou = false;
    try {
      await (conn as PGliteConnection).executeQuery(CompiledQuery.raw("commit"));
      gravou = true;
      await concluirTransacaoPglite(true);
    } catch (err) {
      if (!gravou) await concluirTransacaoPglite(false);
      throw err;
    }
  }

  async rollbackTransaction(conn: DatabaseConnection): Promise<void> {
    try {
      await (conn as PGliteConnection).executeQuery(
        CompiledQuery.raw("rollback"),
      );
    } finally {
      await concluirTransacaoPglite(false);
    }
  }

  async destroy(): Promise<void> {
    // Não feche o client: é o singleton de getPglite()/getSql. Só solta o handle local.
    this.client = undefined;
    this.connection = undefined;
    this.queue = [];
  }
}

class PGliteConnection implements DatabaseConnection {
  constructor(private readonly client: Client) {}

  async executeQuery<O>(compiledQuery: CompiledQuery): Promise<QueryResult<O>> {
    const result = await consultarPglite<O>(compiledQuery.sql, [
      ...compiledQuery.parameters,
    ]);
    if (result.affectedRows) {
      return {
        numAffectedRows: BigInt(result.affectedRows),
        rows: result.rows,
      };
    }
    return { rows: result.rows };
  }

  async *streamQuery<O>(
    compiledQuery: CompiledQuery,
    chunkSize: number,
  ): AsyncIterableIterator<QueryResult<O>> {
    if (!Number.isInteger(chunkSize) || chunkSize <= 0) {
      throw new Error("chunkSize must be a positive integer");
    }
    const result = await consultarPglite<O>(compiledQuery.sql, [
      ...compiledQuery.parameters,
    ]);
    for (let i = 0; i < result.rows.length; i += chunkSize) {
      yield { rows: result.rows.slice(i, i + chunkSize) as O[] };
    }
  }
}
