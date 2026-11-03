import { createServerFn } from "@tanstack/react-start";
import { getSql } from "@/lib/db";
import { authMiddleware } from "@/lib/auth/middleware";

type Papel = "user" | "assistant";

type Entrada = {
  pergunta: string;
  area: "legislativo" | "administrativo";
  historico: { papel: Papel; texto: string }[];
};

const SISTEMA = `Você é a ajuda dentro do Auxilia Legis, o Assistente do Poder Legislativo. Fale em português do Brasil, de forma fluida e direta, como quem está ao lado da pessoa na tela. Use o primeiro nome dela com naturalidade, sem repetir em toda frase. Respostas curtas, em dois ou três parágrafos no máximo, sem lista seca, sem mencionar API, modelo ou que você é um robô. Para destacar um nome de botão, aba ou campo, envolva só esse trecho com **asteriscos duplos**. Não use outro markdown.

Regras:
- Se a pessoa disser "mostre", "mostra", "sim", "quero" ou "o caminho", continue o assunto anterior e diga exatamente onde clicar.
- Se perguntar como fazer algo sem citar a outra área, responda apenas da aba que está aberta. Diga o nome dessa aba na primeira frase.
- Não invente função que não está descrita abaixo.

O sistema tem duas áreas. Processos Legislativos: requerimentos, indicações, projetos de lei e outros, com número/ano, parte, assunto e prazo. Concluído vai para Arquivados, não some. No andamento registra retorno: veto integral ou parcial, ou sancionada, com tipo de lei, número, ano e, no veto, o tempo de apreciação.

Controle e Estatística de Processos Administrativo: modalidades da Lei 14.133, pronto pagamento, dispensa, inexigibilidade, doação e outros. O número do tipo (ex.: Pronto Pagamento 01/2026) é diferente do número do processo. Status: Recebendo proposta, Pareceres, Assinatura de contrato, Execução, Encerrado, Cancelado. Encerrado pede data. Cancelado pede link de cancelamento e o número do tipo, a CI e a origem. Os demais, exceto execução, pedem previsão da etapa. Execução traz contrato: vigência, contratado, documento, valor anual e mensal. Fora de execução e encerrado há valor estimado, não obrigatório. Encerrado e pronto pagamento pedem só o total. CPF, CNPJ e valores são pontuados sozinhos. Doação e Outros pedem número, referência, objeto, CI e origem; doação pede também o número do tipo; outros não exige as datas. Links de publicação são obrigatórios, exceto doação, outros, pronto pagamento e inexigibilidade. Retificação abre se marcar que houve. Homologação e PNCP existem. Em Andamento, Adicionar link não muda o status. Detalhes é um popup. Cards em 3 colunas e 4 linhas. Abas de tipo só aparecem se houver processo. Ordem nativa por número crescente.

Comunicação interna e parecer do agente de contratações no formato 02/2026. A guia Comunicações Internas lista só as da Gerência Administrativa, em sequência até a última, com atenção no que falta. As demais ficam em Comunicações Internas - Setores, juntas por setor. Pareceres do Agente de Contratações segue a sequência dos pareceres.

Prazos avisam ao vencer. No administrativo os dias de antecedência são escolhidos. Equipe compartilha a lista; mover por botão ou arrastando. Configurações: tema claro, escuro ou automático; cores verde, vinho, azul, laranja e roxo; abrir no legislativo ou administrativo, na equipe ou só nos meus. Perfil muda nome e senha. A mesma conta entra em qualquer navegador, sem aplicativo autenticador. Senha esquecida chega por código no e-mail. Relatórios em retrato, gráficos redondos, timbrado só na primeira página, rodapé só na última, sem cor do tema e sem cabeçalho do navegador. Histórico guarda quem fez o quê.`;

function entradaOk(valor: unknown): Entrada {
  if (!valor || typeof valor !== "object") throw new Error("Dados inválidos");
  const bruto = valor as { pergunta?: unknown; area?: unknown; historico?: unknown };
  if (typeof bruto.pergunta !== "string") throw new Error("Pergunta inválida");
  const pergunta = bruto.pergunta.trim().slice(0, 800);
  if (!pergunta) throw new Error("Pergunta vazia");
  const area = bruto.area === "administrativo" ? "administrativo" : "legislativo";
  const historico = Array.isArray(bruto.historico)
    ? bruto.historico.slice(-8).flatMap((item) => {
        if (!item || typeof item !== "object") return [];
        const linha = item as { papel?: unknown; texto?: unknown };
        const papel: Papel = linha.papel === "assistant" ? "assistant" : "user";
        if (linha.papel !== "user" && linha.papel !== "assistant") return [];
        if (typeof linha.texto !== "string") return [];
        const texto = linha.texto.trim().slice(0, 1200);
        return texto ? [{ papel, texto }] : [];
      })
    : [];
  return { pergunta, area, historico };
}

export const perguntarAjuda = createServerFn({ method: "POST" })
  .validator(entradaOk)
  .middleware([authMiddleware])
  .handler(async ({ data, context }) => {
    const apiKey = process.env.XAI_API_KEY;
    if (!apiKey) return { ok: false as const, texto: "" };

    const sql = await getSql();
    const eu = await sql<{ name: string | null }>`select name from "user" where id = ${context.userId}`;
    const nome = eu[0]?.name?.trim() || "";
    const administrativa = data.area === "administrativo";
    const aba = administrativa ? "Processos administrativos" : "Processos legislativos";
    const outra = administrativa ? "Processos legislativos" : "Processos administrativos";

    const res = await fetch("https://api.x.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "grok-4.5",
        max_tokens: 380,
        temperature: 0.4,
        messages: [
          {
            role: "system",
            content: `${SISTEMA}

DADO DA TELA, prioridade máxima:
A pessoa está AGORA na aba ${aba}. O nome do perfil é ${nome || "não informado"}.
Se a pergunta for sobre lançar, editar, filtrar, prazo, card, relatório ou andamento e ela não citar a outra aba, responda somente de ${aba}. Não misture com ${outra}. Na primeira frase, deixe claro que ela está em ${aba}.
Só fale de ${outra} se a pergunta nomear essa área.`,
          },
          ...data.historico.map((item) => ({ role: item.papel, content: item.texto })),
          {
            role: "user",
            content: `Aba aberta na tela: ${aba}.\nPergunta: ${data.pergunta}`,
          },
        ],
      }),
    });
    if (!res.ok) return { ok: false as const, texto: "" };
    const body = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const texto = body.choices?.[0]?.message?.content?.trim() ?? "";
    if (!texto) return { ok: false as const, texto: "" };
    return { ok: true as const, texto: texto.slice(0, 1800) };
  });
