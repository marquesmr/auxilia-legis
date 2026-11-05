/**
 * Better Auth deste app (só servidor). Não reescreva: e-mail/senha fica em `./email-password`.
 *
 * Sessão no próprio origin (`/api/auth/*`). Login federa no broker; os segredos
 * Google/X ficam lá. O app só tem client id/secret e o hint `idp`.
 *
 * - Deploy: `GROK_AUTH_*` + `BETTER_AUTH_URL` + `DATABASE_URL` (Postgres).
 * - Preview: cliente de `./preview`, origin `*.grok-sandbox.com` do request, PGLite
 *   (some no restart). Iframe usa bearer — ver `client.ts`.
 * - Desligado (`VITE_AUTH_ENABLED=false`): dev user sem banco; lança se houver `DATABASE_URL`.
 *
 * Nunca importe no cliente: puxa `pg`, o segredo de preview e o Better Auth.
 */
import { betterAuth } from "better-auth";
import { bearer, genericOAuth } from "better-auth/plugins";
import { tanstackStartCookies } from "better-auth/tanstack-start";
import { getCookie } from "@tanstack/react-start/server";
import { randomBytes } from "node:crypto";
import { Pool } from "pg";
import { ensureDbReady, getPglite } from "../db";
import { emailAndPassword, emailAndPasswordEnabled } from "./email-password";
import { GATE_PROVIDER_ID, gateIdentitySessions } from "./gate-session.server";
import { GROK_PROVIDERS } from "./providers";
import { pgliteDialect } from "./pglite-dialect";
import {
  GROK_ISSUER_DEFAULT,
  PREVIEW_ALLOWED_HOSTS,
  PREVIEW_CLIENT_ID,
  PREVIEW_CLIENT_SECRET,
} from "./preview";

// Dispara (e compartilha) o bootstrap do PGLite assim que o módulo carrega.
void ensureDbReady();

/**
 * O segredo de preview sobrevive ao HMR: o PGLite está no `globalThis`.
 * Recriar o segredo invalidaria as sessões. O restart do processo limpa os dois.
 */
const globalAuthRef = globalThis as typeof globalThis & {
  __grokAuthPreviewSecret__?: string;
};
function previewAuthSecret(): string {
  globalAuthRef.__grokAuthPreviewSecret__ ??= randomBytes(32).toString("hex");
  return globalAuthRef.__grokAuthPreviewSecret__;
}

/** Lê env; vazio ou só espaço conta como ausente. */
const env = (key: string): string | undefined => {
  const value = process.env[key]?.trim();
  return value ? value : undefined;
};

// Desliga de propósito. O deploy injeta `true`; `"false"` força o usuário de dev.
const authDisabled = env("VITE_AUTH_ENABLED") === "false";

// No deploy, client por app; senão o client de preview, aceito em `*.grok-sandbox.com`.
const grokIssuer = env("GROK_AUTH_ISSUER") ?? GROK_ISSUER_DEFAULT;
const grokClientId = env("GROK_AUTH_CLIENT_ID") ?? PREVIEW_CLIENT_ID;
const grokClientSecret = env("GROK_AUTH_CLIENT_SECRET") ?? PREVIEW_CLIENT_SECRET;

/** Login federado ativo (auth de verdade). */
export const authConfigured =
  !authDisabled && Boolean(grokClientId && grokClientSecret);

// Origin do Better Auth. No deploy vem `BETTER_AUTH_URL`. No preview o host é dinâmico:
// o origin sai do request (allowlist) e o `redirect_uri` é a URL que o broker aceita.
const explicitBaseURL = env("BETTER_AUTH_URL");
const previewAllowedHosts: string[] = [
  ...PREVIEW_ALLOWED_HOSTS,
  "www.auxilialegis.online",
  "auxilialegis.online",
];
const LOCAL_DEV_ORIGINS: string[] = [
  "http://localhost:8080",
  "http://127.0.0.1:8080",
  "http://[::1]:8080",
];
// Domínio próprio entra na lista. Com a URL fixa, o login no domínio do usuário
// era recusado ("Invalid origin") porque só o host de BETTER_AUTH_URL era aceito.
const baseURL = {
  allowedHosts: [...previewAllowedHosts, "localhost", "127.0.0.1", "[::1]"],
  protocol: "auto" as const,
  fallback: explicitBaseURL ?? "http://localhost:8080",
};

