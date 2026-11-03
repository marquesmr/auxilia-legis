import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import {
  backupGestao,
  backupsAutomaticosGestao,
  bloquearUsuarioGestao,
  definirPapelGestao,
  desvincularEquipeGestao,
  excluirUsuarioGestao,
  feriadoGestao,
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

type Painel = Awaited<ReturnType<typeof painelGestao>>;

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
}: {
  token: string;
  painel: Painel;
  onMudou: () => void;
  onErro: (texto: string) => void;
  onAviso: (texto: string) => void;
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
                      onClick={() => {
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
                      }}
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
                        onClick={() => void agir(desvincularEquipeGestao({ data: { token, equipeId: equipe.id, userId: membro.id } }), "Pessoa removida da equipe.")}
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
  acesso,
}: {
  token: string;
  painel: Painel;
  onMudou: () => void;
  onErro: (texto: string) => void;
  onAviso: (texto: string) => void;
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
              .then(() => {
                onAviso(painel.config.manutencao ? "Sistema liberado." : "Sistema em manutenção.");
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
                onClick={() => void feriadoGestao({ data: { token, apagar: true, id: item.id, nome: "", tipo: "feriado", inicio: "", fim: "" } }).then(onMudou)}
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
            onClick={() =>
              void backupGestao({ data: token })
                .then((arquivo) => {
                  baixar(arquivo.nome, arquivo.conteudo);
                  onAviso("Backup baixado.");
                  onMudou();
                })
                .catch((err: unknown) => onErro(err instanceof Error ? err.message : "Não foi possível fazer o backup."))
            }
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
                      onAviso(`Restauradas ${resultado.contas} contas, ${resultado.processos} legislativos e ${resultado.administrativos} administrativos. Essas contas entram sem o aplicativo autenticador.`);
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
