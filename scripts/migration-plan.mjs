// @ts-check
/**
 * Livro-caixa das duas aplicações: `scripts/migrate.mjs` (deploy) e
 * `src/lib/db.ts` (preview PGLite).
 *
 * A chave é o BASENAME: o mesmo arquivo aplica uma vez, de qualquer pasta.
 * Por isso copiar `migrations/auth/` para `migrations/` não reexecuta
 * `0001_auth.sql`. Nenhum dos dois desce em subpastas, então
 * `migrations/auth/*.sql` fica de fora até ser copiado para cima.
 */

/**
 * @param {string} path
 * @returns {string}
 */
export function migrationName(path) {
  return path.split("/").pop() ?? path;
}

/**
 * @param {string} path
 * @returns {boolean}
 */
export function isMigrationFile(path) {
  return path.endsWith(".sql");
}

/**
 * O que ainda não está em `applied`, em ordem. Descarta o que não é `.sql`
 * (`readdir` também devolve `migrations/auth/`).
 * @param {Iterable<string>} paths
 * @param {Iterable<string>} applied
 * @returns {Array<{ name: string, path: string }>}
 */
export function pendingMigrations(paths, applied) {
  const done = new Set(applied);
  return [...paths]
    .filter(isMigrationFile)
    .map((path) => ({ name: migrationName(path), path }))
    .sort((a, b) => a.name.localeCompare(b.name))
    .filter(({ name }) => !done.has(name));
}