function origemDoPedido(request?: Request): string | null {
  if (!request) return null;
  const bruto = request.headers.get("x-forwarded-host") || request.headers.get("host") || "";
  const host = bruto.split(",")[0]?.trim().toLowerCase();
  if (!host || !/^[a-z0-9.-]+(?::\d{2,5})?$/.test(host)) return null;
  const proto = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
  const esquema = proto === "http" || proto === "https" ? proto : "https";
  return `${esquema}://${host}`;
}

const trustedOrigins = (request?: Request) => {
  const lista = [...LOCAL_DEV_ORIGINS];
  if (explicitBaseURL) {
    try {
      lista.push(new URL(explicitBaseURL).origin);
    } catch {
      lista.push(explicitBaseURL);
    }
  }
  const origem = origemDoPedido(request);
  if (origem) lista.push(origem);
  return lista;
};

const databaseUrl = env("DATABASE_URL");
const googleClientId = env("GOOGLE_CLIENT_ID");
const googleClientSecret = env("GOOGLE_CLIENT_SECRET");
const googleDireto = Boolean(googleClientId && googleClientSecret);
const xClientId = env("TWITTER_CLIENT_ID");
const xClientSecret = env("TWITTER_CLIENT_SECRET");
const xDireto = Boolean(xClientId && xClientSecret);

// Endpoints OAuth fixos (sem discovery a cada login): a ida extra travava o popup.
// Os paths batem com o documento de discovery do broker.
const issuerBase = grokIssuer.replace(/\/+$/, "");
const grokAuthorizationUrl = `${issuerBase}/api/auth/oauth2/authorize`;
const grokTokenUrl = `${issuerBase}/api/auth/oauth2/token`;
const grokUserInfoUrl = `${issuerBase}/api/auth/oauth2/userinfo`;

// Postgres se houver `DATABASE_URL` (deploy); senão PGLite do preview, o mesmo banco do app.
const database = databaseUrl
  ? new Pool({ connectionString: databaseUrl })
  : { dialect: pgliteDialect(() => getPglite()), type: "postgres" as const };

/** Nome do cookie de sessão — a página de fim do popup de preview também lê. */
export const SESSION_TOKEN_COOKIE = "__Host-grok-auth.session_token";

const grokOAuthPlugin = authConfigured
  ? genericOAuth({
      config: GROK_PROVIDERS.map(({ providerId, idp }) => ({
        providerId,
        clientId: grokClientId as string,
        clientSecret: grokClientSecret as string,
        // URLs fixas em vez de discoveryUrl: não espera o broker para iniciar o OAuth.
        authorizationUrl: grokAuthorizationUrl,
        tokenUrl: grokTokenUrl,
        userInfoUrl: grokUserInfoUrl,
        scopes: ["openid", "profile", "email"],
        // `prompt: "login"` força reautenticar no upstream (não reusa a sessão do broker).
        // Com `select_account` no Google, o usuário escolhe a conta.
        authorizationUrlParams: { idp, prompt: "login" },
      })),
    })
  : null;

