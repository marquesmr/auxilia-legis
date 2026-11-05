#!/usr/bin/env node
// Contrato com CapturePreviewThumbnail: exit 0 só com o PNG gravado;
// outro exit é skip e o serviço não baixa o arquivo.
import { chromium } from "playwright";
import { checkedOutputPath, checkedUrl } from "./browser-guard.mjs";

// O serviço sempre passa loopback e um caminho em /tmp; os cheques
// mantêm isso quando alguém roda o script na mão.
const url = checkedUrl(process.argv[2] || "http://127.0.0.1:8080/");
const outPng = checkedOutputPath(process.argv[3] || "/tmp/preview-thumbnail.png", [
  "/tmp",
  "/workspace",
]);
const timeoutMs = Number(process.env.PREVIEW_THUMBNAIL_TIMEOUT_MS || 45000);

const browser = await chromium.launch({
  headless: true,
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
});

try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });

  // `domcontentloaded`, não `networkidle`: o websocket de HMR do Vite nunca
  // sossega e queimaria o timeout inteiro.
  const resp = await page.goto(url, { waitUntil: "domcontentloaded", timeout: timeoutMs });
  const status = resp?.status() ?? 0;
  await page.waitForTimeout(1000);

  await page.screenshot({ path: outPng, fullPage: false });

  console.log(JSON.stringify({ url, status, screenshot: outPng }, null, 2));
} catch (err) {
  console.error(JSON.stringify({ ok: false, url, error: String(err?.message || err) }, null, 2));
  // Marca o código em vez de process.exit(), para o `finally` sempre
  // fechar o Chromium.
  process.exitCode = 1;
} finally {
  await browser.close();
}
