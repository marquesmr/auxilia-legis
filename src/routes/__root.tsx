import { useEffect } from "react";
import { createRootRoute, HeadContent, Outlet, Scripts } from "@tanstack/react-router";
import { AuthProvider } from "@/lib/auth/provider";
import { limparRecargaModulo } from "@/lib/error-component";
import { AplicarTema } from "@/components/aplicar-tema";
import { PreviewHostBridge } from "@/components/preview-host-bridge";
import appCss from "../styles.css?url";

import { NOME_APLICACAO } from "@/lib/nome-aplicacao";

function hostPublico() {
  const bruto = String(import.meta.env.VITE_PUBLIC_HOSTNAME ?? "")
    .split(",")[0]
    .trim()
    .split(":")[0]
    .toLowerCase();
  if (!bruto || !/^[a-z0-9.-]+$/.test(bruto) || !bruto.includes(".")) return "";
  if (/^\d{1,3}(?:\.\d{1,3}){3}$/.test(bruto)) return "";
  if (
    bruto === "vercel.app" ||
    bruto.endsWith(".vercel.app") ||
    bruto === "vercel.com" ||
    bruto.endsWith(".vercel.com")
  ) {
    return "";
  }
  return bruto;
}

const SEM_CORRETOR = new Set(["password", "email", "date", "month", "number", "checkbox", "radio", "file", "hidden", "range", "color"]);

function ativarCorretor(alvo: EventTarget | null) {
  if (!(alvo instanceof HTMLInputElement || alvo instanceof HTMLTextAreaElement)) return;
  if (alvo instanceof HTMLInputElement && SEM_CORRETOR.has(alvo.type)) return;
  alvo.spellcheck = true;
  alvo.lang = "pt-BR";
  alvo.setAttribute("autocorrect", "on");
}

function CorretorOrtografico() {
  useEffect(() => {
    limparRecargaModulo();
    const noFoco = (evento: FocusEvent) => ativarCorretor(evento.target);
    document.addEventListener("focusin", noFoco);
    document.querySelectorAll("input, textarea").forEach((campo) => ativarCorretor(campo));
    return () => document.removeEventListener("focusin", noFoco);
  }, []);
  return null;
}

export const Route = createRootRoute({
  head: () => {
    const host = hostPublico();
    const xBanner = host ? `https://${host}/x-banner.jpg` : "";
    return {
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: NOME_APLICACAO },
      {
        name: "description",
        content:
          "Lance processos, registre a data e o prazo de resposta e receba aviso quando o prazo estiver vencendo.",
      },
      { name: "theme-color", content: "#f3efe6" },
      ...(xBanner ? [{ property: "x:game:image", content: xBanner }] : []),
    ],
    links: [
      { rel: "icon", type: "image/svg+xml", href: "/favicon.svg" },
      { rel: "preload", href: "/fontes/outfit-latin.woff2", as: "font", type: "font/woff2", crossOrigin: "anonymous" },
      { rel: "preload", href: "/fontes/fraunces-latin.woff2", as: "font", type: "font/woff2", crossOrigin: "anonymous" },
      { rel: "stylesheet", href: appCss },
      { rel: "manifest", href: "/__grok/manifest.webmanifest" },
      { rel: "apple-touch-icon", href: "/__grok/icon-180.png" },
    ],
    };
  },
  component: () => (
    <html lang="pt-BR" data-tema="auto" spellCheck suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body>
        <CorretorOrtografico />
        <PreviewHostBridge />
        <AuthProvider>
          <AplicarTema />
          <Outlet />
        </AuthProvider>
        <Scripts />
      </body>
    </html>
  ),
});
