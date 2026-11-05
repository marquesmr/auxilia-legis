#!/usr/bin/env node
/**
 * Roda um comando com `.grok/app-env.json` no ambiente.
 *
 * `dev`, `build` e `preview` passam por aqui, então não discordam de
 * `VITE_AUTH_ENABLED`. Quem sobe o Vite direto fura o wrapper.
 *
 * Só entra chave `VITE_`: o arquivo é flag de build, não cofre, e só `VITE_`
 * chega no browser. Um `process.env` real sempre ganha.
 *
 * Por essa precedência o arquivo vale só neste workspace. O build publicado
 * usa o env do provedor, que define `VITE_AUTH_ENABLED` (hoje sempre `"true"`).
 *
 * O Vite lê porque `loadEnv` casa o que já está em `process.env` — o merge
 * tem de acontecer antes do Vite subir.
 */
import { spawn } from "node:child_process";
import { readFileSync, realpathSync } from "node:fs";
import { constants as osConstants } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export const APP_ENV_REL_PATH = ".grok/app-env.json";

const VITE_PREFIX = "VITE_";

/**
 * Só entradas string com prefixo `VITE_`. O que não parseia vira ambiente
 * vazio — workspace sem o arquivo tem de se comportar como hoje (auth ligado).
 */
export function parseAppEnv(text) {
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    return {};
  }
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) return {};
  const env = {};
  for (const [key, value] of Object.entries(parsed)) {
    if (!key.startsWith(VITE_PREFIX)) continue;
    if (typeof value !== "string") continue;
    env[key] = value;
  }
  return env;
}

/** Env gravado em `root`, ou `{}` se o arquivo não existe. */
export function readAppEnv(root) {
  try {
    return parseAppEnv(readFileSync(join(root, APP_ENV_REL_PATH), "utf8"));
  } catch {
    return {};
  }
}

/** Valores do arquivo ficam sob o ambiente: um override explícito ganha. */
export function mergeAppEnv(appEnv, processEnv) {
  return { ...appEnv, ...processEnv };
}

/**
 * Traduz o `(code, signal)` do filho no status deste processo.
 *
 * Não reenvie o sinal com `process.kill(process.pid, signal)`: sob qemu-user
 * (build amd64 num host arm) o sinal para si mesmo chega como SIGSEGV no
 * processo errado e derruba o worker. `128 + signo` é o que o shell reporta,
 * então um `vite build` cancelado continua sendo falha.
 */
export function exitStatusFromChild(code, signal) {
  if (signal) {
    const signo = osConstants.signals[signal];
    return 128 + (typeof signo === "number" ? signo : 1);
  }
  return code ?? 1;
}

/** Raiz do workspace (este arquivo fica em `<root>/scripts/`). */
export function projectRoot() {
  return dirname(dirname(fileURLToPath(import.meta.url)));
}

/**
 * Se `moduleUrl` é o script que o node foi pedido para rodar.
 *
 * Os dois lados passam por symlink: o node faz realpath de `import.meta.url`
 * e deixa `process.argv[1]` como foi digitado. Comparar cru torna um CLI
 * via symlink (`/tmp` no macOS) um no-op silencioso.
 */
export function isMainModule(moduleUrl) {
  const entry = process.argv[1];
  if (!entry) return false;
  try {
    return realpathSync(entry) === fileURLToPath(moduleUrl);
  } catch {
    return false;
  }
}

function main(argv) {
  const [command, ...args] = argv;
  if (!command) {
    console.error("usage: node scripts/with-app-env.mjs <command> [args…]");
    process.exit(2);
  }
  const env = mergeAppEnv(readAppEnv(projectRoot()), process.env);
  const child = spawn(command, args, { stdio: "inherit", env });
  // O dev server é longo e para quando sinalizam este wrapper.
  for (const signal of ["SIGINT", "SIGTERM", "SIGHUP"]) {
    process.on(signal, () => child.kill(signal));
  }
  child.on("error", (err) => {
    console.error(`[with-app-env] failed to run ${command}:`, err?.message || err);
    process.exit(127);
  });
  child.on("exit", (code, signal) => {
    process.exit(exitStatusFromChild(code, signal));
  });
}

if (isMainModule(import.meta.url)) {
  main(process.argv.slice(2));
}
