import { anoDoTexto, lerJsonCalendario, lerTextoCalendario, type FeriadoLido } from "@/lib/calendario-leitura";

const PEDIDO = `Extraia feriados, pontos facultativos e períodos de recesso deste texto de calendário.
Ignore sessões ordinárias e dias de expediente comum.
Responda somente JSON neste formato: {"itens":[{"nome":"","inicio":"AAAA-MM-DD","fim":"AAAA-MM-DD","tipo":"feriado"}]}
tipo pode ser feriado, facultativo ou recesso. Use o ano indicado. Não invente data que não esteja no texto.`;

async function organizarTexto(texto: string) {
  const direto = lerTextoCalendario(texto);
  if (direto.length >= 8) return direto;
  const chave = process.env.LLM7_API_KEY?.trim();
  const cabecalhos: Record<string, string> = { "Content-Type": "application/json" };
  if (chave) cabecalhos.Authorization = `Bearer ${chave}`;
  const ano = anoDoTexto(texto);
  try {
    const res = await fetch("https://api.llm7.io/v1/chat/completions", {
      method: "POST",
      headers: cabecalhos,
      signal: AbortSignal.timeout(22000),
      body: JSON.stringify({
        model: "default",
        max_tokens: 1800,
        temperature: 0,
        messages: [
          { role: "system", content: PEDIDO },
          { role: "user", content: `Ano: ${ano}\n\n${texto.slice(0, 12000)}` },
        ],
      }),
    });
    if (res.ok) {
      const body = (await res.json()) as { choices?: { message?: { content?: string } }[] };
      const lido = lerJsonCalendario(body.choices?.[0]?.message?.content ?? "");
      if (lido.length > direto.length) return lido;
    }
  } catch {
    /* o texto já lido continua valendo */
  }
  return direto;
}

export async function lerImagemCalendario(imagem: string): Promise<FeriadoLido[]> {
  const corpo = new FormData();
  corpo.set("apikey", "helloworld");
  corpo.set("language", "por");
  corpo.set("base64Image", imagem);
  corpo.set("OCREngine", "2");
  corpo.set("scale", "true");
  corpo.set("isTable", "true");
  corpo.set("detectOrientation", "true");
  const res = await fetch("https://api.ocr.space/parse/image", {
    method: "POST",
    body: corpo,
    signal: AbortSignal.timeout(28000),
  });
  if (!res.ok) throw new Error("Não foi possível ler a imagem agora.");
  const body = (await res.json()) as {
    IsErroredOnProcessing?: boolean;
    ErrorMessage?: string[] | string;
    ParsedResults?: { ParsedText?: string }[];
  };
  if (body.IsErroredOnProcessing) {
    const mensagem = Array.isArray(body.ErrorMessage) ? body.ErrorMessage.join(" ") : body.ErrorMessage;
    throw new Error(mensagem || "A imagem não pôde ser lida. Tente um arquivo menor.");
  }
  const texto = (body.ParsedResults ?? []).map((item) => item.ParsedText ?? "").join("\n").trim();
  if (texto.length < 20) throw new Error("A imagem não tem texto suficiente. Envie o calendário com a lista de feriados legível.");
  const itens = await organizarTexto(texto);
  if (!itens.length) throw new Error("Não encontrei feriados nessa imagem. Envie o calendário do ano ou o do mês, com as datas escritas.");
  return itens;
}
