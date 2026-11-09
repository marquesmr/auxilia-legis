import { getSql } from "@/lib/db";
import { botaoEmail, emailHtml, enviarEmail } from "@/lib/email.server";
import { senhaDaCaixa } from "@/lib/senha-email.server";

function corpoPolitica(origem: string) {
  const link = `${origem || "https://auxilialegis.online"}/privacidade`;
  return `<p>Sua conta no <strong>Auxilia Legis</strong> foi criada antes da publicação da Política de Privacidade. O texto vigente, a partir de 9 de novembro de 2026, segue abaixo e também está no site.</p>
${botaoEmail(link, "Abrir a Política de Privacidade")}
<p><strong>1. Controlador.</strong> O controlador dos dados da conta é Carlos Marques, com sede em Mário Campos/MG. Não há encarregado nomeado, por se tratar de agente de pequeno porte. Pedidos do titular vão para auxilialegis@marquestecnologies.com. Sobre o cadastro, a sessão e a segurança, Carlos Marques é controlador. Sobre dados de terceiros lançados nos processos, o usuário decide o conteúdo e a finalidade; o Programa atua como operador.</p>
<p><strong>2. Quais dados são tratados.</strong> Da conta: nome, data de nascimento, e-mail, hash da senha, identificador do Google ou do X, quando o login é por esses meios, e códigos temporários. A conta por e-mail só é criada para quem tem 18 anos ou mais. Lançados pelo usuário: processo, parte, assunto, status, prazos, andamentos, valores, documento do contratado, segundo contratado, pagamentos por demanda, comunicações internas, links e histórico. A data de nascimento de pessoa física no processo não aparece no detalhe e fica só para a consulta do CPF. Preferências de tema e área também ficam na conta. Da equipe: nome, módulos, e-mail e nome dos convidados e processos compartilhados. O convite vale 24 horas. Técnicos: sessão, data e hora de uso e registros da área restrita. A notificação do navegador só sai se o usuário autorizar. Se a localização for permitida, a coordenada serve uma vez para achar a cidade e a UF, e não é guardada. A consulta de CPF, CNPJ ou nome de empresa envia só o que foi pesquisado a bases públicas. A imagem de calendário é lida e não fica armazenada. A calculadora não envia a conta digitada.</p>
<p><strong>3. Finalidades e bases legais.</strong> A conta, a sincronização, os avisos de prazo e a equipe existem para executar o serviço, art. 7º, V, da LGPD. Sessão, prevenção de abuso, registros da área restrita e cópia de segurança apoiam-se no legítimo interesse, art. 7º, IX. A conservação para defesa de direito apoia-se no art. 7º, VI, e no art. 16. Backup no Google Drive, notificação do navegador, localização e consulta de documento dependem de ação do usuário. Não há venda de dados, publicidade comportamental nem decisão automatizada com efeito jurídico.</p>
<p><strong>4. Com quem os dados são compartilhados.</strong> Processo de equipe é visível aos membros daquela equipe. Fora isso, uma conta não vê a outra. A área restrita administra o Programa. Operadores: hospedagem (Vercel), Google, quando o login ou o backup no Drive é escolhido, X Corp., quando o login é por lá, e a caixa auxilialegis@marquestecnologies.com, para códigos, convites, restrição ou liberação de e-mail e avisos do serviço. A Lexis envia a pergunta, o primeiro nome e o histórico recente da conversa a um modelo de terceiro (LLM7), sem a lista de processos, documentos ou senhas. A consulta usa bases públicas, entre elas BrasilAPI, CNPJá, CNPJ.ws, ReceitaWS, Minha Receita e o Fichário na busca por nome. A cidade usa o Nominatim, do OpenStreetMap. A imagem do calendário é lida pelo OCR.space. Cada um recebe só o que a função exige.</p>
<p><strong>5. Backups cifrados.</strong> Todo backup é cifrado pelo sistema com AES-256-GCM antes de ser gravado, baixado ou enviado. A chave fica só no sistema. Nem o controlador, nem quem guarda o arquivo, nem a conta Google do Drive conseguem ler o conteúdo. A decifragem ocorre apenas na restauração, feita pelo sistema. O envio ao Drive depende de uma autorização da área restrita. O manual vai para a pasta Auxilia Legis. O automático, depois dessa autorização, vai para a pasta Auxilia Legis - Automático. O escopo drive.file não lê o restante do Drive.</p>
<p><strong>6. Transferência internacional.</strong> Hospedagem, login Google, login X, o modelo da ajuda, as bases de consulta, o Nominatim, o OCR.space e o Fichário podem tratar dados fora do Brasil, com base no art. 33 da LGPD. Esta Política não afirma que cada país de destino tenha decisão de adequação da ANPD.</p>
<p><strong>7. Retenção e eliminação.</strong> Os dados ficam enquanto a conta existir. Códigos de e-mail são temporários. O convite sai no aceite, no cancelamento ou em 24 horas. Coordenada e imagem de calendário não são conservadas. Cópias de segurança permanecem para restauração. Na exclusão, os dados da conta são eliminados, ressalvadas cópias já geradas e o necessário a obrigação legal ou exercício de direito, art. 16 da LGPD. O pedido de exclusão espera 30 dias e é cancelado se a conta for acessada nesse prazo.</p>
<p><strong>8. Segurança.</strong> A senha fica apenas como hash. A área restrita é separada da conta comum. Nenhuma medida elimina todo risco. O Programa não substitui o controle oficial de qualquer órgão.</p>
<p><strong>9. Direitos do titular.</strong> Cabe pedir confirmação, acesso, correção, anonimização, bloqueio ou eliminação de dado desnecessário, portabilidade, informação sobre compartilhamentos e revisão de decisão, art. 18 da LGPD. Nome e senha mudam no perfil. A exclusão pode ser pedida no perfil ou pelo e-mail auxilialegis@marquestecnologies.com. A resposta segue o prazo da ANPD. Se não for satisfatória, cabe reclamação à Autoridade Nacional de Proteção de Dados.</p>
<p><strong>10. Crianças e adolescentes.</strong> O Programa não se destina a menor de 18 anos. Data de nascimento de menor não cria conta e restringe o e-mail por 7 dias. A liberação, quando cabível, usa a data confirmada por e-mail, que não pode ser alterada no formulário, ou o e-mail permanece bloqueado para análise até nova confirmação. O comprovante fica só na caixa de e-mail.</p>
<p><strong>11. Alterações.</strong> A data no topo da página indica a versão vigente. Mudança relevante sobre a finalidade do tratamento será informada no Programa ou neste e-mail. O uso depois da nova versão indica ciência.</p>
<p><strong>12. Lei e foro.</strong> Aplica-se a lei brasileira. Foro da Comarca de Ibirité/MG, salvo foro obrigatório em favor do titular, inclusive o art. 101, I, do Código de Defesa do Consumidor, quando a relação for de consumo.</p>
<p>O texto completo e atualizado permanece em ${link}.</p>`;
}

