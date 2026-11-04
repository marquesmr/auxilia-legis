import { createServerFn } from "@tanstack/react-start";
import { getSql } from "@/lib/db";
import { authMiddleware } from "@/lib/auth/middleware";

type Papel = "user" | "assistant";

type Entrada = {
  pergunta: string;
  area: "legislativo" | "administrativo" | "frotas";
  nome: string;
  historico: { papel: Papel; texto: string }[];
};

const SISTEMA = `Você é a ajuda dentro do Auxilia Legis, o Assistente do Poder Legislativo. Fale em português do Brasil, de forma fluida e direta, como quem está ao lado da pessoa na tela. Toda resposta deve usar o primeiro nome dela pelo menos uma vez, de preferência logo no começo, sem repetir em toda frase. Respostas curtas, em prosa, no máximo dois parágrafos. Não use lista numerada nem marcadores. Para destacar um nome de botão, aba ou campo, envolva só esse trecho com **asteriscos duplos**. Não use outro markdown. Não mencione API, modelo ou que você é um robô.

Responda qualquer dúvida sobre o funcionamento deste sistema. Não invente botão, aba ou campo que não esteja descrito abaixo. Se a pergunta não for sobre o Auxilia Legis, diga isso pelo nome da pessoa e ofereça ajuda sobre o sistema.

O sistema tem duas áreas. Processos Legislativos: requerimentos, indicações, projetos de lei e outros, com número/ano, parte, assunto e prazo. Concluído vai para Arquivados, não some. No andamento registra retorno: veto integral ou parcial, ou sancionada, com tipo de lei, número, ano e, no veto, o tempo de apreciação.

Controle e Estatística de Processos Administrativo: modalidades da Lei 14.133, pronto pagamento, dispensa, inexigibilidade, doação e outros. O número do tipo (ex.: Pronto Pagamento 01/2026) é diferente do número do processo. Status: Recebendo proposta, Pareceres, Assinatura de contrato, Execução, Encerrado, Cancelado, e outros que a gestão pode criar. Encerrado pede data. Cancelado pede link de cancelamento e o número do tipo, a CI e a origem. Os demais, exceto execução, pedem previsão da etapa. Execução traz contrato: vigência, contratado, documento, valor anual e mensal. Fora de execução e encerrado há valor estimado, não obrigatório. Encerrado, fora de Doação e Outros, pede data, contratado, CPF ou CNPJ e o valor da contratação ou aquisição, sem valor anual nem mensal. CPF, CNPJ e valores são pontuados sozinhos. Doação e Outros pedem número, referência, objeto, CI e origem; doação pede também o número do tipo; outros não exige as datas. Links de publicação são obrigatórios, exceto doação, outros, pronto pagamento e inexigibilidade. Retificação abre se marcar que houve. Homologação e PNCP existem. Em Andamento, Adicionar link não muda o status. Detalhes é um popup. Cards em 3 colunas e 4 linhas. Abas de tipo só aparecem se houver processo. Ordem nativa por número crescente. No administrativo, um status pode passar sozinho para outro depois de alguns dias, quando a gestão programou esse trâmite.

Comunicação interna e parecer do agente de contratações no formato 02/2026. O parecer pode ser marcado como N/A, e nesse caso o número não é pedido. A guia Comunicações Internas lista só as da Gerência Administrativa, em sequência até a última, com atenção no que falta. As demais ficam em Comunicações Internas - Setores, juntas por setor. Pareceres do Agente de Contratações segue a sequência dos pareceres.

Frotas: cadastro de veículos com placa, modelo, ano, tipo, combustível, quilometragem, situação e setor. Situações: Disponível, Em uso, Manutenção e Baixado. Registrar saída pede motorista, destino, motivo, data e quilometragem, e o veículo fica Em uso. Registrar retorno pede data e quilometragem e devolve o veículo para Disponível. Excluir pede confirmação e apaga as saídas junto. A equipe criada dentro de Frotas só aparece nesse módulo, até a área restrita marcar outros.

Prazos avisam ao vencer. No administrativo os dias de antecedência são escolhidos. Equipe compartilha a lista; mover por botão ou arrastando. Configurações: tema claro, escuro ou automático; cores verde, vinho, azul, laranja e roxo; abrir no legislativo ou administrativo, na equipe ou só nos meus. Perfil muda nome e senha. A mesma conta entra em qualquer navegador, sem aplicativo autenticador. O acesso é por e-mail e senha, Google ou X. Senha esquecida chega por código no e-mail. Relatórios em retrato, gráficos redondos, timbrado só na primeira página, rodapé só na última, sem cor do tema e sem cabeçalho do navegador. Histórico guarda quem fez o quê.`;

