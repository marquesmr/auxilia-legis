#!/usr/bin/env node
/**
 * Entrega um arquivo staged num passo só, para outro agente ler.
 *
 * O passo de marca grava public/og.jpg e site.json enquanto o pai pode estar
 * no meio de `npm run build`; escrita no lugar pode ser lida pela metade.
 * rename(2) é atômico no mesmo filesystem. /workspace é um só, então staged
 * de outro lugar (/tmp é outro mount) é recusado em vez de copiado: a cópia
 * teria de cair o temp no diretório do destino, e é isso que o staged não pode.
 */
import { existsSync, mkdirSync, renameSync } from "node:fs";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

export function parseWriteAtomicArgs(argv) {
  const [staged, target, ...rest] = argv;
  if (!staged || !target) {
    return { error: "usage: node scripts/write-atomic.mjs <staged-file> <target>" };
  }
  if (rest.length > 0) return { error: `unexpected argument: ${rest[0]}` };
  return { staged, target };
}

function isInside(dir, file) {
  const rel = relative(dir, file);
  return rel !== "" && !rel.startsWith("..") && !isAbsolute(rel);
}

/**
 * Por que um staged pode ser recusado: `vite build` copia public/ inteiro
 * para o app publicado, então um temp que cai ali vai junto (e uma interrupção
 * deixa ele para trás).
 */
export function stagingError({ staged, target, publicDir }) {
  if (staged === target) return `staged file and target are the same path: ${target}`;
  if (isInside(publicDir, staged)) {
    return `stage outside ${publicDir} (vite build ships that directory verbatim): ${staged}`;
  }
  return null;
}

/**
 * Move `staged` para `target` e deixa `target` intocado se algo falhar.
 * `rename` é injetável porque EXDEV — a recusa em que o contrato "stage em
 * /workspace/.grok/" se apoia — não dá para provocar de forma portátil.
 */
export function handOver(staged, target, { rename = renameSync } = {}) {
  if (!existsSync(staged)) {
    throw Object.assign(new Error(`staged file is missing: ${staged}`), { code: "ENOENT" });
  }
  mkdirSync(dirname(target), { recursive: true });
  try {
    rename(staged, target);
  } catch (err) {
    if (err?.code === "EXDEV") {
      throw new Error(
        `${staged} is on another filesystem than ${target}, so the hand-over cannot be a `
          + "rename — stage under /workspace/.grok/ instead",
      );
    }
    throw err;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = parseWriteAtomicArgs(process.argv.slice(2));
  if (args.error) {
    console.error(`[write-atomic] ${args.error}`);
    process.exit(1);
  }
  // Caminho relativo segue a raiz deste script, não o cwd de quem chamou: o
  // passo de marca roda de onde o subshell parou, e a recusa de public/
  // abaixo é medida contra essa mesma raiz.
  const staged = resolve(ROOT, args.staged);
  const target = resolve(ROOT, args.target);
  const problem = stagingError({ staged, target, publicDir: join(ROOT, "public") });
  if (problem) {
    console.error(`[write-atomic] ${problem}`);
    process.exit(1);
  }
  try {
    handOver(staged, target);
  } catch (err) {
    console.error(`[write-atomic] ${staged} → ${target} failed: ${err?.message || err}`);
    process.exit(1);
  }
  console.log(`[write-atomic] wrote ${target}`);
}
