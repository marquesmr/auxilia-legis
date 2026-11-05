# Auxilia Legis

Assistente do Poder Legislativo. Reúne, num só lugar, o acompanhamento de processos, prazos, comunicações internas, equipes e o calendário de expediente.

Em uso em [auxilialegis.online](https://www.auxilialegis.online).

## O que o programa faz

Depois do login, a pessoa escolhe o módulo. Hoje são dois: **Administrativo** e **Legislativo**.

No administrativo, o lançamento cobre o tipo do processo, o status, os prazos das etapas que exigem data, os links de publicação e, quando o processo se encerra, os dados da contratação. É possível registrar até dois contratados ou fornecedores, salvo em Outros, Doações e Pronto Pagamento. Onde o número ou o link não se aplica, o campo aceita N/A.

A guia de comunicações internas mostra a sequência da Gerência Administrativa. O que não entrou em processo fica visível; dá para anotar o destino e desativar um número, trocando o alerta por um bloqueio.

O calendário marca feriados e pontos facultativos na cor do tema. O domingo é o primeiro dia da semana. Feriado municipal aparece conforme a cidade da pessoa, se ela autorizar a localização.

A área restrita concentra o que é da administração do sistema: contas, e-mails com restrição, pedidos de exclusão, convites pendentes, equipes por módulo, catálogo de status e a leitura de calendários enviados para aprovação.

A ajuda se chama **Lexis**. Ela responde sobre o uso do sistema usando o nome de quem está logado.

## Como rodar

É preciso Node.js.

```bash
npm install
npm run dev
```

O endereço local é `http://127.0.0.1:8080`.

Sem `DATABASE_URL`, o programa usa um Postgres embutido (PGLite) e aplica sozinho os arquivos de `migrations/`. Com `DATABASE_URL`, usa esse Postgres.

```bash
npm run typecheck
npm test
npm run build
```

## Onde está cada coisa

| Pasta | Conteúdo |
| --- | --- |
| `src/routes` | Telas: início, login, convite, gestão, privacidade e termos |
| `src/components` | Interface, inclusive o painel administrativo e o calendário |
| `src/lib` | Regras, banco, e-mail, backup e a Lexis |
| `migrations` | Esquema do banco, aplicado na ordem do nome do arquivo |

A tela inicial está em `src/routes/index.tsx` e o aplicativo em si em `src/components/prazos-app.tsx`.

## Licença

Uso permitido nos termos do arquivo `LICENSE`. O software não se destina a venda, assinatura paga ou outra exploração comercial. É fornecido no estado em que se encontra, sem garantia.