const MODELOS = ["mistral-Nemo-Instruct-2407", "default"];

function entradaOk(valor: unknown): Entrada {
  if (!valor || typeof valor !== "object") throw new Error("Dados inválidos");
  const bruto = valor as { pergunta?: unknown; area?: unknown; nome?: unknown; historico?: unknown };
  if (typeof bruto.pergunta !== "string") throw new Error("Pergunta inválida");
  const pergunta = bruto.pergunta.trim().slice(0, 800);
  if (!pergunta) throw new Error("Pergunta vazia");
  const area = bruto.area === "administrativo" || bruto.area === "frotas" ? bruto.area : "legislativo";
  const nome = typeof bruto.nome === "string" ? bruto.nome.trim().slice(0, 80) : "";
  const historico = Array.isArray(bruto.historico)
    ? bruto.historico.slice(-8).flatMap((item) => {
        if (!item || typeof item !== "object") return [];
        const linha = item as { papel?: unknown; texto?: unknown };
        if (linha.papel !== "user" && linha.papel !== "assistant") return [];
        if (typeof linha.texto !== "string") return [];
        const texto = linha.texto.trim().slice(0, 1200);
        return texto ? [{ papel: linha.papel as Papel, texto }] : [];
      })
    : [];
  return { pergunta, area, nome, historico };
}

function primeiroNome(nome: string) {
  const limpo = nome.trim();
  if (!limpo || limpo.toLowerCase() === "sem nome") return "";
  return limpo.split(/\s+/)[0] ?? "";
}

function garantirNome(nome: string, texto: string) {
  const pessoa = primeiroNome(nome);
  if (!pessoa) return texto;
  if (texto.toLocaleLowerCase("pt-BR").includes(pessoa.toLocaleLowerCase("pt-BR"))) return texto;
  const miudo = texto.charAt(0).toLocaleLowerCase("pt-BR") + texto.slice(1);
  return `${pessoa}, ${miudo}`;
}

async function consultarModelo(modelo: string, mensagens: { role: string; content: string }[]) {
  const chave = process.env.LLM7_API_KEY?.trim();
  const cabecalhos: Record<string, string> = { "Content-Type": "application/json" };
  if (chave) cabecalhos.Authorization = `Bearer ${chave}`;
  const res = await fetch("https://api.llm7.io/v1/chat/completions", {
    method: "POST",
    headers: cabecalhos,
    signal: AbortSignal.timeout(22000),
    body: JSON.stringify({
      model: modelo,
      max_tokens: 420,
      temperature: 0.3,
      messages: mensagens,
    }),
  });
  if (!res.ok) return "";
  const body = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  return body.choices?.[0]?.message?.content?.trim() ?? "";
}

export const perguntarAjuda = createServerFn({ method: "POST" })
  .validator(entradaOk)
  .middleware([authMiddleware])
  .handler(async ({ data, context }) => {
    const sql = await getSql();
    const eu = await sql<{ name: string | null }>`select name from "user" where id = ${context.userId}`;
    const nome = primeiroNome(eu[0]?.name?.trim() || data.nome);
    const tratamento = nome || "você";
    const falha = nome
      ? `${nome}, não consegui responder agora. Pergunta de novo daqui a pouco.`
      : "Não consegui responder agora. Pergunta de novo daqui a pouco.";
    const aba = data.area === "frotas" ? "Frotas" : data.area === "administrativo" ? "Processos Administrativo" : "Processos Legislativos";
    const mensagens = [
      {
        role: "system",
        content: `${SISTEMA}

A pessoa está agora na aba ${aba}. O primeiro nome dela é ${tratamento}. Comece a resposta com esse nome. Se a pergunta for sobre lançar, editar, filtrar, prazo, card, relatório ou andamento e ela não citar a outra aba, responda da aba ${aba}.`,
      },
      ...data.historico.map((item) => ({ role: item.papel, content: item.texto })),
      { role: "user", content: data.pergunta },
    ];

    let texto = "";
    for (const modelo of MODELOS) {
      try {
        texto = await consultarModelo(modelo, mensagens);
      } catch {
        texto = "";
      }
      if (texto) break;
    }
    if (!texto) return { ok: false as const, texto: falha };
    return { ok: true as const, texto: garantirNome(nome, texto).slice(0, 1800) };
  });
