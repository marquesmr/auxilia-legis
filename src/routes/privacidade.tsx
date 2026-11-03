import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/privacidade")({
  head: () => ({
    meta: [
      { title: "Política de Privacidade · Auxilia Legis" },
      {
        name: "description",
        content:
          "Política de Privacidade do Auxilia Legis, em conformidade com a Lei nº 13.709/2018.",
      },
    ],
  }),
  component: Privacidade,
});

function Titulo({ children }: { children: string }) {
  return <h2 className="pt-4 font-medium text-ink">{children}</h2>;
}

function Privacidade() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      <p className="text-xs text-muted">Programa Auxilia Legis · Vigente a partir de 3 de novembro de 2026</p>
      <h1 className="mt-2 font-display text-4xl text-ink">Política de Privacidade</h1>
      <div className="mt-6 space-y-3 text-sm leading-relaxed text-ink">
        <p className="text-justify">
          Esta Política descreve como são tratados dados pessoais no Auxilia Legis, disponível em auxilialegis.online. O tratamento observa a Lei nº 13.709/2018 (Lei Geral de Proteção de Dados Pessoais), o Marco Civil da Internet (Lei nº 12.965/2014) no que couber, e as demais normas brasileiras aplicáveis.
        </p>

        <Titulo>1. Controlador</Titulo>
        <p className="text-justify">
          O controlador dos dados da conta e da operação do Programa é Carlos Marques, com sede em Mário Campos/MG. Não há encarregado nomeado nos termos do art. 41 da LGPD, por se tratar de agente de tratamento de pequeno porte. Pedidos do titular são recebidos diretamente pelo controlador, no e-mail contato@marquestecnologies.com.
        </p>
        <p className="text-justify">
          Há dois papéis distintos. Em relação ao cadastro, à sessão, aos registros de segurança e à conta, Carlos Marques é controlador. Em relação aos dados de terceiros que o próprio usuário lança nos processos, como nome de parte, CPF, CNPJ, contratado ou comunicação interna, o usuário é quem decide o conteúdo e a finalidade; o Programa atua como operador, nos termos do art. 5º, VII, da LGPD, limitando-se a armazenar e exibir esses dados para a conta e a equipe escolhidas pelo usuário.
        </p>

        <Titulo>2. Quais dados são tratados</Titulo>
        <p className="text-justify">
          Dados da conta: nome, data de nascimento escolhida na criação da conta por e-mail, e-mail, hash da senha (a senha em texto claro não é guardada), identificador da conta no Google ou no X quando o login é feito por esses meios, e códigos temporários de confirmação de e-mail ou de redefinição de senha. A conta por e-mail só é criada para quem tem 18 anos ou mais na data escolhida.
        </p>
        <p className="text-justify">
          Dados lançados pelo usuário: número e ano do processo, tipo, parte, assunto, status, prazos, andamentos, valores, vigência, documento do contratado, links de publicação e o histórico de quem alterou o quê. No administrativo, isso pode incluir CPF, CNPJ e comunicações internas. Preferências de tema, cor e área de abertura também são gravadas na conta.
        </p>
        <p className="text-justify">
          Dados de equipe: nome da equipe, e-mail dos convidados e a indicação de quais processos foram compartilhados. Dados técnicos: identificador de sessão, data e hora de uso, e registros necessários à segurança e à auditoria da área restrita. O navegador só envia notificação se o usuário autorizar; essa permissão fica no próprio aparelho.
        </p>

        <Titulo>3. Finalidades e bases legais</Titulo>
        <p className="text-justify">
          A conta, a sincronização dos processos, os avisos de prazo e o compartilhamento com a equipe existem para executar o serviço pedido pelo usuário, com base no art. 7º, V, da LGPD. A guarda de sessão, a prevenção de abuso, os registros da área restrita e a cópia de segurança do sistema apoiam-se no legítimo interesse do controlador, art. 7º, IX, limitado ao necessário para segurança e continuidade. A conservação para defesa de direito em processo apoia-se no art. 7º, VI, e no art. 16.
        </p>
        <p className="text-justify">
          O envio opcional do backup ao Google Drive e a permissão de notificação do navegador dependem de ação do usuário. O login com Google ou X só ocorre se a pessoa escolher esse caminho. Não há venda de dados, não há publicidade comportamental e não há decisão automatizada que produza efeito jurídico sobre o titular.
        </p>

        <Titulo>4. Com quem os dados são compartilhados</Titulo>
        <p className="text-justify">
          Processos marcados como da equipe são visíveis aos membros daquela equipe. Fora isso, uma conta não vê os processos de outra. O responsável pela área restrita acessa contas, processos e registros para administrar o Programa, inclusive exclusão, manutenção e restauração de backup.
        </p>
        <p className="text-justify">
          Operadores e serviços usados para o funcionamento: a infraestrutura de hospedagem e armazenamento (Vercel e o respectivo armazenamento de arquivos); o Google, quando o usuário entra com a conta Google ou envia um backup ao próprio Drive; a X Corp., quando o usuário entra com a conta X; e a caixa de e-mail auxilialegis@marquestecnologies.com, usada apenas para enviar códigos de confirmação e de senha. Esses agentes recebem só o que a respectiva função exige.
        </p>
        <p className="text-justify">
          A ajuda do canto da tela envia a pergunta, o primeiro nome e o histórico recente daquela conversa a um modelo de linguagem de terceiro (LLM7), somente para formular a resposta. Não envia a lista de processos, documentos nem senhas. A pergunta não deve conter dado sensível ou de terceiro.
        </p>

        <Titulo>5. Backups cifrados</Titulo>
        <p className="text-justify">
          Todo backup, automático ou manual, é cifrado pelo sistema antes de ser gravado, baixado ou enviado. O conteúdo vira uma sequência ilegível. O método se chama AES-256-GCM: é um cadeado digital. Ele embaralha o arquivo e só o sistema, com a chave, consegue abrir na restauração. A chave fica somente no sistema e não acompanha o arquivo. O arquivo não mostra contas, processos, senhas nem documentos.
        </p>
        <p className="text-justify">
          Nem o controlador, nem quem guarda o arquivo no computador, nem a conta Google que recebe a cópia no Drive conseguem ler as informações. Não há tela, exportação nem consulta que revele o conteúdo do arquivo. A decifragem existe apenas como etapa interna da restauração, feita pelo sistema, para repor os dados. O controlador não usa o backup para conhecer o que está nas contas.
        </p>
        <p className="text-justify">
          O envio ao Google Drive não é automático. Só ocorre quando alguém autorizado na área restrita escolhe essa opção e autoriza o escopo drive.file. Esse escopo cria a pasta Auxilia Legis e o arquivo cifrado na conta Google escolhida na hora. Não autoriza ler o restante do Drive. A conta Google não precisa ser a mesma do login de administrador. Apagar o arquivo é feito no próprio Drive.
        </p>

        <Titulo>6. Transferência internacional</Titulo>
        <p className="text-justify">
          A hospedagem, o login Google, o login X e o modelo da ajuda podem tratar dados fora do Brasil. A transferência observa o art. 33 da LGPD, em especial a execução de contrato e o recurso a cláusulas e garantias oferecidas por esses fornecedores. Não se afirma, nesta Política, que cada país de destino tenha decisão de adequação da Autoridade Nacional de Proteção de Dados.
        </p>

        <Titulo>7. Retenção e eliminação</Titulo>
        <p className="text-justify">
          Os dados da conta e dos processos permanecem enquanto a conta existir. Códigos de e-mail são temporários e deixam de servir depois do uso ou do prazo de validade. Cópias de segurança são mantidas para restauração e não são apagadas a cada lançamento. Ao excluir a conta, os dados vinculados são eliminados, ressalvadas cópias de segurança já geradas e o que for necessário para cumprir obrigação legal ou exercer direito, pelo prazo correspondente, nos termos do art. 16 da LGPD.
        </p>

        <Titulo>8. Segurança</Titulo>
        <p className="text-justify">
          A senha é armazenada apenas como hash. O acesso à área restrita é separado da conta comum. A sessão usa identificador opaco. Nenhuma medida elimina todo risco: falha de dispositivo, senha compartilhada ou dado lançado de forma indevida pelo próprio usuário continuam sob responsabilidade de quem os provocou. O Programa não substitui o controle oficial de qualquer órgão.
        </p>

        <Titulo>9. Direitos do titular</Titulo>
        <p className="text-justify">
          O titular pode pedir, nos termos do art. 18 da LGPD, confirmação de tratamento, acesso, correção, anonimização, bloqueio ou eliminação de dado desnecessário ou excessivo, portabilidade, informação sobre compartilhamentos e revisão de decisão, quando houver. Nome e senha podem ser alterados no perfil. A exclusão da conta pode ser pedida no próprio Programa ou pelo e-mail contato@marquestecnologies.com.
        </p>
        <p className="text-justify">
          O pedido será respondido no prazo da regulamentação da ANPD. Para proteger a conta, pode ser exigida confirmação de que quem pede é o titular. Se a resposta não for satisfatória, cabe reclamação à Autoridade Nacional de Proteção de Dados.
        </p>

        <Titulo>10. Crianças e adolescentes</Titulo>
        <p className="text-justify">
          O Programa não se destina a menor de 18 anos. Na criação da conta por e-mail a data de nascimento pode ser qualquer uma até hoje. Se a data mostrar menos de 18 anos, a conta não é criada e aquele e-mail fica restrito por 7 dias. A restrição aparece na área restrita. Antes desse prazo, a liberação só ocorre depois de contato com auxilialegis@marquestecnologies.com. Não se coleta dado de criança para abrir conta.
        </p>

        <Titulo>11. Alterações</Titulo>
        <p className="text-justify">
          Esta Política pode ser atualizada. A data do topo indica a versão vigente. Mudança relevante sobre a finalidade do tratamento será informada no Programa ou no e-mail da conta. O uso depois da publicação da nova versão indica ciência. Os Termos de Uso continuam a regular o serviço e remetem a esta Política.
        </p>

        <Titulo>12. Lei e foro</Titulo>
        <p className="text-justify">
          Aplica-se a lei brasileira. Fica eleito o foro da Comarca de Ibirité/MG, salvo foro obrigatório em favor do titular, inclusive o previsto no art. 101, I, do Código de Defesa do Consumidor, quando a relação for de consumo.
        </p>
      </div>
      <Link to="/login" className="mt-8 inline-flex h-11 items-center text-sm font-medium text-pine">
        Voltar ao login
      </Link>
    </main>
  );
}
