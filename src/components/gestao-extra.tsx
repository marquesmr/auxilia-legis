import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";
import {
  backupGestao,
  backupsAutomaticosGestao,
  clienteGoogleGestao,
  apagarStatusGestao,
  bloquearUsuarioGestao,
  definirPapelGestao,
  desvincularEquipeGestao,
  criarStatusGestao,
  editarStatusGestao,
  excluirUsuarioGestao,
  feriadoGestao,
  liberarRestricaoGestao,
  logsGestao,
  manutencaoGestao,
  restaurarAutomaticoGestao,
  restaurarGestao,
  salvarSenhaCaixaGestao,
  vincularEquipeGestao,
} from "@/lib/gestao.functions";
import type { painelGestao } from "@/lib/gestao.functions";
import { MOTIVOS_EXCLUSAO } from "@/lib/motivos-exclusao";
import { CampoSenha } from "@/components/campo-senha";
import { carregarGoogle, enviarBackupDrive, nomeBackupManual, pedirAcessoDrive } from "@/lib/google-drive-backup";

type Painel = Awaited<ReturnType<typeof painelGestao>>;

export function novaOrdem(ids: string[], origem: string, destino: string) {
  if (!origem || origem === destino) return null;
  const lista = [...ids];
  const de = lista.indexOf(origem);
  const para = lista.indexOf(destino);
  if (de < 0 || para < 0) return null;
  lista.splice(de, 1);
  lista.splice(para, 0, origem);
  return lista;
}

const PAPEIS = [
  ["operador", "Operador"],
  ["administrador", "Administrador"],
  ["consulta", "Consulta"],
] as const;