export const auth = betterAuth({
  baseURL,
  // Deploy injeta BETTER_AUTH_SECRET. Preview: segredo estável no globalThis (HMR não invalida sessões).
  secret: env("BETTER_AUTH_SECRET") ?? previewAuthSecret(),
  database,

  // CSRF/origin dos POSTs com credencial. Tem de cobrir preview e loopback, senão "Invalid origin".
  trustedOrigins,

  // Criptografa tokens OAuth e trata os upstreams como first-party.
  // Sem isso o X (e-mail sintético) falha com `account_not_linked`. Google e X não se fundem.
  account: {
    encryptOAuthTokens: true,
    accountLinking: {
      enabled: true,
      trustedProviders: [
        ...GROK_PROVIDERS.map((p) => p.providerId),
        GATE_PROVIDER_ID,
        "google",
        "twitter",
      ],
      // E-mail sintético do X nunca é verificado: não exija e-mail local verificado para vincular.
      requireLocalEmailVerified: false,
    },
  },

  // Foto não é usada. Data-URL no cookie estourava o header (Cloudflare 520).
  // `returned: false` tira `image` da sessão. `fieldName` fica: additionalFields substitui a coluna.
  user: {
    additionalFields: {
      image: {
        type: "string",
        required: false,
        fieldName: "image",
        returned: false,
      },
    },
  },
  databaseHooks: {
    user: {
      update: {
        before: async (data) => {
          const image = data.image;
          if (typeof image === "string" && (image.startsWith("data:") || image.length > 500)) {
            return { data: { ...data, image: null } };
          }
          return { data };
        },
      },
    },
  },

  // Cache da sessão no cookie `session_data` para pular o banco e reduzir o flicker.
  // version "2" descarta cookies de quando a foto ia embutida.
  session: { cookieCache: { enabled: true, maxAge: 300, version: "2" } },

  // E-mail/senha local — só o flag em `./email-password`.
  ...(emailAndPasswordEnabled ? { emailAndPassword } : {}),
  ...(googleDireto || xDireto
    ? {
        socialProviders: {
          ...(googleDireto
            ? {
                google: {
                  clientId: googleClientId as string,
                  clientSecret: googleClientSecret as string,
                  prompt: "select_account",
                },
              }
            : {}),
          ...(xDireto
            ? {
                twitter: {
                  clientId: xClientId as string,
                  clientSecret: xClientSecret as string,
                  // O aplicativo do X está sem permissão de e-mail. Pedir
                  // users.email faz o X recusar o login.
                  disableDefaultScope: true,
                  scope: ["users.read", "tweet.read", "offline.access"],
                  mapProfileToUser: (perfil: { data?: { id?: string; name?: string; username?: string; email?: string } }) => {
                    const dados = perfil.data;
                    const emailReal = dados?.email?.includes("@") ? dados.email : "";
                    return {
                      name: dados?.name || dados?.username || "Conta X",
                      email: emailReal || `${dados?.id || "conta"}@x.auxilialegis.online`,
                      emailVerified: Boolean(emailReal),
                    };
                  },
                },
              }
            : {}),
        },
      }
    : {}),

  // Prefixo `__Host-`: o browser recusa cookie homônimo com `Domain`, então um app
  // `*.grok.me` não joga sessão aqui. Exige Secure + Path=/ e sem Domain. O prefixo
  // automático (`__Secure-`) permite Domain, então desligamos e setamos os nomes.
  // Localhost aceita cookie Secure.
  advanced: {
    useSecureCookies: false,
    defaultCookieAttributes: { secure: true, sameSite: "lax", path: "/" },
    cookies: {
      session_token: { name: SESSION_TOKEN_COOKIE },
      session_data: { name: "__Host-grok-auth.session_data" },
      account_data: { name: "__Host-grok-auth.account_data" },
      dont_remember: { name: "__Host-grok-auth.dont_remember" },
    },
  },

  plugins: [
    gateIdentitySessions(),

    // Um genericOAuth por upstream (auth ligado), mesmo client, só muda o hint `idp`.
    ...(grokOAuthPlugin ? [grokOAuthPlugin] : []),

    // Aceita `Authorization: Bearer`. No preview o iframe particiona cookies; sem o header o cookie segue valendo.
    bearer(),

    // Leva o Set-Cookie do Better Auth ao TanStack. Tem de ser o último plugin.
    tanstackStartCookies(),
  ],
});

export function readSessionToken(): string | null {
  return getCookie(SESSION_TOKEN_COOKIE) ?? null;
}

// Reexportado daqui; o array mora em `providers.ts` (sem dependência) para o cliente importar.
export { GROK_PROVIDERS } from "./providers";
