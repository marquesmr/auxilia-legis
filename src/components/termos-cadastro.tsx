import { useEffect, useRef, useState } from "react";

const DECLARACAO =
  "Declaro que li, compreendi e aceito integralmente os Termos de Uso e Diretrizes do Programa Auxilia Legis. Estou ciente de que o Programa é apenas ferramenta de organização e auxílio, não substitui controles oficiais nem prestações profissionais, e que a responsabilidade pelos prazos e andamentos é exclusivamente minha.";

export function TermosCadastro({ onContinuar, onVoltar }: { onContinuar: () => void; onVoltar: () => void }) {
  const leitura = useRef<HTMLDivElement>(null);
  const [fim, setFim] = useState(false);
  const [aceite, setAceite] = useState(false);

  function medir() {
    const caixa = leitura.current;
    if (!caixa) return;
    if (caixa.scrollTop + caixa.clientHeight >= caixa.scrollHeight - 16) setFim(true);
  }

  useEffect(() => {
    medir();
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 px-3 py-4 sm:items-center">
      <div className="flex max-h-[min(44rem,100%)] w-full max-w-xl flex-col rounded-2xl border border-line bg-sheet p-5">
        <h2 className="font-display text-2xl text-ink">Termos de Uso e Diretrizes</h2>
        <p className="mt-1 text-xs text-muted">Programa Auxilia Legis · Atualizado em 3 de novembro de 2026</p>
        <div
          ref={leitura}
          onScroll={medir}
          className="mt-3 min-h-0 flex-1 space-y-3 overflow-y-auto pr-1 text-sm leading-relaxed text-ink"
        >
          <TextoDosTermos />
        </div>
        <p className="mt-3 text-sm text-ink">{fim ? "Leitura concluída. O aceite já pode ser marcado." : "Role até o fim da leitura para marcar o aceite."}</p>
        <label className={`mt-3 flex items-start gap-3 rounded-xl border border-line bg-paper p-3 text-base leading-relaxed text-ink ${fim ? "" : "opacity-50"}`}>
          <input
            type="checkbox"
            className="mt-1 size-5 shrink-0"
            disabled={!fim}
            checked={aceite}
            onChange={(evento) => setAceite(evento.target.checked)}
          />
          <span className="text-justify font-medium">{DECLARACAO}</span>
        </label>
        <button
          type="button"
          disabled={!aceite}
          onClick={onContinuar}
          className="mt-3 inline-flex h-12 items-center justify-center rounded-xl bg-pine text-base font-medium text-sheet disabled:opacity-50"
        >
          Continuar
        </button>
        <button
          type="button"
          onClick={onVoltar}
          className="mt-2 inline-flex h-12 items-center justify-center rounded-xl border border-line bg-sheet text-base font-medium text-ink"
        >
          Voltar
        </button>
      </div>
    </div>
  );
}

export function TextoDosTermos() {
  return (
    <>
      <p className="text-justify">
        Vigência a partir da criação da conta ou do primeiro acesso. Estes Termos de Serviço regulam o site e o aplicativo Auxilia Legis, o mesmo programa nas duas formas.
      </p>
      <h3 className="pt-1 font-medium">1. Partes e aceitação</h3>
      <p className="text-justify">
        Estes Termos regulam o acesso e a utilização do programa Auxilia Legis, ferramenta digital de apoio ao lançamento, organização e acompanhamento de processos (requerimentos, projetos de lei, indicações e outros), incluindo controle de prazos e geração de notificações.
      </p>
      <p className="text-justify">
        O Programa é disponibilizado por Carlos Marques, com sede em Mário Campos/MG, doravante denominado Titular. Ao criar uma conta, marcar a opção de aceite ou utilizar o Programa, o usuário declara ter lido, compreendido e concordado integralmente com estes Termos, bem como com a Política de Privacidade vinculada. Se não concordar, não crie conta nem utilize o Programa.
      </p>
      <p className="text-justify">
        O uso do Programa por pessoa jurídica pressupõe que o representante possui poderes para vincular a entidade. A conta criada por e-mail exige a data de nascimento e só pode ser aberta por quem já completou 18 anos.
      </p>
      <h3 className="pt-1 font-medium">2. Descrição do serviço</h3>
      <p className="text-justify">
        O Auxilia Legis é uma ferramenta de organização e auxílio ao controle de prazos processuais e administrativos. Inclui cadastro de processos com número, parte, assunto, tipo, data, prazo e antecedência de aviso; registro de andamentos; classificação visual de status; e notificações do navegador, sujeitas a permissão e à página estar aberta, além de alertas visuais.
      </p>
      <p className="text-justify">
        O Programa não é sistema oficial de qualquer órgão público, Poder Legislativo, Judiciário ou entidade administrativa. Não substitui diários oficiais, sistemas de protocolo, certidões, intimações eletrônicas ou controles jurídicos formais.
      </p>
      <p className="text-justify">
        As informações cadastradas são de responsabilidade exclusiva do usuário que as lançou. O Programa apenas organiza e exibe o que foi informado. O Titular não confere, não valida e não tem como saber se a conta é compartilhada, se os dados são de terceiros, se estão corretos, completos ou se o uso infringe estes Termos ou a lei. Tudo o que entra no sistema — processos, partes, documentos, prazos, comunicações e qualquer outro conteúdo — não é de responsabilidade do Titular, criador do Programa.
      </p>
      <h3 className="pt-1 font-medium">3. Conta de usuário e segurança</h3>
      <p className="text-justify">
        Para sincronização entre dispositivos é necessária conta com nome, data de nascimento, e-mail válido e senha de no mínimo 8 caracteres, ou autenticação por Google ou X. O usuário é o único responsável pela veracidade dos dados cadastrais, pela confidencialidade da senha e por todas as atividades realizadas em sua conta.
      </p>
      <p className="text-justify">
        É vedado compartilhar credenciais, criar contas em nome de terceiros sem autorização ou utilizar contas de forma automatizada sem consentimento expresso do Titular. O Titular poderá suspender ou encerrar contas em caso de indícios de uso fraudulento, violação destes Termos ou risco à segurança do serviço.
      </p>
      <h3 className="pt-1 font-medium">4. Diretrizes de uso e condutas vedadas</h3>
      <p className="text-justify">
        O usuário compromete-se a utilizar o Programa de forma lícita, ética e em conformidade com a legislação brasileira aplicável. É vedado cadastrar dados falsos, incompletos ou de terceiros sem autorização legítima. É vedado armazenar conteúdo ilegal, difamatório, ofensivo, confidencial de terceiros ou que viole direitos de propriedade intelectual ou de privacidade.
      </p>
      <p className="text-justify">
        É vedado tentar acessar contas de outros usuários, realizar engenharia reversa, descompilar, interferir no funcionamento ou sobrecarregar a infraestrutura. É vedado utilizar o Programa para spam, phishing ou qualquer atividade ilícita. É vedado revender, sublicenciar ou explorar comercialmente o acesso ao Programa sem autorização escrita. O usuário é integralmente responsável pelo conteúdo que cadastra, por dados de terceiros que inserir e pelos andamentos que registra. O descumprimento dessas vedações não transfere a responsabilidade ao Titular, que não fiscaliza o uso de cada conta.
      </p>
      <h3 className="pt-1 font-medium">5. Prazos, notificações e limitação de escopo</h3>
      <p className="text-justify">
        As notificações e alertas são recursos auxiliares e dependem de fatores externos, como permissão do navegador, conexão, dispositivo ligado e dados corretamente cadastrados. O Auxilia Legis não garante o cumprimento de prazos. A responsabilidade pelo acompanhamento, correção, protocolo e cumprimento de qualquer prazo é exclusiva do usuário e de seus profissionais habilitados.
      </p>
      <p className="text-justify">
        O Programa não presta consultoria jurídica, não interpreta normas e não substitui a atuação de advogado, assessor parlamentar ou profissional competente. Em caso de dúvida sobre prazos legais ou regimentais, o usuário deve consultar as fontes oficiais e profissionais habilitados. O Titular não se responsabiliza por perda de prazo, preclusão, decadência, prescrição ou qualquer prejuízo decorrente de falha de notificação, imprecisão de dados cadastrados ou uso do Programa.
      </p>
      <h3 className="pt-1 font-medium">6. Proteção de dados pessoais</h3>
      <p className="text-justify">
        O tratamento de dados pessoais observa a Lei nº 13.709/2018. Bases legais incluem execução de contrato (art. 7º, V), legítimo interesse (art. 7º, IX) e consentimento, quando aplicável. Os dados dos processos cadastrados pelo usuário são tratados para a prestação do serviço e permanecem vinculados à conta do titular. Não há compartilhamento com outros usuários. A Política de Privacidade detalha o tratamento.
      </p>
      <p className="text-justify">
        As cópias de segurança são cifradas pelo próprio sistema. A chave não vai no arquivo. Nem o Titular, nem quem guardar o arquivo no computador ou no Google Drive, lê o conteúdo. Só o sistema decifra, e apenas no momento da restauração.
      </p>
      <p className="text-justify">
        O usuário tem os direitos previstos no art. 18 da LGPD, como acesso, correção, eliminação, portabilidade e informação sobre compartilhamentos. Pedidos devem ser encaminhados a contato@marquestecnologies.com. Dados poderão ser mantidos pelo prazo necessário ao cumprimento de obrigações legais ou ao exercício regular de direitos.
      </p>
      <h3 className="pt-1 font-medium">7. Propriedade intelectual</h3>
      <p className="text-justify">
        O código, a interface, as marcas, os logotipos e os demais elementos do Auxilia Legis são de propriedade do Titular ou de seus licenciadores. É concedida licença limitada, não exclusiva, intransferível e revogável de uso, exclusivamente para as finalidades destes Termos. Os dados cadastrados pelo usuário permanecem de sua propriedade. O usuário concede ao Titular licença limitada para armazenar, processar e exibir tais dados exclusivamente para a prestação do serviço.
      </p>
      <h3 className="pt-1 font-medium">8. Limitação de responsabilidade</h3>
      <p className="text-justify">
        O Programa é fornecido no estado em que se encontra e conforme disponível, sem garantias de disponibilidade ininterrupta, ausência de erros ou adequação a finalidade específica. Na máxima extensão permitida pela legislação brasileira, o Titular não será responsável por danos indiretos, lucros cessantes, perda de dados, perda de prazo ou prejuízos decorrentes do uso ou da impossibilidade de uso, de falhas de notificação, de dados incorretos cadastrados pelo usuário, ou de problemas de dispositivo, navegador, conexão ou exclusão de dados pelo próprio usuário.
      </p>
      <p className="text-justify">
        A responsabilidade total do Titular, quando legalmente cabível, limita-se ao valor eventualmente pago pelo usuário nos 12 meses anteriores ao evento, ou a zero, caso o serviço seja gratuito. O usuário indenizará o Titular por reclamações, perdas ou custos decorrentes de violação destes Termos ou de uso indevido do Programa.
      </p>
      <h3 className="pt-1 font-medium">9. Modificações, suspensão e encerramento</h3>
      <p className="text-justify">
        O Titular poderá alterar estes Termos a qualquer momento. Alterações relevantes serão comunicadas pelo Programa ou pelo e-mail cadastrado. O uso continuado após a publicação constitui aceitação. O usuário pode encerrar sua conta a qualquer momento, o que acarretará a exclusão dos dados vinculados, ressalvadas obrigações legais de retenção. O Titular poderá suspender ou encerrar o acesso em caso de violação destes Termos, risco à segurança ou descontinuidade do serviço, com ou sem aviso prévio, conforme a gravidade.
      </p>
      <h3 className="pt-1 font-medium">10. Disposições gerais</h3>
      <p className="text-justify">
        Estes Termos constituem o acordo integral entre as partes. A invalidade de qualquer cláusula não prejudica as demais. A tolerância quanto ao descumprimento não implica renúncia de direitos. Estes Termos são regidos pelas leis da República Federativa do Brasil. Fica eleito o foro da Comarca de Ibirité/MG, salvo hipóteses de foro obrigatório.
      </p>
      <h3 className="pt-1 font-medium">11. Contato</h3>
      <p className="text-justify">
        Dúvidas sobre estes Termos ou exercício de direitos de titular de dados: contato@marquestecnologies.com.
      </p>
    </>
  );
}
