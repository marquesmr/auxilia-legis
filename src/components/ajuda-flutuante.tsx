import { useEffect, useRef, useState, type FormEvent } from "react";
import { perguntarAjuda } from "@/lib/ajuda.functions";
import { MessageCircle, Send, X } from "lucide-react";

type Mensagem = { de: "pessoa" | "ajuda"; texto: string };
type Tom = "explica" | "caminho" | "lugar";

const SUGESTOES = ["Oi, o que você faz?", "Como lanço um prazo?", "E a equipe?", "Me explica o relatório"];

const TOPICOS: {
  id: string;
  chaves: string[];
  explica: string;
  caminho: string;
  lugar: string;
}[] = [
  {
    id: "prazo",
    chaves: ["prazo", "aviso", "notific", "venc", "atencao", "alerta"],
    explica:
      "o prazo é a data em que aquele processo precisa de resposta ou de andamento. Eu fico de olho e te aviso quando está chegando, quando vence hoje e quando já passou. No administrativo você escolhe com quantos dias de antecedência quer esse alerta.",
    caminho:
      "no legislativo, o prazo entra junto com o lançamento. No administrativo, o aviso usa a data de encerramento ou a previsão da etapa, e os dias antes ficam no próprio processo.",
    lugar: "os que precisam de atenção aparecem no aviso do topo da lista, antes dos cards.",
  },
  {
    id: "legislativo",
    chaves: ["legislativ", "requerimento", "indicac", "projeto de lei", "arquivad", "veto", "sancion"],
    explica:
      "a parte legislativa é para requerimentos, indicações, projetos de lei e outros. Você lança número, parte, assunto e prazo. Quando marca como concluído, ele não some: vai para Arquivados. No andamento dá para dizer se voltou como veto, integral ou parcial, ou sancionada, com o tipo de lei, número, ano e, no veto, o tempo de apreciação.",
    caminho:
      "abre Processos Legislativos e usa Novo processo. Para concluir, entra no andamento. O retorno, veto ou sanção, também fica ali.",
    lugar: "é a primeira área, o botão Processos Legislativos. Arquivados fica no filtro de situação.",
  },
  {
    id: "administrativo",
    chaves: ["administrativ", "licitac", "modalidade", "pregao", "dispensa", "inexigib", "pronto pagamento", "concorrencia", "leilao"],
    explica:
      "o administrativo cuida das contratações. O tipo segue as modalidades da Lei 14.133, e também pronto pagamento, dispensa, inexigibilidade, doação e outros. O número do tipo, como Pronto Pagamento 01/2026, é outro número: não é o número do processo, e você lança os dois separados.",
    caminho:
      "entra em Controle e Estatística de Processos Administrativo e lança por lá. Primeiro o tipo, depois o número daquele tipo, e o número do processo com o ano.",
    lugar: "é o segundo botão grande, ao lado de Processos Legislativos.",
  },
  {
    id: "status",
    chaves: ["status", "situacao", "proposta", "pareceres", "assinatura", "execucao", "encerrad", "cancelad"],
    explica:
      "no administrativo o processo caminha por Recebendo proposta, Pareceres, Assinatura de contrato, Execução, Encerrado ou Cancelado. Encerrado pede a data. Cancelado pede o link de cancelamento e ainda assim o número do tipo. Os outros, menos a execução, pedem a previsão da etapa. Execução é quando entram os dados do contrato.",
    caminho: "o status muda em Andamento, sem precisar lançar o processo de novo. A previsão ou a data de encerramento aparecem conforme o status que você escolher.",
    lugar: "o status está no card e também nas abas de baixo. Só aparecem as situações que já têm algum processo.",
  },
  {
    id: "contrato",
    chaves: ["contrato", "valor", "mensal", "anual", "estimado", "cnpj", "cpf", "contratado", "vigencia"],
    explica:
      "se tiver contrato, você informa vigência, quem foi contratado, o documento e o valor anual e o mensal. Fora de execução e de encerrado existe um valor estimado, e ele não é obrigatório. Encerrado e pronto pagamento pedem só o total. CPF, CNPJ e valores eu pontuo sozinho.",
    caminho: "esses campos abrem quando o status é Execução, ou quando você marca que possui contrato. O estimado aparece nos outros status, menos encerrado.",
    lugar: "no card o valor fica resumido. O detalhe completo, com documento e vigência, está no popup de Detalhes.",
  },
  {
    id: "link",
    chaves: ["link", "pncp", "publicac", "retific", "homolog", "cancelamento"],
    explica:
      "dá para guardar publicação, retificação, homologação, PNCP e cancelamento. Publicação é obrigatória, menos em doação, outros, pronto pagamento e inexigibilidade. Se houve retificação, abre o campo do link. Cancelado exige o link de cancelamento. Nos detalhes eles viram botões, com o ícone e o nome.",
    caminho:
      "no lançamento, a publicação vem depois dos dados principais. A retificação só aparece se você marcar que houve. Em Andamento, Adicionar link inclui um endereço sem mudar o status.",
    lugar: "os botões de link ficam dentro de Detalhes, não no card.",
  },
  {
    id: "pecas",
    chaves: ["comunicacao", "parecer", "origem", "interna", "agente"],
    explica:
      "todo administrativo pede a comunicação interna, de onde ela veio, e o parecer do agente de contratações. Os dois números são no formato número e ano, com duas casas abaixo de 10, e o ano você escolhe na hora. A guia Comunicações Internas mostra só as da Gerência Administrativa, em sequência até a última, e o que falta aparece com atenção. As dos outros setores ficam em Comunicações Internas - Setores. A guia Pareceres do Agente de Contratações faz a mesma sequência dos pareceres. Também existe um relatório só dessas peças.",
    caminho: "preenche no lançamento, junto com o processo. O ano é uma lista, não precisa digitar a barra.",
    lugar: "no card isso não aparece inteiro. Abre Detalhes, ou gera o relatório de comunicações internas e pareceres.",
  },
  {
    id: "equipe",
    chaves: ["equipe", "compartilh", "mover", "arrast", "colega"],
    explica:
      "a equipe junta outras pessoas na mesma lista, para ninguém perder o prazo. Você move um processo dos seus para a equipe, e o contrário, pelo botão ou arrastando o card. Nas configurações escolhe se o sistema abre nos seus ou na equipe.",
    caminho: "cria a equipe no perfil da equipe, convida pelo e-mail de quem já tem conta, e depois arrasta o card ou usa mover.",
    lugar: "a troca entre os seus processos e a equipe fica na própria lista, acima dos cards.",
  },
  {
    id: "relatorio",
    chaves: ["relatorio", "imprim", "pdf", "timbrad", "rodape"],
    explica:
      "o relatório junta o que está em aberto, concluído ou em execução, por mês, trimestre, semestre ou ano, sempre em ordem crescente de número. Na hora de imprimir sai em retrato, com o timbrado só na primeira página e o rodapé só na última. A cor do tema não entra na folha.",
    caminho: "abre a aba do relatório, escolhe o período e a situação, gera e usa Imprimir ou salvar PDF. No administrativo também dá para tirar só as comunicações e os pareceres.",
    lugar: "fica na área de cada lado, legislativo ou administrativo, na guia de relatório.",
  },
  {
    id: "grafico",
    chaves: ["grafico", "estatistic", "controle e estat", "donut"],
    explica:
      "os gráficos mostram a situação, o tipo e, no administrativo, valor anual, mensal e por tipo, com o número e a referência. No legislativo também entra o retorno do andamento e o que foi ou não respondido no prazo. Eles se atualizam sozinhos, sem recarregar a página, e vão juntos no relatório.",
    caminho: "no administrativo, em cima do gráfico, você troca a visão: situação, tipo ou valores. No legislativo os quatro aparecem lado a lado.",
    lugar: "é a guia de estatística. No administrativo o nome dela é Controle e Estatística de Processos.",
  },
  {
    id: "tema",
    chaves: ["tema", "cor", "escuro", "claro", "configurac", "vinho", "laranja", "roxo", "azul"],
    explica:
      "nas configurações você escolhe claro, escuro ou automático, que segue o aparelho, e a cor: verde, vinho, azul, laranja ou roxo. Se não mexer, o claro fica verde e o escuro fica azul. Também escolhe se abre no legislativo ou no administrativo, e se começa na equipe ou só nos seus.",
    caminho: "o ícone de configuração fica ao lado do botão Perfil. A troca vale na hora.",
    lugar: "canto superior, junto do perfil.",
  },
  {
    id: "conta",
    chaves: ["perfil", "senha", "login", "conta", "nome"],
    explica:
      "a conta é o que guarda tudo, então você entra com o mesmo e-mail em outro navegador e os processos continuam. Para criar a conta, o e-mail recebe um código e só depois da confirmação a conta existe. No perfil muda o nome, que aparece como autor, e a senha. A senha esquecida chega por código no e-mail.",
    caminho: "para trocar a senha, abre Perfil.",
    lugar: "Perfil é o botão ao lado da configuração, no topo.",
  },
  {
    id: "detalhe",
    chaves: ["detalhe", "andamento", "popup", "objeto", "referencia", "historico", "autor"],
    explica:
      "o card fica curto de propósito. Detalhes abre tudo o que não coube: objeto justificado, comunicação interna, links, valores e o histórico de quem fez o quê. Andamento serve para mudar o status e as datas, e também para acrescentar um link sem alterar a situação.",
    caminho: "no card administrativo, o botão Detalhes abre o popup. Andamento é o outro botão, ao lado.",
    lugar: "os dois botões ficam no próprio card.",
  },
  {
    id: "especiais",
    chaves: ["doacao", "outros"],
    explica:
      "doação e outros são mais leves. Pedem número do processo, referência, objeto, comunicação interna e a origem. Doação pede também o número do tipo. Outros, no administrativo, fica no status e não exige as datas das outras modalidades. Os links não são obrigatórios nesses dois, nem no pronto pagamento e na inexigibilidade.",
    caminho: "escolhe o tipo Doação ou Outros no lançamento. O formulário esconde o que não se aplica.",
    lugar: "eles entram na mesma lista administrativa, e só ganham aba se já existir algum.",
  },
  {
    id: "lista",
    chaves: ["filtro", "aba", "ordem", "card", "coluna", "parte", "pagina"],
    explica:
      "as abas separam por tipo e por situação, e uma aba só aparece se já houver processo daquele tipo. Dá para ordenar por número, tipo ou prazo. No administrativo os cards ficam em três colunas e quatro linhas; o que passar disso vai para a parte seguinte, e você navega entre elas.",
    caminho: "Todos fica no começo da faixa de tipos. A ordem crescente de número já vem ligada.",
    lugar: "as faixas de abas ficam logo abaixo do aviso de prazos.",
  },
];