async function avisarPoliticaContasAntigas(origem: string) {
  const senhaCaixa = await senhaDaCaixa();
  if (!senhaCaixa) return { enviados: 0, motivo: "sem-caixa" as const };
  const sql = await getSql();
  await sql`
    create table if not exists aviso_politica (
      user_id text primary key,
      email text not null,
      enviado_em timestamptz
    )
  `;
  await sql`
    insert into aviso_politica (user_id, email)
    select id, lower(email) from "user"
    where "createdAt" < timestamptz '2026-11-03 16:59:34+00'
      and email is not null
      and position('@' in email) > 1
    on conflict (user_id) do nothing
  `;
  const pendentes = await sql<{ user_id: string; email: string; nome: string | null }>`
    select a.user_id, a.email, u.name as nome
    from aviso_politica a
    join "user" u on u.id = a.user_id
    where a.enviado_em is null
  `;
  let enviados = 0;
  for (const pessoa of pendentes) {
    const dono = await sql<{ user_id: string }>`
      update aviso_politica set enviado_em = now()
      where user_id = ${pessoa.user_id} and enviado_em is null
      returning user_id
    `;
    if (!dono[0]) continue;
    try {
      await enviarEmail(
        pessoa.email,
        "Política de Privacidade do Auxilia Legis",
        emailHtml(pessoa.nome || "", corpoPolitica(origem), origem),
        senhaCaixa,
      );
      enviados += 1;
    } catch {
      await sql`update aviso_politica set enviado_em = null where user_id = ${pessoa.user_id}`;
    }
  }
  return { enviados, motivo: "ok" as const };
}

let fila: Promise<{ enviados: number; motivo: "ok" | "sem-caixa" }> | null = null;

export function dispararAvisoPolitica(origem: string) {
  if (!fila) {
    fila = avisarPoliticaContasAntigas(origem).finally(() => {
      fila = null;
    });
  }
  return fila;
}
