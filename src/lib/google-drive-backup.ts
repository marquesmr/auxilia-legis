const PASTA = "Auxilia Legis";
const ESCOPO = "https://www.googleapis.com/auth/drive.file";

type ClienteToken = {
  requestAccessToken: (opcoes?: { prompt?: string }) => void;
};

type RespostaToken = { access_token?: string; error?: string };

declare global {
  interface Window {
    google?: {
      accounts: {
        oauth2: {
          initTokenClient: (config: {
            client_id: string;
            scope: string;
            callback: (resposta: RespostaToken) => void;
            error_callback?: () => void;
          }) => ClienteToken;
        };
      };
    };
  }
}

export function nomeBackupManual(agora = new Date()) {
  const partes = new Intl.DateTimeFormat("en-GB", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).formatToParts(agora);
  const dia = partes.find((parte) => parte.type === "day")?.value ?? "01";
  const mes = partes.find((parte) => parte.type === "month")?.value ?? "01";
  const ano = partes.find((parte) => parte.type === "year")?.value ?? "2026";
  return `backup_manual_${dia}_${mes}_${ano}`;
}

export function carregarGoogle() {
  if (typeof window === "undefined") return Promise.resolve();
  if (window.google?.accounts?.oauth2) return Promise.resolve();
  return new Promise<void>((resolver, rejeitar) => {
    const pronto = () => (window.google?.accounts?.oauth2 ? resolver() : rejeitar(new Error("Não foi possível abrir o Google.")));
    const existente = document.querySelector<HTMLScriptElement>("script[data-gsi-auxilia]");
    if (existente) {
      existente.addEventListener("load", pronto, { once: true });
      existente.addEventListener("error", () => rejeitar(new Error("Não foi possível abrir o Google.")), { once: true });
      return;
    }
    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.dataset.gsiAuxilia = "1";
    script.onload = pronto;
    script.onerror = () => rejeitar(new Error("Não foi possível abrir o Google."));
    document.head.appendChild(script);
  });
}

export function pedirAcessoDrive(clientId: string) {
  return new Promise<string>((resolver, rejeitar) => {
    const google = window.google?.accounts?.oauth2;
    if (!google) {
      rejeitar(new Error("O Google ainda está abrindo. Tenta de novo."));
      return;
    }
    const cliente = google.initTokenClient({
      client_id: clientId,
      scope: ESCOPO,
      callback: (resposta) => {
        if (resposta.access_token) resolver(resposta.access_token);
        else rejeitar(new Error("O Google não autorizou o Drive. Ative a API do Google Drive neste login."));
      },
      error_callback: () => rejeitar(new Error("O acesso ao Google Drive foi cancelado.")),
    });
    cliente.requestAccessToken();
  });
}

async function driveJson<T>(token: string, url: string, init?: RequestInit): Promise<T> {
  const resposta = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(init?.headers ?? {}),
    },
  });
  if (!resposta.ok) {
    let detalhe = "";
    try {
      const corpo = (await resposta.json()) as { error?: { message?: string } };
      detalhe = corpo.error?.message ?? "";
    } catch {
      detalhe = "";
    }
    throw new Error(detalhe || "O Google Drive não aceitou o backup.");
  }
  return (await resposta.json()) as T;
}

async function pastaDoSistema(token: string) {
  const consulta = encodeURIComponent(
    `name = '${PASTA}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
  );
  const achada = await driveJson<{ files?: { id: string }[] }>(
    token,
    `https://www.googleapis.com/drive/v3/files?q=${consulta}&fields=files(id)&spaces=drive&pageSize=1`,
  );
  if (achada.files?.[0]?.id) return achada.files[0].id;
  const criada = await driveJson<{ id: string }>(token, "https://www.googleapis.com/drive/v3/files", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: PASTA, mimeType: "application/vnd.google-apps.folder" }),
  });
  return criada.id;
}

export async function enviarBackupDrive(token: string, nome: string, conteudo: string) {
  const pasta = await pastaDoSistema(token);
  const consulta = encodeURIComponent(`name = '${nome}' and '${pasta}' in parents and trashed = false`);
  const achado = await driveJson<{ files?: { id: string }[] }>(
    token,
    `https://www.googleapis.com/drive/v3/files?q=${consulta}&fields=files(id)&spaces=drive&pageSize=1`,
  );
  const existente = achado.files?.[0]?.id;
  const limite = "auxilia_backup";
  const metadados = existente
    ? { name: nome, mimeType: "application/json" }
    : { name: nome, mimeType: "application/json", parents: [pasta] };
  const corpo = [
    `--${limite}`,
    "Content-Type: application/json; charset=UTF-8",
    "",
    JSON.stringify(metadados),
    `--${limite}`,
    "Content-Type: application/json",
    "",
    conteudo,
    `--${limite}--`,
    "",
  ].join("\r\n");
  const url = existente
    ? `https://www.googleapis.com/upload/drive/v3/files/${existente}?uploadType=multipart`
    : "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart";
  await driveJson(token, url, {
    method: existente ? "PATCH" : "POST",
    headers: { "Content-Type": `multipart/related; boundary=${limite}` },
    body: corpo,
  });
}