function hora(valor: string | null) {
  if (!valor) return "ainda não";
  const data = new Date(valor);
  if (Number.isNaN(data.getTime())) return "—";
  return data.toLocaleString("pt-BR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

function horaCheia(valor: string) {
  const data = new Date(valor);
  if (Number.isNaN(data.getTime())) return "—";
  return data.toLocaleString("pt-BR", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export function SecaoUsuarios({
  token,
  painel,
  onMudou,
  onErro,
  onAviso,
  onConfirmar,
}: {
  token: string;
  painel: Painel;
  onMudou: () => void;
  onErro: (texto: string) => void;
  onAviso: (texto: string) => void;
  onConfirmar: (texto: string, agir: () => void, rotulo?: string) => void;
}) {
  const [equipeId, setEquipeId] = useState(painel.equipesPainel[0]?.id ?? "");
  const [userId, setUserId] = useState(painel.pessoas[0]?.id ?? "");
  const [alvoExclusao, setAlvoExclusao] = useState<string | null>(null);
  const [motivoExclusaoId, setMotivoExclusaoId] = useState("");

  async function agir(tarefa: Promise<unknown>, ok: string) {
    onErro("");
    try {
      await tarefa;
      onAviso(ok);
      onMudou();
    } catch (err) {
      onErro(err instanceof Error ? err.message : "Não foi possível concluir.");
    }
  }

  return (
    <div className="mt-5 flex flex-col gap-4">
      <section className="rounded-2xl border border-line bg-sheet p-4">
        <h2 className="text-sm font-medium text-ink">Usuários e perfis</h2>
        <p className="mt-1 text-sm text-muted">
          Consulta só lê. Administrador, depois de atribuído, entra na área restrita com o e-mail e a senha da própria conta. O acesso do gestor que já existe continua valendo.
        </p>
        <h3 className="mt-4 text-sm font-medium text-ink">E-mails restritos</h3>
        <p className="mt-1 text-sm text-muted">Menor de 18 anos. O e-mail fica 7 dias sem criar conta, salvo contato em auxilialegis@marquestecnologies.com.</p>
        <ul className="mt-3 flex flex-col gap-2">
          {painel.restritos.length === 0 && <li className="text-sm text-muted">Nenhum e-mail restrito.</li>}
          {painel.restritos.map((item) => (
            <li key={item.email} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-line px-3 py-2 text-sm">
              <span className="text-ink">
                {item.email} <span className="text-muted">· menor de 18 · até {horaCheia(item.ate)}</span>
              </span>
              <button
                type="button"
                onClick={() =>
                  onConfirmar(`Liberar ${item.email}? Só depois do contato em auxilialegis@marquestecnologies.com.`, () => {
                    void agir(liberarRestricaoGestao({ data: { token, email: item.email } }), "E-mail liberado.");
                  }, "Liberar")
                }
                className="h-9 rounded-lg border border-line px-3 text-ink"
              >
                Liberar
              </button>
            </li>
          ))}
        </ul>
        <ul className="mt-3 flex flex-col gap-3">
          {painel.pessoas.map((pessoa) => (
            <li key={pessoa.id} className="rounded-xl border border-line p-3 text-sm">
              <p className="text-ink">
                {pessoa.nome} <span className="text-muted">· {pessoa.email}</span>
              </p>
              <p className="text-muted">{pessoa.bloqueado ? "Bloqueado" : pessoa.ativo ? "Ativo agora" : `Visto ${hora(pessoa.vistoEm)}`}</p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <select
                  value={pessoa.papel}
                  onChange={(evento) =>
                    void agir(definirPapelGestao({ data: { token, userId: pessoa.id, papel: evento.target.value } }), "Perfil atualizado.")
                  }
                  className="h-9 rounded-lg border border-line bg-paper px-2 text-sm text-ink"
                >
                  {PAPEIS.map(([id, rotulo]) => (
                    <option key={id} value={id}>
                      {rotulo}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() =>
                    void agir(
                      bloquearUsuarioGestao({ data: { token, userId: pessoa.id, bloqueado: !pessoa.bloqueado } }),
                      pessoa.bloqueado ? "Acesso liberado." : "Acesso bloqueado.",
                    )
                  }
                  className="h-9 rounded-lg border border-line px-3 text-ink"
                >
                  {pessoa.bloqueado ? "Desbloquear" : "Bloquear"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setAlvoExclusao(pessoa.id);
                    setMotivoExclusaoId("");
                  }}
                  className="h-9 rounded-lg border border-line px-3 text-seal"
                >
                  Excluir conta
                </button>
              </div>
              {alvoExclusao === pessoa.id && (
                <div className="mt-3 flex flex-col gap-2">
                  <label className="flex flex-col gap-1 text-sm text-ink">
                    Motivo
                    <select
                      value={motivoExclusaoId}
                      onChange={(evento) => setMotivoExclusaoId(evento.target.value)}
                      className="h-10 rounded-lg border border-line bg-paper px-2 text-sm text-ink"
                    >
                      <option value="">Escolha o motivo</option>
                      {MOTIVOS_EXCLUSAO.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.titulo}
                        </option>
                      ))}
                    </select>
                  </label>
                  {MOTIVOS_EXCLUSAO.find((item) => item.id === motivoExclusaoId) && (
                    <p className="text-xs leading-relaxed text-muted">
                      {MOTIVOS_EXCLUSAO.find((item) => item.id === motivoExclusaoId)?.fundamento}
                    </p>
                  )}
                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={!motivoExclusaoId}
                      onClick={() =>
                        onConfirmar(`Excluir a conta de ${pessoa.nome}? A pessoa é desconectada na hora.`, () => {
                          void (async () => {
                            onErro("");
                            try {
                              await excluirUsuarioGestao({ data: { token, userId: pessoa.id, motivo: motivoExclusaoId } });
                              onAviso(`Conta de ${pessoa.nome} excluída.`);
                              onMudou();
                              setAlvoExclusao(null);
                            } catch (err) {
                              onErro(err instanceof Error ? err.message : "Não foi possível concluir.");
                            }
                          })();
                        })
                      }
                      className="h-9 rounded-lg border border-line px-3 text-seal disabled:opacity-50"
                    >
                      Confirmar exclusão
                    </button>
                    <button type="button" onClick={() => setAlvoExclusao(null)} className="h-9 rounded-lg border border-line px-3 text-ink">
                      Cancelar
                    </button>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      </section>
      <section className="rounded-2xl border border-line bg-sheet p-4">
        <h2 className="text-sm font-medium text-ink">Equipes</h2>
        <form
          className="mt-3 flex flex-col gap-2 sm:flex-row"
          onSubmit={(evento) => {
            evento.preventDefault();
            if (!equipeId || !userId) return;
            void agir(vincularEquipeGestao({ data: { token, equipeId, userId } }), "Pessoa vinculada à equipe.");
          }}
        >
          <select value={equipeId} onChange={(evento) => setEquipeId(evento.target.value)} className="h-11 rounded-xl border border-line bg-paper px-3 text-sm text-ink">
            {painel.equipesPainel.map((equipe) => (
              <option key={equipe.id} value={equipe.id}>
                {equipe.nome}
              </option>
            ))}
          </select>
          <select value={userId} onChange={(evento) => setUserId(evento.target.value)} className="h-11 min-w-0 flex-1 rounded-xl border border-line bg-paper px-3 text-sm text-ink">
            {painel.pessoas.map((pessoa) => (
              <option key={pessoa.id} value={pessoa.id}>
                {pessoa.nome}
              </option>
            ))}
          </select>
          <button type="submit" className="inline-flex h-11 items-center justify-center rounded-xl bg-pine px-4 text-sm font-medium text-sheet">
            Vincular
          </button>
        </form>
        <ul className="mt-4 flex flex-col gap-3">
          {painel.equipesPainel.length === 0 && <li className="text-sm text-muted">Nenhuma equipe criada.</li>}
          {painel.equipesPainel.map((equipe) => (
            <li key={equipe.id}>
              <p className="text-sm font-medium text-ink">{equipe.nome}</p>
              <ul className="mt-1 flex flex-col gap-1">
                {equipe.membros.map((membro) => (
                  <li key={membro.id} className="flex items-center justify-between gap-2 text-sm">
                    <span className="min-w-0 truncate text-ink">
                      {membro.nome} <span className="text-muted">· {membro.papel}</span>
                    </span>
                    {membro.papel !== "dono" && (
                      <button
                        type="button"
                        onClick={() =>
                          onConfirmar(`Remover ${membro.nome} da equipe ${equipe.nome}?`, () => {
                            void agir(desvincularEquipeGestao({ data: { token, equipeId: equipe.id, userId: membro.id } }), "Pessoa removida da equipe.");
                          })
                        }
                        className="shrink-0 text-sm font-medium text-pine"
                      >
                        Remover
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

export function SecaoSistema({
  token,
  painel,
  onMudou,
  onErro,
  onAviso,
  onConfirmar,
  acesso,
}: {
  token: string;
  painel: Painel;
  onMudou: () => void;
  onErro: (texto: string) => void;
  onAviso: (texto: string) => void;
  onConfirmar: (texto: string, agir: () => void, rotulo?: string) => void;
  acesso: ReactNode;
}) {
  const [de, setDe] = useState("");
  const [ate, setAte] = useState("");
  const [texto, setTexto] = useState("");
  const [acao, setAcao] = useState("");
  const [pagina, setPagina] = useState(0);
  const [logs, setLogs] = useState<Awaited<ReturnType<typeof logsGestao>> | null>(null);
  const [nomeFeriado, setNomeFeriado] = useState("");
  const [tipoFeriado, setTipoFeriado] = useState<"feriado" | "recesso">("feriado");
  const [inicio, setInicio] = useState("");
  const [fim, setFim] = useState("");
  const [pontos, setPontos] = useState<Awaited<ReturnType<typeof backupsAutomaticosGestao>>>([]);
  const [pontoId, setPontoId] = useState("");
  const [listaAberta, setListaAberta] = useState(false);
  const [carregandoPontos, setCarregandoPontos] = useState(false);
  const [restaurando, setRestaurando] = useState(false);
  const [escolhaBackup, setEscolhaBackup] = useState(false);
  const [googleId, setGoogleId] = useState("");

  function abrirEscolhaBackup() {
    setEscolhaBackup(true);
    void carregarGoogle().catch(() => undefined);
    if (!googleId) {
      void clienteGoogleGestao({ data: token })
        .then((dados) => setGoogleId(dados.clientId))
        .catch((err: unknown) => onErro(err instanceof Error ? err.message : "Não foi possível preparar o Google Drive."));
    }
  }

  function backupNoComputador() {
    setEscolhaBackup(false);
    void backupGestao({ data: token })
      .then((arquivo) => {
        baixar(arquivo.nome, arquivo.conteudo);
        onAviso("Backup baixado.");
        onMudou();
      })
      .catch((err: unknown) => onErro(err instanceof Error ? err.message : "Não foi possível fazer o backup."));
  }

  function backupNoDrive() {
    if (!googleId || !window.google?.accounts?.oauth2) {
      onErro("O Google ainda está abrindo. Tenta de novo.");
      return;
    }
    setEscolhaBackup(false);
    void pedirAcessoDrive(googleId)
      .then(async (acesso) => {
        const arquivo = await backupGestao({ data: token });
        const nome = nomeBackupManual();
        await enviarBackupDrive(acesso, nome, arquivo.conteudo);
        onAviso(`Backup no Google Drive, na pasta Auxilia Legis: ${nome}`);
        onMudou();
      })
      .catch((err: unknown) => onErro(err instanceof Error ? err.message : "Não foi possível enviar o backup ao Google Drive."));
  }

  function abrirBackups() {
    if (listaAberta) {
      setListaAberta(false);
      return;
    }
    setListaAberta(true);
    setCarregandoPontos(true);
    void backupsAutomaticosGestao({ data: token })
      .then((lista) => {
        setPontos(lista);
        setPontoId((atual) => (lista.some((item) => item.id === atual) ? atual : (lista[0]?.id ?? "")));
      })
      .catch((err: unknown) => onErro(err instanceof Error ? err.message : "Não foi possível ler os backups."))
      .finally(() => setCarregandoPontos(false));
  }

  useEffect(() => {
    let vivo = true;
    void logsGestao({ data: { token, de, ate, texto, acao, pagina } })
      .then((dados) => {
        if (vivo) setLogs(dados);
      })
      .catch((err: unknown) => onErro(err instanceof Error ? err.message : "Não foi possível ler os registros."));
    return () => {
      vivo = false;
    };
  }, [token, de, ate, texto, acao, pagina, painel.registros.length, onErro]);

  function baixar(nome: string, conteudo: string) {
    const arquivo = new File([conteudo], nome, { type: "application/json" });
    const url = URL.createObjectURL(arquivo);
    const link = document.createElement("a");
    link.href = url;
    link.download = nome;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="mt-5 flex flex-col gap-4">
      <section className="rounded-2xl border border-line bg-sheet p-4">
        <h2 className="text-sm font-medium text-ink">Manutenção</h2>
        <p className="mt-1 text-sm text-muted">Ligado, as pessoas comuns não entram. Esta área restrita continua aberta.</p>
        <button
          type="button"
          onClick={() =>
            void manutencaoGestao({ data: { token, ligado: !painel.config.manutencao } })
              .then((resultado) => {
                onAviso(resultado.manutencao ? "Sistema em manutenção. Quem não é administrador vê o aviso e não usa o sistema." : "Sistema liberado.");
                onMudou();
              })
              .catch((err: unknown) => onErro(err instanceof Error ? err.message : "Não foi possível mudar a manutenção."))
          }
          className="mt-3 inline-flex h-11 items-center rounded-xl bg-ink px-4 text-sm font-medium text-sheet"
        >
          {painel.config.manutencao ? "Desligar manutenção" : "Colocar em manutenção"}
        </button>
      </section>
      <section className="rounded-2xl border border-line bg-sheet p-4">
        <h2 className="text-sm font-medium text-ink">E-mail dos códigos</h2>
        <p className="mt-1 text-sm text-muted">
          Os códigos de senha saem de auxilialegis@marquestecnologies.com.
          {painel.config.emailPronto ? " A caixa já está pronta." : " Guarde a senha da caixa para o envio funcionar."}
        </p>
        <form
          className="mt-3 flex flex-col gap-2 sm:flex-row"
          onSubmit={(evento) => {
            evento.preventDefault();
            const dados = new FormData(evento.currentTarget);
            const formulario = evento.currentTarget;
            const senha = String(dados.get("senha") ?? "");
            void (async () => {
              onErro("");
              try {
                await salvarSenhaCaixaGestao({ data: { token, senha } });
                onAviso("Senha da caixa guardada.");
                formulario.reset();
                onMudou();
              } catch (err) {
                onErro(err instanceof Error ? err.message : "Não foi possível guardar a senha.");
              }
            })();
          }}
        >
          <CampoSenha
            name="senha"
            autoComplete="new-password"
            placeholder="Senha da caixa"
            className="h-11 min-w-0 flex-1 rounded-xl border border-line bg-paper px-3 text-sm text-ink"
          />
          <button type="submit" className="inline-flex h-11 items-center justify-center rounded-xl bg-pine px-4 text-sm font-medium text-sheet">
            Guardar
          </button>
        </form>
      </section>

      <section className="rounded-2xl border border-line bg-sheet p-4">
        <h2 className="text-sm font-medium text-ink">Feriados e recesso</h2>
        <p className="mt-1 text-sm text-muted">A contagem de prazo desconta fins de semana e estes dias.</p>
        <form
          className="mt-3 grid gap-2 md:grid-cols-5"
          onSubmit={(evento: FormEvent) => {
            evento.preventDefault();
            void feriadoGestao({ data: { token, nome: nomeFeriado, tipo: tipoFeriado, inicio, fim: fim || inicio } })
              .then(() => {
                setNomeFeriado("");
                onAviso("Dia registrado.");
                onMudou();
              })
              .catch((err: unknown) => onErro(err instanceof Error ? err.message : "Não foi possível registrar."));
          }}
        >
          <input value={nomeFeriado} onChange={(evento) => setNomeFeriado(evento.target.value)} placeholder="Nome" className="h-11 rounded-xl border border-line bg-paper px-3 text-sm md:col-span-2" spellCheck lang="pt-BR" />
          <select value={tipoFeriado} onChange={(evento) => setTipoFeriado(evento.target.value as "feriado" | "recesso")} className="h-11 rounded-xl border border-line bg-paper px-3 text-sm text-ink">
            <option value="feriado">Feriado</option>
            <option value="recesso">Recesso</option>
          </select>
          <input type="date" value={inicio} onChange={(evento) => setInicio(evento.target.value)} className="h-11 rounded-xl border border-line bg-paper px-3 text-sm" />
          <input type="date" value={fim} onChange={(evento) => setFim(evento.target.value)} className="h-11 rounded-xl border border-line bg-paper px-3 text-sm" />
          <button type="submit" className="inline-flex h-11 items-center justify-center rounded-xl bg-pine text-sm font-medium text-sheet md:col-span-5">
            Registrar
          </button>
        </form>
        <ul className="mt-3 flex flex-col gap-2">
          {painel.feriados.length === 0 && <li className="text-sm text-muted">Nenhum dia fora do expediente.</li>}
          {painel.feriados.map((item) => (
            <li key={item.id} className="flex items-center justify-between gap-2 text-sm">
              <span className="text-ink">
                {item.nome} <span className="text-muted">· {item.tipo === "recesso" ? "Recesso" : "Feriado"} · {item.inicio}{item.fim !== item.inicio ? ` a ${item.fim}` : ""}</span>
              </span>
              <button
                type="button"
                onClick={() =>
                  onConfirmar(`Remover ${item.nome}?`, () => {
                    void feriadoGestao({ data: { token, apagar: true, id: item.id, nome: "", tipo: "feriado", inicio: "", fim: "" } })
                      .then(() => {
                        onAviso("Dia removido.");
                        onMudou();
                      })
                      .catch((err: unknown) => onErro(err instanceof Error ? err.message : "Não foi possível remover."));
                  })
                }
                className="text-sm font-medium text-pine"
              >
                Remover
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-2xl border border-line bg-sheet p-4">
        <h2 className="text-sm font-medium text-ink">Backup</h2>
        <p className="mt-1 text-sm text-muted">
          Último manual: {hora(painel.config.backupEm)}. Último automático: {hora(painel.config.backupAutoEm)}. O automático ocorre a cada novo lançamento e nenhum ponto é apagado.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={abrirEscolhaBackup}
            className="inline-flex h-11 items-center rounded-xl bg-pine px-4 text-sm font-medium text-sheet"
          >
            Fazer backup agora
          </button>
          <label className="inline-flex h-11 cursor-pointer items-center rounded-xl border border-line px-4 text-sm font-medium text-ink">
            Restaurar arquivo
            <input
              type="file"
              accept="application/json,.json"
              className="sr-only"
              onChange={(evento) => {
                const arquivo = evento.target.files?.[0];
                evento.target.value = "";
                if (!arquivo) return;
                if (!window.confirm("Restaurar este backup? Contas, senhas e processos deste arquivo passam a valer aqui.")) return;
                void arquivo.text().then((conteudo) =>
                  restaurarGestao({ data: { token, conteudo } })
                    .then((resultado) => {
                      onAviso(`Restauradas ${resultado.contas} contas, ${resultado.processos} legislativos e ${resultado.administrativos} administrativos.`);
                      onMudou();
                    })
                    .catch((err: unknown) => onErro(err instanceof Error ? err.message : "Não foi possível restaurar.")),
                );
              }}
            />
          </label>
          <button
            type="button"
            onClick={abrirBackups}
            className="inline-flex h-11 items-center rounded-xl border border-line px-4 text-sm font-medium text-ink"
          >
            Restaurar backup
          </button>
        </div>
        {escolhaBackup &&
          createPortal(
            <div className="fixed inset-0 z-[90] grid place-items-center bg-ink/40 p-4" role="dialog" aria-modal="true" aria-labelledby="titulo-backup">
              <div className="w-full max-w-md rounded-2xl border border-line bg-sheet p-5 shadow-lg">
                <h3 id="titulo-backup" className="font-display text-2xl text-ink">Backup manual</h3>
                <p className="mt-2 text-sm text-muted">
                  Guarda neste computador ou no Google Drive. O arquivo sai cifrado: só o sistema o abre, na restauração. No Drive, a pasta é Auxilia Legis e o arquivo se chama {nomeBackupManual()}.
                </p>
                <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                  <button type="button" onClick={backupNoComputador} className="inline-flex h-11 flex-1 items-center justify-center rounded-xl border border-line px-4 text-sm font-medium text-ink">
                    Neste computador
                  </button>
                  <button type="button" onClick={backupNoDrive} className="inline-flex h-11 flex-1 items-center justify-center rounded-xl bg-pine px-4 text-sm font-medium text-sheet">
                    Google Drive
                  </button>
                </div>
                <button type="button" onClick={() => setEscolhaBackup(false)} className="mt-3 text-sm text-muted">
                  Cancelar
                </button>
              </div>
            </div>,
            document.body,
          )}
        {listaAberta && (
          <div className="mt-4 border-t border-line pt-4">
            <p className="text-sm text-muted">
              Escolha o ponto. Contas, senhas e processos daquele momento passam a valer.
            </p>
            {carregandoPontos ? (
              <p className="mt-3 text-sm text-muted">Carregando os backups…</p>
            ) : pontos.length === 0 ? (
              <p className="mt-3 text-sm text-muted">Nenhum backup automático ainda.</p>
            ) : (
              <ul className="mt-3 flex max-h-80 flex-col gap-2 overflow-y-auto">
                {pontos.map((ponto) => (
                  <li key={ponto.id}>
                    <label className="flex cursor-pointer items-start gap-2 rounded-xl border border-line px-3 py-2 text-sm">
                      <input
                        type="radio"
                        name="backup-automatico"
                        className="mt-1"
                        checked={pontoId === ponto.id}
                        onChange={() => setPontoId(ponto.id)}
                      />
                      <span>
                        <span className="font-medium text-ink">{horaCheia(ponto.em)}</span>
                        <span className="text-muted">
                          {" "}
                          · {ponto.contas} contas · {ponto.processos} legislativos · {ponto.administrativos} administrativos
                        </span>
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
            )}
            <button
              type="button"
              disabled={!pontoId || restaurando || carregandoPontos}
              onClick={() => {
                const escolhido = pontos.find((item) => item.id === pontoId);
                if (!escolhido) return;
                if (!window.confirm(`Voltar o sistema para o backup de ${horaCheia(escolhido.em)}? Contas, senhas e processos passam a ser os daquele momento.`)) return;
                setRestaurando(true);
                void restaurarAutomaticoGestao({ data: { token, id: escolhido.id } })
                  .then((resultado) => {
                    onAviso(`Sistema voltou para ${horaCheia(escolhido.em)}. ${resultado.contas} contas, ${resultado.processos} legislativos e ${resultado.administrativos} administrativos.`);
                    onMudou();
                  })
                  .catch((err: unknown) => onErro(err instanceof Error ? err.message : "Não foi possível restaurar."))
                  .finally(() => setRestaurando(false));
              }}
              className="mt-3 inline-flex h-11 items-center rounded-xl bg-pine px-4 text-sm font-medium text-sheet disabled:opacity-60"
            >
              {restaurando ? "Restaurando…" : "Restaurar este ponto"}
            </button>
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-line bg-sheet p-4">
        <h2 className="text-sm font-medium text-ink">Registros</h2>
        <div className="mt-3 grid gap-2 md:grid-cols-4">
          <input type="date" value={de} onChange={(evento) => { setPagina(0); setDe(evento.target.value); }} className="h-11 rounded-xl border border-line bg-paper px-3 text-sm" />
          <input type="date" value={ate} onChange={(evento) => { setPagina(0); setAte(evento.target.value); }} className="h-11 rounded-xl border border-line bg-paper px-3 text-sm" />
          <input value={texto} onChange={(evento) => { setPagina(0); setTexto(evento.target.value); }} placeholder="Pessoa ou detalhe" className="h-11 rounded-xl border border-line bg-paper px-3 text-sm" spellCheck lang="pt-BR" />
          <select value={acao} onChange={(evento) => { setPagina(0); setAcao(evento.target.value); }} className="h-11 rounded-xl border border-line bg-paper px-3 text-sm text-ink">
            <option value="">Todas as ações</option>
            {logs?.acoes.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </div>
        <ul className="mt-3 flex flex-col gap-3">
          {logs?.registros.length === 0 && <li className="text-sm text-muted">Nada neste recorte.</li>}
          {logs?.registros.map((item) => (
            <li key={item.id} className="border-b border-line pb-2 text-sm last:border-0">
              <span className="font-medium text-ink">{item.acao}</span>
              <span className="text-muted"> · {item.nome || item.email || "sistema"}</span>
              {item.detalhe && <span className="block text-ink">{item.detalhe}</span>}
              <span className="text-muted">{hora(item.em)}</span>
            </li>
          ))}
        </ul>
        <div className="mt-3 flex items-center justify-between text-sm">
          <button type="button" disabled={pagina === 0} onClick={() => setPagina((valor) => Math.max(0, valor - 1))} className="text-pine disabled:opacity-40">
            Anterior
          </button>
          <span className="text-muted">{logs ? `${logs.total} registros` : "…"}</span>
          <button type="button" disabled={!logs || (pagina + 1) * 30 >= logs.total} onClick={() => setPagina((valor) => valor + 1)} className="text-pine disabled:opacity-40">
            Próxima
          </button>
        </div>
      </section>
      {acesso}
    </div>
  );
}

type StatusPainel = Painel["status"][number];

export function SecaoStatus({
  token,
  status,
  onMudou,
  onErro,
  onAviso,
  onConfirmar,
  onOrdem,
}: {
  token: string;
  status: StatusPainel[];
  onMudou: () => void;
  onErro: (texto: string) => void;
  onAviso: (texto: string) => void;
  onConfirmar: (texto: string, agir: () => void, rotulo?: string) => void;
  onOrdem: (ids: string[]) => Promise<void>;
}) {
  const [area, setArea] = useState<"legislativo" | "administrativo">("legislativo");
  const [nome, setNome] = useState("");
  const [encerra, setEncerra] = useState(false);
  const [auto, setAuto] = useState(false);
  const [dias, setDias] = useState("30");
  const [destino, setDestino] = useState("");
  const [editando, setEditando] = useState<string | null>(null);
  const [rascunho, setRascunho] = useState({ nome: "", encerra: false, auto: false, dias: "30", destino: "" });
  const [sobre, setSobre] = useState<string | null>(null);
  const daArea = status.filter((item) => item.area === area);

  function mudarOrdem(origem: string, destino: string) {
    const ids = novaOrdem(daArea.map((item) => item.id), origem, destino);
    if (!ids) return;
    void onOrdem(ids).catch((err: unknown) => onErro(err instanceof Error ? err.message : "Não foi possível reordenar."));
  }

  async function criar(evento: FormEvent) {
    evento.preventDefault();
    onErro("");
    try {
      await criarStatusGestao({
        data: {
          token,
          area,
          nome,
          encerra,
          tramiteDias: area === "administrativo" && auto ? Number(dias) : null,
          tramiteCodigo: area === "administrativo" && auto ? destino : null,
        },
      });
      setNome("");
      setEncerra(false);
      setAuto(false);
      onAviso("Status criado.");
      onMudou();
    } catch (err) {
      onErro(err instanceof Error ? err.message : "Não foi possível criar o status.");
    }
  }

  function abrirEdicao(item: StatusPainel) {
    setEditando(item.id);
    setRascunho({
      nome: item.nome,
      encerra: item.encerra,
      auto: item.tramiteDias != null && Boolean(item.tramiteCodigo),
      dias: String(item.tramiteDias ?? 30),
      destino: item.tramiteCodigo ?? "",
    });
  }

  async function salvar(item: StatusPainel) {
    onErro("");
    try {
      await editarStatusGestao({
        data: {
          token,
          id: item.id,
          nome: rascunho.nome,
          encerra: rascunho.encerra,
          tramiteDias: item.area === "administrativo" && rascunho.auto ? Number(rascunho.dias) : null,
          tramiteCodigo: item.area === "administrativo" && rascunho.auto ? rascunho.destino : null,
        },
      });
      setEditando(null);
      onAviso("Status atualizado.");
      onMudou();
    } catch (err) {
      onErro(err instanceof Error ? err.message : "Não foi possível editar o status.");
    }
  }

  return (
    <section className="mt-5 rounded-2xl border border-line bg-sheet p-4">
      <h2 className="text-sm font-medium text-ink">Status</h2>
      <p className="mt-1 text-sm text-muted">
        Crie status novos e edite o nome dos que já existem. Arraste para mudar a hierarquia. No administrativo, um status pode passar sozinho para outro depois de alguns dias corridos.
      </p>
      <div className="mt-3 flex gap-2">
        {(["legislativo", "administrativo"] as const).map((opcao) => (
          <button
            key={opcao}
            type="button"
            onClick={() => { setArea(opcao); setEditando(null); }}
            className={"inline-flex h-10 items-center rounded-full px-4 text-sm font-medium " + (area === opcao ? "bg-ink text-sheet" : "border border-line bg-paper text-ink")}
          >
            {opcao === "legislativo" ? "Legislativo" : "Administrativo"}
          </button>
        ))}
      </div>
      <form className="mt-3 grid gap-2" onSubmit={(evento) => void criar(evento)}>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input value={nome} onChange={(evento) => setNome(evento.target.value)} placeholder="Nome do novo status" className="h-11 min-w-0 flex-1 rounded-xl border border-line bg-paper px-3 text-sm text-ink" spellCheck lang="pt-BR" />
          <button type="submit" className="inline-flex h-11 items-center justify-center rounded-xl bg-pine px-4 text-sm font-medium text-sheet">Adicionar</button>
        </div>
        <label className="flex items-center gap-2 text-sm text-ink">
          <input type="checkbox" checked={encerra} onChange={(evento) => setEncerra(evento.target.checked)} />
          Este status encerra o processo
        </label>
        {area === "administrativo" && (
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <label className="flex items-center gap-2 text-sm text-ink">
              <input type="checkbox" checked={auto} onChange={(evento) => setAuto(evento.target.checked)} />
              Trâmite automático
            </label>
            {auto && (
              <>
                <input value={dias} onChange={(evento) => setDias(evento.target.value.replace(/\D/g, "").slice(0, 4))} inputMode="numeric" className="h-11 w-24 rounded-xl border border-line bg-paper px-3 text-sm" aria-label="Dias" />
                <span className="text-sm text-muted">dias, passar para</span>
                <select value={destino} onChange={(evento) => setDestino(evento.target.value)} className="h-11 min-w-0 flex-1 rounded-xl border border-line bg-paper px-3 text-sm text-ink">
                  <option value="">Escolha o status</option>
                  {daArea.map((item) => (
                    <option key={item.codigo} value={item.codigo}>{item.nome}</option>
                  ))}
                </select>
              </>
            )}
          </div>
        )}
      </form>
      <ul className="mt-4 flex flex-col gap-2">
        {daArea.map((item) => (
          <li
            key={item.id}
            onDragOver={(evento) => {
              evento.preventDefault();
              setSobre(item.id);
            }}
            onDragLeave={() => setSobre((valor) => (valor === item.id ? null : valor))}
            onDrop={(evento) => {
              evento.preventDefault();
              setSobre(null);
              mudarOrdem(evento.dataTransfer.getData("text/plain"), item.id);
            }}
            className={"rounded-xl border px-3 py-2 text-sm " + (sobre === item.id ? "border-pine bg-pine-soft" : "border-line")}
          >
            {editando === item.id ? (
              <div className="flex flex-col gap-2">
                <input value={rascunho.nome} onChange={(evento) => setRascunho({ ...rascunho, nome: evento.target.value })} className="h-10 rounded-lg border border-line bg-paper px-2" spellCheck lang="pt-BR" />
                {item.codigo !== "concluido" && item.codigo !== "encerrado" && item.codigo !== "cancelado" && (
                  <label className="flex items-center gap-2 text-ink">
                    <input type="checkbox" checked={rascunho.encerra} onChange={(evento) => setRascunho({ ...rascunho, encerra: evento.target.checked })} />
                    Encerra o processo
                  </label>
                )}
                {item.area === "administrativo" && (
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                    <label className="flex items-center gap-2 text-ink">
                      <input type="checkbox" checked={rascunho.auto} onChange={(evento) => setRascunho({ ...rascunho, auto: evento.target.checked })} />
                      Trâmite automático
                    </label>
                    {rascunho.auto && (
                      <>
                        <input value={rascunho.dias} onChange={(evento) => setRascunho({ ...rascunho, dias: evento.target.value.replace(/\D/g, "").slice(0, 4) })} inputMode="numeric" className="h-10 w-24 rounded-lg border border-line bg-paper px-2" aria-label="Dias" />
                        <span className="text-muted">dias, passar para</span>
                        <select value={rascunho.destino} onChange={(evento) => setRascunho({ ...rascunho, destino: evento.target.value })} className="h-10 min-w-0 flex-1 rounded-lg border border-line bg-paper px-2 text-ink">
                          <option value="">Escolha o status</option>
                          {daArea.filter((outro) => outro.codigo !== item.codigo).map((outro) => (
                            <option key={outro.codigo} value={outro.codigo}>{outro.nome}</option>
                          ))}
                        </select>
                      </>
                    )}
                  </div>
                )}
                <div className="flex gap-3">
                  <button type="button" onClick={() => void salvar(item)} className="font-medium text-pine">Salvar</button>
                  <button type="button" onClick={() => setEditando(null)} className="text-muted">Cancelar</button>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between gap-3">
                <span>
                  <span className="block text-ink">{item.nome}</span>
                  <span className="text-muted">
                    {item.encerra ? "Encerra o processo" : "Em aberto"}
                    {item.area === "administrativo" && item.tramiteDias && item.tramiteCodigo
                      ? ` · em ${item.tramiteDias} dias vai para ${daArea.find((outro) => outro.codigo === item.tramiteCodigo)?.nome ?? item.tramiteCodigo}`
                      : ""}
                  </span>
                </span>
                <span className="flex shrink-0 items-center gap-3">
                  <span
                    draggable
                    onDragStart={(evento) => {
                      evento.dataTransfer.setData("text/plain", item.id);
                      evento.dataTransfer.effectAllowed = "move";
                    }}
                    className="cursor-grab select-none text-muted"
                    aria-label={`Arrastar ${item.nome}`}
                    title="Arrastar"
                  >
                    ⋮⋮
                  </span>
                  <button type="button" onClick={() => mudarOrdem(item.id, daArea[daArea.findIndex((atual) => atual.id === item.id) - 1]?.id ?? "")} className="font-medium text-pine">Subir</button>
                  <button type="button" onClick={() => mudarOrdem(item.id, daArea[daArea.findIndex((atual) => atual.id === item.id) + 1]?.id ?? "")} className="font-medium text-pine">Descer</button>
                  <button type="button" onClick={() => abrirEdicao(item)} className="font-medium text-pine">Editar</button>
                  {!item.fixo && (
                    <button
                      type="button"
                      onClick={() =>
                        onConfirmar(`Excluir o status ${item.nome}?`, () => {
                          void apagarStatusGestao({ data: { token, id: item.id } })
                            .then(() => {
                              onAviso("Status excluído.");
                              onMudou();
                            })
                            .catch((err: unknown) => onErro(err instanceof Error ? err.message : "Não foi possível excluir o status."));
                        })
                      }
                      className="font-medium text-seal"
                    >
                      Excluir
                    </button>
                  )}
                </span>
              </div>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