function semAcento(valor: string) {
  return valor
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function primeiroNome(nome: string) {
  const limpo = nome.trim();
  if (!limpo || semAcento(limpo) === "sem nome") return "";
  return limpo.split(/\s+/)[0];
}

function dirigir(nome: string, texto: string) {
  const pessoa = primeiroNome(nome);
  const miudo = texto.charAt(0).toLowerCase() + texto.slice(1);
  return pessoa ? `${pessoa}, ${miudo}` : texto;
}

function acharTopicos(pergunta: string) {
  const texto = semAcento(pergunta);
  return TOPICOS.map((item) => ({
    item,
    pontos: item.chaves.reduce((soma, chave) => (texto.includes(semAcento(chave)) ? soma + chave.length : soma), 0),
  }))
    .filter((item) => item.pontos > 0)
    .sort((a, b) => b.pontos - a.pontos);
}

function tomDaPergunta(pergunta: string): Tom {
  const texto = semAcento(pergunta);
  if (/\b(como|faco|uso|lanco|acesso|entro|imprimo|gero|mudo|troco|crio|adiciono)\b/.test(texto)) return "caminho";
  if (/\b(onde|aonde|qual tela|em que lugar|cadê|cade)\b/.test(texto)) return "lugar";
  return "explica";
}

function responder(pergunta: string, nome: string, anterior: string, area: "legislativo" | "administrativo") {
  const texto = semAcento(pergunta);
  const pessoa = primeiroNome(nome);
  const oi = /^(oi|ola|bom dia|boa tarde|boa noite|e ai|tudo bem|hey|opa)\b/.test(texto);
  const agradecer = /\b(obrigad|valeu|agradeco|perfeito|show|entendi)\b/.test(texto);
  const quem = /\b(quem e voce|o que voce faz|pra que voce serve|como voce funciona)\b/.test(texto);
  const seguir =
    /\b(mais|detalh|continua|explica melhor|e isso|como assim|aprofunda|mostre|mostra|mostrar|sim|quero|pode|caminho|na tela)\b/.test(texto) &&
    acharTopicos(pergunta).length === 0;

  if (oi) {
    return pessoa
      ? `Oi, ${pessoa}. Pode perguntar qualquer coisa do sistema, do seu jeito. Prazo, equipe, relatório, um status, um botão… eu te respondo daqui.`
      : "Oi. Pode perguntar qualquer coisa do sistema, do seu jeito. Prazo, equipe, relatório, um status, um botão… eu te respondo daqui.";
  }
  if (agradecer) {
    return pessoa
      ? `Imagina, ${pessoa}. Se pintar outra dúvida no meio do lançamento, é só chamar.`
      : "Imagina. Se pintar outra dúvida no meio do lançamento, é só chamar.";
  }
  if (quem) {
    return dirigir(
      nome,
      "eu fico neste canto para explicar o Auxilia Legis enquanto você usa. Não lanço processo no seu lugar, mas te digo onde cada coisa está e como ela se comporta.",
    );
  }

  const achados = acharTopicos(pergunta);
  const citaOutra =
    (area === "administrativo" && /\blegislativ/.test(texto)) ||
    (area === "legislativo" && /\badministrativ/.test(texto));
  let escolhido: (typeof TOPICOS)[number] | undefined =
    achados[0]?.item ?? (seguir ? TOPICOS.find((item) => item.id === anterior) : undefined);
  if (!citaOutra && /\b(processo|lanc|lan[cç]|relatorio|card|filtro|prazo|andamento)\b/.test(texto)) {
    const daAba = TOPICOS.find((item) => item.id === (area === "administrativo" ? "administrativo" : "legislativo"));
    if (!escolhido || escolhido.id === "legislativo" || escolhido.id === "administrativo") escolhido = daAba;
  }
  if (!escolhido) {
    return dirigir(
      nome,
      "isso eu não encontro como uma função daqui. O que eu conheço bem é prazo, legislativo, administrativo, status, contrato, links, comunicação interna, equipe, relatório, gráfico, tema, conta e os cards. Me diz qual delas você quer entender.",
    );
  }

  const tom = seguir ? "caminho" : tomDaPergunta(pergunta);
  const onde = area === "administrativo" ? "Você está em Processos administrativos. " : "Você está em Processos legislativos. ";
  const nucleo = escolhido.id === "legislativo" || escolhido.id === "administrativo" ? `${onde}${escolhido[tom]}` : escolhido[tom];
  const extra = achados[1] && achados[1].pontos > 3 ? ` E, já que você tocou nisso, ${achados[1].item.explica}` : "";
  const fecho = tom === "explica" ? " Se quiser, eu te mostro o caminho na tela." : "";
  return dirigir(nome, `${nucleo}${extra}${fecho}`);
}

function comArea(pergunta: string, resposta: string, area: "legislativo" | "administrativo") {
  const base = semAcento(resposta);
  const pedido = semAcento(pergunta);
  const estaNaResposta = area === "administrativo" ? /\badministrativ/.test(base) : /\blegislativ/.test(base);
  const pediuOutra =
    (area === "administrativo" && /\blegislativ/.test(pedido)) || (area === "legislativo" && /\badministrativ/.test(pedido));
  if (estaNaResposta || pediuOutra) return resposta;
  if (!/\b(processo|lanc|como|onde|relatorio|card|filtro|prazo|andamento|aba|mostra|mostre)\b/.test(pedido)) return resposta;
  const onde = area === "administrativo" ? "Processos administrativos" : "Processos legislativos";
  return `Você está em **${onde}**. ${resposta}`;
}

function TextoAjuda({ texto }: { texto: string }) {
  const partes = texto.split(/(\*\*[\s\S]+?\*\*)/g);
  return partes.map((parte, indice) => {
    if (parte.startsWith("**") && parte.endsWith("**") && parte.length > 4) {
      return (
        <span key={indice} className="text-pine">
          {parte.slice(2, -2)}
        </span>
      );
    }
    return <span key={indice}>{parte}</span>;
  });
}

export function AjudaFlutuante({ nome, area }: { nome: string; area: "legislativo" | "administrativo" }) {
  const [aberto, setAberto] = useState(false);
  const [texto, setTexto] = useState("");
  const [digitando, setDigitando] = useState(false);
  const [ultimo, setUltimo] = useState("");
  const fim = useRef<HTMLDivElement>(null);
  const [mensagens, setMensagens] = useState<Mensagem[]>(() => [
    {
      de: "ajuda",
      texto: primeiroNome(nome)
        ? `Oi, ${primeiroNome(nome)}. Estou por aqui se você quiser saber o que alguma função faz. Pergunta do jeito que vier na cabeça.`
        : "Oi. Estou por aqui se você quiser saber o que alguma função faz. Pergunta do jeito que vier na cabeça.",
    },
  ]);

  useEffect(() => {
    fim.current?.scrollIntoView({ block: "end" });
  }, [mensagens, digitando, aberto]);

  async function enviar(valor: string) {
    const pergunta = valor.trim();
    if (!pergunta || digitando) return;
    const respostaLocal = responder(pergunta, nome, ultimo, area);
    const achados = acharTopicos(pergunta);
    if (achados[0]) setUltimo(achados[0].item.id);
    else if (/\b(processo|lanc)\b/.test(semAcento(pergunta))) setUltimo(area === "administrativo" ? "administrativo" : "legislativo");
    const historico = mensagens.slice(-8).map((item) => ({
      papel: item.de === "pessoa" ? ("user" as const) : ("assistant" as const),
      texto: item.texto,
    }));
    setMensagens((lista) => [...lista, { de: "pessoa", texto: pergunta }]);
    setTexto("");
    setDigitando(true);
    const inicio = Date.now();
    let textoResposta = "";
    try {
      const vinda = await perguntarAjuda({ data: { pergunta, area, historico } });
      textoResposta = vinda.ok ? vinda.texto : "";
    } catch {
      textoResposta = "";
    }
    if (!textoResposta) textoResposta = respostaLocal;
    textoResposta = comArea(pergunta, textoResposta, area);
    const falta = 700 - (Date.now() - inicio);
    if (falta > 0) await new Promise((resolver) => window.setTimeout(resolver, falta));
    setMensagens((lista) => [...lista, { de: "ajuda", texto: textoResposta }]);
    setDigitando(false);
  }

  function aoEnviar(evento: FormEvent) {
    evento.preventDefault();
    enviar(texto);
  }

  return (
    <div className="no-print fixed bottom-4 right-4 z-30 flex flex-col items-end gap-2">
      {aberto && (
        <section
          className="flex h-[min(32rem,calc(100vh-6rem))] w-[min(22rem,calc(100vw-2rem))] flex-col overflow-hidden rounded-2xl border border-line bg-sheet shadow-lg"
          aria-label="Ajuda do sistema"
        >
          <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
            <div>
              <p className="text-sm font-medium text-ink">Ajuda</p>
              <p className="text-xs text-muted">
                {digitando
                  ? "Digitando…"
                  : area === "administrativo"
                    ? "Você está em Processos administrativos"
                    : "Você está em Processos legislativos"}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setAberto(false)}
              className="grid size-9 place-items-center rounded-lg text-muted"
              aria-label="Fechar ajuda"
            >
              <X className="size-4" />
            </button>
          </div>
          <div className="flex flex-1 flex-col gap-2 overflow-y-auto px-3 py-3">
            {mensagens.map((mensagem, indice) => (
              <p
                key={indice}
                className={
                  "max-w-[92%] rounded-2xl px-3 py-2 text-sm leading-relaxed " +
                  (mensagem.de === "pessoa" ? "ml-auto bg-pine text-sheet" : "bg-paper text-ink")
                }
              >
                {mensagem.de === "ajuda" ? <TextoAjuda texto={mensagem.texto} /> : mensagem.texto}
              </p>
            ))}
            {digitando && (
              <p className="flex h-9 w-16 items-center gap-1 rounded-2xl bg-paper px-3" aria-label="Digitando">
                <i className="size-1.5 animate-bounce rounded-full bg-muted [animation-delay:0ms]" />
                <i className="size-1.5 animate-bounce rounded-full bg-muted [animation-delay:150ms]" />
                <i className="size-1.5 animate-bounce rounded-full bg-muted [animation-delay:300ms]" />
              </p>
            )}
            <div ref={fim} />
          </div>
          <div className="flex flex-wrap gap-1.5 px-3 pb-2">
            {SUGESTOES.map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => enviar(item)}
                disabled={digitando}
                className="rounded-full border border-line px-2.5 py-1 text-xs text-ink disabled:opacity-50"
              >
                {item}
              </button>
            ))}
          </div>
          <form onSubmit={aoEnviar} className="flex gap-2 border-t border-line p-3">
            <input
              value={texto}
              onChange={(evento) => setTexto(evento.target.value)}
              placeholder={primeiroNome(nome) ? `Pergunte, ${primeiroNome(nome)}` : "Pergunte sobre o sistema"}
              className="h-11 min-w-0 flex-1 rounded-xl border border-line bg-paper px-3 text-sm text-ink"
              spellCheck
              lang="pt-BR"
              disabled={digitando}
            />
            <button
              type="submit"
              disabled={digitando}
              className="grid size-11 shrink-0 place-items-center rounded-xl bg-pine text-sheet disabled:opacity-50"
              aria-label="Enviar pergunta"
            >
              <Send className="size-4" />
            </button>
          </form>
        </section>
      )}
      <button
        type="button"
        onClick={() => setAberto((valor) => !valor)}
        className="grid size-14 place-items-center rounded-full bg-pine text-sheet shadow-lg"
        aria-label={aberto ? "Fechar ajuda" : "Abrir ajuda"}
        aria-expanded={aberto}
      >
        {aberto ? <X className="size-5" /> : <MessageCircle className="size-6" />}
      </button>
    </div>
  );
}
