/**
 * Os scripts de captura rodam Chromium com `--no-sandbox` como root e pegam
 * URL e caminho do argv. Sem estes cheques, renderizam
 * `file:///root/.grok/auth.json` num PNG e gravam em qualquer lugar.
 */
import { resolve, sep } from "node:path";

const LOOPBACK_HOSTNAMES = new Set(["127.0.0.1", "localhost", "::1", "[::1]"]);

/** Só http/https em loopback; senão encerra com 1. `BROWSER_ALLOW_EXTERNAL_HOST=1` libera. */
export function checkedUrl(url) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    fail(`not a valid URL: ${url}`);
  }
  // Barra file:, data:, chrome: e view-source:.
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    fail(`only http/https URLs are allowed, got ${parsed.protocol} in ${url}`);
  }
  if (!LOOPBACK_HOSTNAMES.has(parsed.hostname) && process.env.BROWSER_ALLOW_EXTERNAL_HOST !== "1") {
    fail(
      `${parsed.hostname} is not a loopback host; these scripts screenshot the ` +
        `local dev server. Set BROWSER_ALLOW_EXTERNAL_HOST=1 to override.`,
    );
  }
  return url;
}

/** Caminho absoluto só se estiver estritamente dentro de `allowedDirs`; senão encerra com 1. */
export function checkedOutputPath(target, allowedDirs, label = "screenshot") {
  // Resolve antes para `..` não furar o prefixo.
  const abs = resolve(target);
  const allowed = allowedDirs.some((dir) => abs.startsWith(dir.endsWith(sep) ? dir : dir + sep));
  if (!allowed) {
    fail(`${label} path must be under ${allowedDirs.join(" or ")}, got ${abs}`);
  }
  return abs;
}

function fail(message) {
  console.error(JSON.stringify({ ok: false, error: message }, null, 2));
  process.exit(1);
}
