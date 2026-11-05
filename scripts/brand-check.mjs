#!/usr/bin/env node
/**
 * Gate de marca do browser-smoke (testável sem browser). App com canvas é
 * quase sempre jogo e precisa de card próprio — o placeholder og.grok.me não
 * serve (ver .grok/skills/og/SKILL.md).
 *
 * Jogo também exige `type=x:game` em site.json (og:type no X) e
 * public/x-banner.jpg (card 50:11). O arquivo do card já faz o bake emitir
 * /og.jpg, mas `"card": "custom"` continua obrigatório para o contrato ficar
 * explícito. Julga o disco, não o HTML servido.
 *
 * Rodado sozinho, o marker og-pending só cala o gate do pai; esta passagem
 * julga o disco e exige o card, salvo `--placeholder-ok` (utilitário simples
 * que fica no placeholder).
 */
import { existsSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { OG_SITE_REL_PATH, readOgSite, siteHasCustomCard } from "./grok-pwa-shared.mjs";

// Acima disso, scrapers de link (preview do X inclusive) estouram ou pulam
// a imagem e o card não abre. O JPEG do skill (ffmpeg -q:v 4) existe para ficar abaixo.
export const MAX_CARD_BYTES = 600 * 1024;

// O passo de marca grava enquanto gera e apaga ao terminar.
export const OG_PENDING_REL_PATH = ".grok/og-pending";
// Um Stop no meio deixa o marker; a folga expira para não esconder
// um card faltando para sempre.
export const OG_PENDING_MAX_AGE_MS = 10 * 60 * 1000;

export function siteDeclaresOgTypeGame(site) {
  return String(site?.type ?? "").toLowerCase() === "x:game";
}

export function ogPendingActive(workspaceRoot, now = Date.now()) {
  try {
    const { mtimeMs } = statSync(join(workspaceRoot, OG_PENDING_REL_PATH));
    return now - mtimeMs < OG_PENDING_MAX_AGE_MS;
  } catch {
    return false;
  }
}

/**
 * O que o gate do pai vê. Em geração, "faltando" mandaria o agente refazer
 * o trabalho. Em voo é silêncio: quem chama trata o array como aviso.
 */
export function computeBrandWarnings({
  hasCanvas,
  workspaceRoot = "/workspace",
  now = Date.now(),
}) {
  if (ogPendingActive(workspaceRoot, now)) return [];
  return brandWarningsOnDisk({ hasCanvas, workspaceRoot });
}

/**
 * O disco, ignorando o marker — a visão do próprio passo de marca.
 * De propósito não exportada: um gate que a usasse avisaria de um card
 * ainda em geração. `cardRequired` torna o placeholder uma falha, não o
 * padrão de utilitário que o gate do pai deixa passar.
 */
function brandWarningsOnDisk({
  hasCanvas,
  workspaceRoot = "/workspace",
  cardRequired = false,
}) {
  const skillPath = join(workspaceRoot, ".grok/skills/og/SKILL.md");
  const sitePath = join(workspaceRoot, OG_SITE_REL_PATH);
  const site = readOgSite(workspaceRoot);
  const cardPath = [
    join(workspaceRoot, "public/og.jpg"),
    join(workspaceRoot, "public/og.png"),
  ].find(existsSync);
  const warnings = [];

  if (cardPath !== undefined) {
    if (statSync(cardPath).size > MAX_CARD_BYTES) {
      warnings.push(
        `BRAND WARNING: ${cardPath} is over 600 KB — link scrapers (X card previews included) `
          + "time out or skip images this heavy, so the card silently fails to unfurl. "
          + `Re-encode as JPEG (public/og.jpg, ffmpeg -q:v 4) per ${skillPath}.`,
      );
    }
    if (!siteHasCustomCard(site)) {
      warnings.push(
        `BRAND WARNING: ${cardPath} exists but ${sitePath} is missing "card": "custom". `
          + "Bake infers custom from the file, but set the flag in "
          + `${sitePath} per ${skillPath} so identity is explicit.`,
      );
    }
  } else if (hasCanvas) {
    warnings.push(
      `BRAND WARNING: this looks like a game/canvas app but ${workspaceRoot}/public/og.jpg `
        + "is missing. Games and visually rich apps must ship a custom 1200x630 share card "
        + "built from the app's own art — the default og.grok.me placeholder card is not "
        + `acceptable for them. You are not done: open ${skillPath} and finish the `
        + "brand-asset pass.",
    );
  } else if (cardRequired) {
    warnings.push(
      `BRAND WARNING: ${workspaceRoot}/public/og.jpg is missing and this pass exists to `
        + "produce it. Generate the 1200x630 card from the app's own art and hand it over "
        + `per ${skillPath}. If no image-generation tool is available in this session, `
        + "report that instead of reporting a pass — the app keeps the og.grok.me "
        + "placeholder.",
    );
  } else {
    warnings.push(
      "BRAND NOTE: no custom public/og.jpg — the platform will serve the og.grok.me placeholder. "
        + "Custom cards are the default for games of every kind (DOM board/word games included), "
        + "whimsical apps, creative tools, and brand-forward pages — only plain utilities "
        + "(converters, CRUD trackers, admin dashboards) keep the placeholder. If this app "
        + `is not a plain utility, finish the brand-asset pass per ${skillPath}.`,
    );
  }

  if (hasCanvas && !siteDeclaresOgTypeGame(site)) {
    warnings.push(
      'BRAND WARNING: this looks like a game/canvas app but src/lib/og/site.json is missing '
        + '"type": "x:game". X uses og:type=x:game to present the unfurl as a game card — set '
        + `it in ${sitePath} per ${skillPath}. Do not invent `
        + "x:type or overload twitter:card as the game signal.",
    );
  }

  // Jogo com card de link próprio também precisa do card 50:11 do feed do X.
  // Pula enquanto ainda está no placeholder og.grok.me — esse passo nem começou.
  if (hasCanvas && cardPath !== undefined) {
    const bannerPath = join(workspaceRoot, "public/x-banner.jpg");
    if (!existsSync(bannerPath)) {
      warnings.push(
        `BRAND WARNING: this looks like a game/canvas app but ${bannerPath} is missing. `
          + "Games need a 50:11 X feed card (1200×264 JPEG) at public/x-banner.jpg — "
          + `open ${skillPath} and finish the brand-asset pass.`,
      );
    } else if (statSync(bannerPath).size > MAX_CARD_BYTES) {
      warnings.push(
        `BRAND WARNING: ${bannerPath} is over 600 KB — link scrapers (X card previews `
          + "included) time out or skip images this heavy, so the feed card silently fails "
          + `to unfurl. Re-encode as JPEG (ffmpeg -q:v 4) per ${skillPath}.`,
      );
    }
  }

  return warnings;
}

export function parseBrandCheckArgs(argv) {
  const usage =
    "usage: node scripts/brand-check.mjs [--game] [--placeholder-ok] [--root <dir>]";
  let game = false;
  let placeholderOk = false;
  let root = null;
  for (let i = 0; i < argv.length; i += 1) {
    // `--game` roda os cheques que o smoke tira de um <canvas> real;
    // jogo de tabuleiro/palavra no DOM também precisa e não tem canvas.
    if (argv[i] === "--game") {
      game = true;
    } else if (argv[i] === "--placeholder-ok") {
      placeholderOk = true;
    } else if (argv[i] === "--root") {
      root = argv[++i];
      if (root === undefined) return { error: `--root needs a directory — ${usage}` };
    } else {
      return { error: `unexpected argument: ${argv[i]} — ${usage}` };
    }
  }
  return { game, placeholderOk, root };
}

function isBrandWarning(message) {
  return message.startsWith("BRAND WARNING:");
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = parseBrandCheckArgs(process.argv.slice(2));
  if (args.error) {
    console.error(JSON.stringify({ ok: false, error: args.error }, null, 2));
    process.exit(1);
  }
  const workspaceRoot = args.root ?? join(dirname(fileURLToPath(import.meta.url)), "..");
  // Quem chama é o passo de marca conferindo o próprio trabalho: segura o
  // marker (reporte, mas julgue o disco) e deve um card próprio, com ou sem
  // canvas — salvo se foi lançado para um utilitário que fica no placeholder.
  const messages = brandWarningsOnDisk({
    hasCanvas: args.game,
    workspaceRoot,
    cardRequired: !args.placeholderOk,
  });
  const warnings = messages.filter(isBrandWarning);
  console.log(
    JSON.stringify(
      {
        ok: warnings.length === 0,
        workspaceRoot,
        pending: ogPendingActive(workspaceRoot),
        warnings: warnings.length,
        messages,
      },
      null,
      2,
    ),
  );
  process.exitCode = warnings.length === 0 ? 0 : 1;
}
