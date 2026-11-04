import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link } from "@tanstack/react-router";
import { createFileRoute } from "@tanstack/react-router";
import {
  alternarAbaGestao,
  apagarAbaGestao,
  entrarGestao,
  painelGestao,
  renomearAbaGestao,
  sairGestao,
  salvarAbaGestao,
  trocarAcessoGestao,
  abrirSistemaGestao,
  ordenarAbasGestao,
  ordenarStatusGestao,
  cancelarConviteGestao,
  convitesPendentesGestao,
  definirModulosEquipeGestao,
  equipesPorModuloGestao,
} from "@/lib/gestao.functions";
import { SecaoContas, SecaoSistema, SecaoStatus, SecaoUsuarios, novaOrdem } from "@/components/gestao-extra";
import { CampoSenha } from "@/components/campo-senha";
import { useConfirmarExclusao } from "@/components/confirmar-exclusao";

export const Route = createFileRoute("/gestao")({ component: Gestao });

const CHAVE = "gestao.token";

type Painel = Awaited<ReturnType<typeof painelGestao>>;

function hora(valor: string | null) {
  if (!valor) return "—";
  const data = new Date(valor);
  if (Number.isNaN(data.getTime())) return "—";
  return data.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

function tamanho(n: number) {
  if (!Number.isFinite(n) || n <= 0) return "0 B";
  if (n < 1024) return `${Math.round(n)} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 ** 3) return `${(n / 1024 ** 2).toFixed(1)} MB`;
  return `${(n / 1024 ** 3).toFixed(2)} GB`;
}

function ritmo(n: number) {
  return `${tamanho(n)}/s`;
}

function tempoNoAr(segundos: number) {
  const h = Math.floor(segundos / 3600);
  const m = Math.floor((segundos % 3600) / 60);
  if (h > 0) return `${h} h ${m} min`;
  if (m > 0) return `${m} min`;
  return `${segundos} s`;
}

function Barra({ nome, pct, detalhe }: { nome: string; pct: number; detalhe: string }) {
  const largo = Math.max(0, Math.min(100, pct));
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3 text-sm">
        <span className="font-medium text-ink">{nome}</span>
        <span className="tabular-nums text-muted">{detalhe}</span>
      </div>
      <div className="mt-1 h-2 overflow-hidden rounded-full bg-paper">
        <div className={"h-full rounded-full " + (largo >= 85 ? "bg-seal" : "bg-pine")} style={{ width: `${largo}%` }} />
      </div>
    </div>
  );
}

function StatusMaquina({ maquina, pulso }: { maquina: Painel["maquina"]; pulso: number[] }) {
  const memoria = maquina.memoriaTotal > 0 ? (maquina.memoriaUsada / maquina.memoriaTotal) * 100 : 0;
  const disco = maquina.discoTotal > 0 ? (maquina.discoUsado / maquina.discoTotal) * 100 : 0;
  const redePct = Math.min(100, ((maquina.redeRecebidaTaxa + maquina.redeEnviadaTaxa) / (512 * 1024)) * 100);
  const pontos = pulso.map((valor, indice) => {
    const x = pulso.length < 2 ? 0 : (indice / (pulso.length - 1)) * 160;
    const y = 36 - (Math.max(0, Math.min(100, valor)) / 100) * 32;
    return `${indice === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
  });
  return (
    <section className="mt-5 rounded-2xl border border-line bg-sheet p-4">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <h2 className="text-sm font-medium text-ink">Status do aplicativo</h2>
        <p className="text-xs text-muted">No ar há {tempoNoAr(maquina.noAr)} · {maquina.nucleos} núcleos</p>
      </div>
      <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_11rem]">
        <div className="flex flex-col gap-3">
          <Barra nome="Processador" pct={maquina.cpu} detalhe={`${maquina.cpu.toFixed(1)}%`} />
          <Barra nome="Memória" pct={memoria} detalhe={`${tamanho(maquina.memoriaUsada)} de ${tamanho(maquina.memoriaTotal)}`} />
          <Barra nome="Disco do servidor" pct={disco} detalhe={`${tamanho(maquina.discoUsado)} de ${tamanho(maquina.discoTotal)}`} />
          <Barra
            nome="Rede"
            pct={redePct}
            detalhe={`↓ ${ritmo(maquina.redeRecebidaTaxa)} · ↑ ${ritmo(maquina.redeEnviadaTaxa)}`}
          />
        </div>
        <div className="rounded-xl border border-line bg-paper p-3">
          <p className="text-xs text-muted">Processador agora</p>
          <svg viewBox="0 0 160 36" className="mt-2 h-9 w-full text-pine" aria-hidden>
            <path d={pontos.join(" ")} fill="none" stroke="currentColor" strokeWidth="2" />
          </svg>
          <p className="mt-2 text-xs text-muted">Este processo usa {tamanho(maquina.memoriaProcesso)} de memória.</p>
        </div>
      </div>
      <dl className="mt-4 grid gap-2 text-sm sm:grid-cols-3">
        <div className="rounded-xl bg-paper px-3 py-2">
          <dt className="text-xs text-muted">Consultas ao banco</dt>
          <dd className="font-medium text-ink">{maquina.consultas}</dd>
        </div>
        <div className="rounded-xl bg-paper px-3 py-2">
          <dt className="text-xs text-muted">Banco, enviado / recebido</dt>
          <dd className="font-medium text-ink">{tamanho(maquina.dadosIda)} / {tamanho(maquina.dadosVolta)}</dd>
        </div>
        <div className="rounded-xl bg-paper px-3 py-2">
          <dt className="text-xs text-muted">Rede, recebido / enviado</dt>
          <dd className="font-medium text-ink">{tamanho(maquina.redeRecebida)} / {tamanho(maquina.redeEnviada)}</dd>
        </div>
      </dl>
      <p className="mt-3 text-xs text-muted">
        A troca com o banco anda a {ritmo(maquina.dadosTaxa)}. O disco é da máquina que hospeda o sistema, não dos seus processos — ela já vem quase cheia, e o aplicativo em si usa bem pouco.
      </p>
    </section>
  );
}

function Gestao() {
  const [token, setToken] = useState<string | null>(null);
  const [pronto, setPronto] = useState(false);
  const [painel, setPainel] = useState<Painel | null>(null);
  const [erro, setErro] = useState("");
  const ordemMarca = useRef(0);

  useEffect(() => {
    const guardado = sessionStorage.getItem(CHAVE);
    setToken(guardado);
    setPronto(true);
  }, []);

  useEffect(() => {
    if (!token) return;
    let vivo = true;
    async function ler() {
      const marca = ordemMarca.current;
      try {
        const dados = await painelGestao({ data: token as string });
        if (vivo && ordemMarca.current === marca) {
          setPainel(dados);
          setErro("");
        }
      } catch (err) {
        if (!vivo) return;
        sessionStorage.removeItem(CHAVE);
        setToken(null);
        setPainel(null);
        setErro(err instanceof Error ? err.message : "Sessão encerrada.");
      }
    }
    void ler();
    const id = window.setInterval(() => void ler(), 5000);
    return () => {
      vivo = false;
      window.clearInterval(id);
    };
  }, [token]);

  async function guardarOrdem(tipo: "status" | "abas", ids: string[]) {
    if (!token) return;
    const marca = ++ordemMarca.current;
    setPainel((atual) => {
      if (!atual) return atual;
      const grupo = new Set(ids);
      const lista = tipo === "status" ? atual.status : atual.abas;
      const porId = new Map(lista.filter((item) => grupo.has(item.id)).map((item) => [item.id, item]));
      const fila = ids.flatMap((id) => {
        const item = porId.get(id);
        return item ? [item] : [];
      });
      let indice = 0;
      const nova = lista.map((item) => (grupo.has(item.id) ? fila[indice++] ?? item : item));
      return tipo === "status" ? { ...atual, status: nova as typeof atual.status } : { ...atual, abas: nova as typeof atual.abas };
    });
    try {
      if (tipo === "status") await ordenarStatusGestao({ data: { token, ids } });
      else await ordenarAbasGestao({ data: { token, ids } });
    } catch (err) {
      if (ordemMarca.current === marca) {
        const dados = await painelGestao({ data: token }).catch(() => null);
        if (dados) setPainel(dados);
      }
      throw err;
    }
  }

  if (!pronto) return null;
  if (!token) return <Entrada erroInicial={erro} onEntrou={setToken} />;
  if (!painel) {
    return (
      <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4">
        <p className="font-display text-3xl text-ink">Área restrita</p>
        <p className="mt-2 text-sm text-muted">Abrindo o painel…</p>
      </main>
    );
  }
  return (
    <PainelVivo
      token={token}
      painel={painel}
      onSair={() => { sessionStorage.removeItem(CHAVE); setToken(null); setPainel(null); }}
      onMudou={() => {
        const marca = ordemMarca.current;
        void painelGestao({ data: token }).then((dados) => {
          if (ordemMarca.current === marca) setPainel(dados);
        });
      }}
      onOrdemStatus={(ids) => guardarOrdem("status", ids)}
      onOrdemAbas={(ids) => guardarOrdem("abas", ids)}
    />
  );
}

function Entrada({ erroInicial, onEntrou }: { erroInicial: string; onEntrou: (token: string) => void }) {
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState(erroInicial);
  const [enviando, setEnviando] = useState(false);

  async function enviar(evento: FormEvent) {
    evento.preventDefault();
    setEnviando(true);
    setErro("");
    try {
      const resultado = await entrarGestao({ data: { email, senha } });
      sessionStorage.setItem(CHAVE, resultado.token);
      onEntrou(resultado.token);
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Não foi possível entrar.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4 py-16">
      <p className="font-display text-3xl text-ink">Área restrita</p>
      <p className="mt-2 text-sm text-muted">Só o gestor entra aqui. O que acontece no sistema aparece ao vivo.</p>
      <form className="mt-6 flex flex-col gap-3" onSubmit={(evento) => void enviar(evento)}>
        <label className="flex flex-col gap-1 text-sm font-medium text-ink">
          E-mail
          <input value={email} onChange={(evento) => setEmail(evento.target.value)} type="email" autoComplete="username" className="h-11 rounded-xl border border-line bg-sheet px-3 font-normal" spellCheck={false} />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium text-ink">
          Senha
          <CampoSenha value={senha} onChange={(evento) => setSenha(evento.target.value)} autoComplete="current-password" className="h-11 rounded-xl border border-line bg-sheet px-3 font-normal" />
        </label>
        {erro && <p className="text-sm text-seal">{erro}</p>}
        <button type="submit" disabled={enviando} className="inline-flex h-12 items-center justify-center rounded-xl bg-pine text-sm font-medium text-sheet disabled:opacity-60">
          {enviando ? "Entrando…" : "Entrar"}
        </button>
      </form>
      <Link to="/" className="mt-4 text-sm font-medium text-pine">Voltar ao sistema</Link>
    </main>
  );
}

function SecaoConvites({
  token,
  onErro,
  onConfirmar,
}: {
  token: string;
  onErro: (texto: string) => void;
  onConfirmar: (pergunta: string, acao: () => void) => void;
}) {
  const [lista, setLista] = useState<Awaited<ReturnType<typeof convitesPendentesGestao>>>([]);
  const [pronto, setPronto] = useState(false);

  function carregar() {
    void convitesPendentesGestao({ data: token })
      .then((itens) => {
        setLista(itens);
        setPronto(true);
      })
      .catch((err: unknown) => onErro(err instanceof Error ? err.message : "Não foi possível listar os convites."));
  }

  useEffect(() => {
    carregar();
  }, [token]);

  return (
    <section className="mt-5 rounded-2xl border border-line bg-sheet p-4">
      <h2 className="text-sm font-medium text-ink">Convites pendentes</h2>
      <p className="mt-1 text-sm text-muted">Quem ainda não entrou na equipe. O link do e-mail vale 24 horas.</p>
      <ul className="mt-3 flex flex-col">
        {pronto && lista.length === 0 && <li className="text-sm text-muted">Nenhum convite pendente.</li>}
        {lista.map((item, indice) => (
          <li key={`${item.equipeId}:${item.email}`} className={"flex items-center justify-between gap-3 px-2 py-2 text-sm " + (indice % 2 === 0 ? "bg-paper" : "")}>
            <span className="min-w-0">
              <span className="block truncate font-medium text-ink">{item.nome}</span>
              <span className="block truncate text-muted">
                {item.email} · {item.equipe}
                {item.expiraEm ? ` · até ${hora(item.expiraEm)}` : ""}
                {item.valido ? "" : " · expirado"}
              </span>
            </span>
            <button
              type="button"
              onClick={() =>
                onConfirmar(`Cancelar o convite de ${item.nome} para ${item.equipe}?`, () => {
                  void cancelarConviteGestao({ data: { token, equipeId: item.equipeId, email: item.email } })
                    .then(() => carregar())
                    .catch((err: unknown) => onErro(err instanceof Error ? err.message : "Não foi possível cancelar."));
                })
              }
              className="shrink-0 font-medium text-seal"
            >
              Cancelar
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

function SecaoEquipeModulo({ token, onErro }: { token: string; onErro: (texto: string) => void }) {
  const [lista, setLista] = useState<Awaited<ReturnType<typeof equipesPorModuloGestao>>>([]);
  const [pronto, setPronto] = useState(false);

  function carregar() {
    void equipesPorModuloGestao({ data: token })
      .then((itens) => {
        setLista(itens);
        setPronto(true);
      })
      .catch((err: unknown) => onErro(err instanceof Error ? err.message : "Não foi possível listar as equipes."));
  }

  useEffect(() => {
    carregar();
  }, [token]);

  function alternar(id: string, modulo: "legislativo" | "administrativo") {
    const atual = lista.find((item) => item.id === id);
    if (!atual) return;
    const tem = atual.modulos.includes(modulo);
    const proximos = tem ? atual.modulos.filter((item) => item !== modulo) : [...atual.modulos, modulo];
    if (!proximos.length) {
      onErro("A equipe precisa ficar em pelo menos um módulo.");
      return;
    }
    const anterior = lista;
    setLista((itens) => itens.map((item) => (item.id === id ? { ...item, modulos: proximos } : item)));
    void definirModulosEquipeGestao({ data: { token, equipeId: id, modulos: proximos } }).catch((err: unknown) => {
      setLista(anterior);
      onErro(err instanceof Error ? err.message : "Não foi possível mudar o módulo da equipe.");
    });
  }

  return (
    <section className="mt-5 rounded-2xl border border-line bg-sheet p-4">
      <h2 className="text-sm font-medium text-ink">Equipe por módulo</h2>
      <p className="mt-1 text-sm text-muted">Escolha em quais módulos a equipe aparece. Pode ser um ou mais.</p>
      <ul className="mt-3 flex flex-col">
        {pronto && lista.length === 0 && <li className="text-sm text-muted">Nenhuma equipe criada.</li>}
        {lista.map((item, indice) => (
          <li key={item.id} className={"flex flex-col gap-3 px-2 py-3 sm:flex-row sm:items-center sm:justify-between " + (indice % 2 === 0 ? "bg-paper" : "")}>
            <span className="font-medium text-ink">{item.nome}</span>
            <span className="flex flex-col gap-2 sm:flex-row sm:gap-4">
              <label className="inline-flex items-center gap-2 text-sm text-ink">
                <input type="checkbox" checked={item.modulos.includes("legislativo")} onChange={() => alternar(item.id, "legislativo")} />
                Processos Legislativos
              </label>
              <label className="inline-flex items-center gap-2 text-sm text-ink">
                <input type="checkbox" checked={item.modulos.includes("administrativo")} onChange={() => alternar(item.id, "administrativo")} />
                Processos Administrativo
              </label>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function PainelVivo({
  token,
  painel,
  onSair,
  onMudou,
  onOrdemStatus,
  onOrdemAbas,
}: {
  token: string;
  painel: Painel;
  onSair: () => void;
  onMudou: () => void;
  onOrdemStatus: (ids: string[]) => Promise<void>;
  onOrdemAbas: (ids: string[]) => Promise<void>;
}) {
  const [area, setArea] = useState<"legislativo" | "administrativo">("legislativo");
  const [nomeAba, setNomeAba] = useState("");
  const [email, setEmail] = useState(painel.email);
  const [senhaAtual, setSenhaAtual] = useState("");
  const [senhaNova, setSenhaNova] = useState("");
  const [senhaDeNovo, setSenhaDeNovo] = useState("");
  const [aviso, setAviso] = useState("");
  const [erro, setErro] = useState("");
  const [pulso, setPulso] = useState<number[]>([]);
  const [guia, setGuia] = useState<"geral" | "usuarios" | "modulos" | "contas" | "convites" | "tipos" | "sistema">("geral");
  const [editandoAba, setEditandoAba] = useState<string | null>(null);
  const [nomeEdicao, setNomeEdicao] = useState("");
  const [sobreAba, setSobreAba] = useState<string | null>(null);
  const exclusao = useConfirmarExclusao();

  function avisar(texto: string) {
    setErro("");
    setAviso(texto);
  }

  function falhar(texto: string) {
    setAviso("");
    setErro(texto);
  }

  function pedirConfirmacao(texto: string, agir: () => void, rotulo?: string) {
    exclusao.pedir(texto, agir, rotulo);
  }

  useEffect(() => setEmail(painel.email), [painel.email]);
  useEffect(() => {
    setPulso((lista) => [...lista, painel.maquina.cpu].slice(-24));
  }, [painel.maquina.em]);

  async function criarAba(evento: FormEvent) {
    evento.preventDefault();
    setErro("");
    try {
      await salvarAbaGestao({ data: { token, area, nome: nomeAba } });
      setNomeAba("");
      avisar("Aba disponível no sistema.");
      onMudou();
    } catch (err) {
      falhar(err instanceof Error ? err.message : "Não foi possível criar a aba.");
    }
  }

  async function trocar(evento: FormEvent) {
    evento.preventDefault();
    setErro("");
    if (senhaNova !== senhaDeNovo) {
      falhar("A repetição da senha não confere.");
      return;
    }
    try {
      await trocarAcessoGestao({ data: { token, email, senhaAtual, senhaNova } });
      setSenhaAtual("");
      setSenhaNova("");
      setSenhaDeNovo("");
      avisar("Acesso atualizado. Da próxima vez, use estes dados.");
      onMudou();
    } catch (err) {
      falhar(err instanceof Error ? err.message : "Não foi possível trocar o acesso.");
    }
  }

  const numeros = [
    ["Ativos agora", painel.ativos],
    ["Usuários", painel.usuarios],
    ["Sessões", painel.sessoes],
    ["Legislativos", painel.legislativos],
    ["Administrativos", painel.administrativos],
    ["Equipes", painel.equipes],
  ] as const;

  return (
    <main className="mx-auto min-h-screen max-w-6xl px-4 py-6 md:px-8 md:py-8">
      <header className="flex flex-col gap-3 border-b border-line pb-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="font-display text-3xl text-ink">Área restrita</p>
          <p className="mt-1 flex items-center gap-2 text-sm text-muted">
            <span className="inline-block size-2 animate-pulse rounded-full bg-pine" />
            Ao vivo · atualiza sozinho
            {painel.config.manutencao ? " · manutenção ligada. O que for lançado agora sai quando o sistema for liberado." : ""}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => {
              void (async () => {
                setErro("");
                if (painel.config.manutencao) {
                  try {
                    await abrirSistemaGestao({ data: { token } });
                  } catch (err) {
                    falhar(err instanceof Error ? err.message : "Não foi possível abrir o sistema.");
                    return;
                  }
                }
                window.location.assign("/");
              })();
            }}
            className="inline-flex h-11 items-center rounded-xl border border-line bg-sheet px-4 text-sm font-medium text-ink"
          >
            Sistema
          </button>
          <button
            type="button"
            onClick={() => void sairGestao({ data: token }).finally(onSair)}
            className="inline-flex h-11 items-center rounded-xl bg-ink px-4 text-sm font-medium text-sheet"
          >
            Sair
          </button>
        </div>
      </header>

      {painel.trocaPendente && (
        <p className="mt-4 rounded-2xl border border-line bg-sheet px-4 py-3 text-sm text-ink">
          Este ainda é o acesso inicial. Troque o e-mail e a senha no fim da página.
        </p>
      )}

      {(aviso || erro) && (
        <div className="fixed inset-0 z-[80] grid place-items-center bg-ink/40 px-4" role="alertdialog">
          <div className="w-full max-w-sm rounded-2xl border border-line bg-sheet p-5">
            <p className={"text-sm leading-relaxed " + (erro ? "text-seal" : "text-ink")}>{erro || aviso}</p>
            <button
              type="button"
              onClick={() => {
                setAviso("");
                setErro("");
              }}
              className="mt-4 inline-flex h-11 w-full items-center justify-center rounded-xl bg-pine text-sm font-medium text-sheet"
            >
              Entendi
            </button>
          </div>
        </div>
      )}
      {exclusao.dialogo}

      <div className="mt-5 flex flex-wrap gap-2">
        {(
          [
            ["geral", "Visão geral"],
            ["usuarios", "Usuários e equipes"],
            ["modulos", "Equipe por módulo"],
            ["contas", "Bloqueios e exclusões"],
            ["convites", "Convites pendentes"],
            ["tipos", "Tipos e status"],
            ["sistema", "Logs e sistema"],
          ] as const
        ).map(([id, rotulo]) => (
          <button
            key={id}
            type="button"
            onClick={() => setGuia(id)}
            className={"inline-flex h-10 items-center rounded-full px-4 text-sm font-medium " + (guia === id ? "bg-ink text-sheet" : "border border-line bg-sheet text-ink")}
          >
            {rotulo}
          </button>
        ))}
      </div>

      {guia === "geral" && (
        <>
      <section className="mt-5 grid grid-cols-2 gap-2 md:grid-cols-3">
        {(
          [
            ["Vencem hoje", painel.prazos.hoje],
            ["Em atraso", painel.prazos.atraso],
            ["Próximos 7 dias", painel.prazos.semana],
          ] as const
        ).map(([rotulo, valor]) => (
          <article key={rotulo} className="rounded-2xl border border-line bg-sheet p-4">
            <p className="text-xs text-muted">{rotulo}</p>
            <p className={"font-display text-3xl " + (rotulo === "Em atraso" && valor > 0 ? "text-seal" : "text-ink")}>{valor}</p>
          </article>
        ))}
      </section>
      <section className="mt-4 grid gap-4 md:grid-cols-2">
        <article className="rounded-2xl border border-line bg-sheet p-4">
          <h2 className="text-sm font-medium text-ink">Onde o atraso se acumula</h2>
          <ul className="mt-2 flex flex-col gap-1 text-sm">
            {painel.gargalosEquipe.length === 0 && <li className="text-muted">Nenhuma equipe com prazo vencido.</li>}
            {painel.gargalosEquipe.map((item) => (
              <li key={item.grupo} className="flex justify-between gap-3">
                <span className="text-ink">{item.grupo}</span>
                <span className="text-seal">{item.n}</span>
              </li>
            ))}
          </ul>
        </article>
        <article className="rounded-2xl border border-line bg-sheet p-4">
          <h2 className="text-sm font-medium text-ink">Tipos com mais atraso</h2>
          <ul className="mt-2 flex flex-col gap-1 text-sm">
            {painel.gargalosTipo.length === 0 && <li className="text-muted">Nenhum tipo com prazo vencido.</li>}
            {painel.gargalosTipo.map((item) => (
              <li key={item.grupo} className="flex justify-between gap-3">
                <span className="text-ink">{item.grupo}</span>
                <span className="text-seal">{item.n}</span>
              </li>
            ))}
          </ul>
        </article>
      </section>
      <section className="mt-4 grid grid-cols-2 gap-2 md:grid-cols-3">
        {numeros.map(([rotulo, valor]) => (
          <article key={rotulo} className="rounded-2xl border border-line bg-sheet p-4">
            <p className="text-xs text-muted">{rotulo}</p>
            <p className="font-display text-3xl text-ink">{valor}</p>
          </article>
        ))}
      </section>

      <StatusMaquina maquina={painel.maquina} pulso={pulso} />

      <section className="mt-5 grid gap-4 lg:grid-cols-2">
        <article className="rounded-2xl border border-line bg-sheet p-4">
          <h2 className="text-sm font-medium text-ink">Quem está agora</h2>
          <ul className="mt-3 flex flex-col gap-2">
            {painel.presentes.length === 0 && <li className="text-sm text-muted">Ninguém ativo neste momento.</li>}
            {painel.presentes.map((pessoa) => (
              <li key={pessoa.email} className="flex items-center justify-between gap-3 text-sm">
                <span className="min-w-0 truncate text-ink">{pessoa.nome}<span className="text-muted"> · {pessoa.email}</span></span>
                <span className="shrink-0 text-pine">ativo</span>
              </li>
            ))}
          </ul>
          <h2 className="mt-5 text-sm font-medium text-ink">Usuários</h2>
          <ul className="mt-3 flex max-h-64 flex-col gap-2 overflow-y-auto">
            {painel.pessoas.map((pessoa) => (
              <li key={pessoa.id} className="text-sm">
                <span className="text-ink">{pessoa.nome}</span>
                <span className="text-muted"> · {pessoa.email}</span>
                <span className="block text-muted">{pessoa.ativo ? "Ativo agora" : `Visto ${hora(pessoa.vistoEm)}`}</span>
              </li>
            ))}
          </ul>
        </article>
        <article className="rounded-2xl border border-line bg-sheet p-4">
          <h2 className="text-sm font-medium text-ink">Registros</h2>
          <ul className="mt-3 flex max-h-[28rem] flex-col gap-3 overflow-y-auto">
            {painel.registros.length === 0 && <li className="text-sm text-muted">Ainda não há movimento.</li>}
            {painel.registros.map((item) => (
              <li key={item.id} className="border-b border-line pb-2 text-sm last:border-0">
                <span className="font-medium text-ink">{item.acao}</span>
                <span className="text-muted"> · {item.nome || item.email || "sistema"}</span>
                {item.detalhe && <span className="block text-ink">{item.detalhe}</span>}
                <span className="text-muted">{hora(item.em)}</span>
              </li>
            ))}
          </ul>
        </article>
      </section>
        </>
      )}

      {guia === "usuarios" && (
        <SecaoUsuarios token={token} painel={painel} onMudou={onMudou} onErro={falhar} onAviso={avisar} onConfirmar={pedirConfirmacao} />
      )}
      {guia === "modulos" && <SecaoEquipeModulo token={token} onErro={falhar} />}
      {guia === "contas" && (
        <SecaoContas token={token} painel={painel} onMudou={onMudou} onErro={falhar} onAviso={avisar} onConfirmar={pedirConfirmacao} />
      )}
      {guia === "convites" && <SecaoConvites token={token} onErro={falhar} onConfirmar={pedirConfirmacao} />}

      {guia === "tipos" && (
        <>
      <section className="mt-5 rounded-2xl border border-line bg-sheet p-4">
        <h2 className="text-sm font-medium text-ink">Abas e tipos</h2>
        <p className="mt-1 text-sm text-muted">Uma aba nova passa a aparecer no lançamento. Arraste para mudar a ordem dentro da mesma área.</p>
        <form className="mt-3 flex flex-col gap-2 sm:flex-row" onSubmit={(evento) => void criarAba(evento)}>
          <select value={area} onChange={(evento) => setArea(evento.target.value as "legislativo" | "administrativo")} className="h-11 rounded-xl border border-line bg-paper px-3 text-sm text-ink">
            <option value="legislativo">Processos legislativos</option>
            <option value="administrativo">Processos administrativos</option>
          </select>
          <input value={nomeAba} onChange={(evento) => setNomeAba(evento.target.value)} placeholder="Nome da nova aba" className="h-11 min-w-0 flex-1 rounded-xl border border-line bg-paper px-3 text-sm text-ink" spellCheck lang="pt-BR" />
          <button type="submit" className="inline-flex h-11 items-center justify-center rounded-xl bg-pine px-4 text-sm font-medium text-sheet">Criar aba</button>
        </form>
        <ul className="mt-4 flex flex-col gap-2">
          {painel.abas.map((aba) => (
            <li
              key={aba.id}
              onDragOver={(evento) => {
                evento.preventDefault();
                setSobreAba(aba.id);
              }}
              onDragLeave={() => setSobreAba((valor) => (valor === aba.id ? null : valor))}
              onDrop={(evento) => {
                evento.preventDefault();
                setSobreAba(null);
                const origemId = evento.dataTransfer.getData("text/plain");
                const origem = painel.abas.find((item) => item.id === origemId);
                if (!origem || origem.area !== aba.area) return;
                const ids = novaOrdem(
                  painel.abas.filter((item) => item.area === aba.area).map((item) => item.id),
                  origemId,
                  aba.id,
                );
                if (!ids) return;
                void onOrdemAbas(ids).catch((err: unknown) => falhar(err instanceof Error ? err.message : "Não foi possível reordenar."));
              }}
              className={"flex flex-col gap-2 rounded-xl border px-3 py-2 text-sm sm:flex-row sm:items-center sm:justify-between " + (sobreAba === aba.id ? "border-pine bg-pine-soft" : "border-line")}
            >
              <span className="min-w-0">
                {editandoAba === aba.id ? (
                  <input value={nomeEdicao} onChange={(evento) => setNomeEdicao(evento.target.value)} className="h-9 w-full rounded-lg border border-line bg-paper px-2" spellCheck lang="pt-BR" />
                ) : (
                  <span className="block truncate text-ink">{aba.nome}</span>
                )}
                <span className="text-muted">
                  {aba.area === "legislativo" ? "Legislativo" : "Administrativo"}
                  {aba.ativa ? "" : " · arquivada"} · {aba.uso} {aba.uso === 1 ? "processo" : "processos"}
                </span>
              </span>
              <span className="flex shrink-0 flex-wrap items-center gap-3">
                <span
                  draggable
                  onDragStart={(evento) => {
                    evento.dataTransfer.setData("text/plain", aba.id);
                    evento.dataTransfer.effectAllowed = "move";
                  }}
                  className="cursor-grab select-none text-muted"
                  aria-label={`Arrastar ${aba.nome}`}
                  title="Arrastar"
                >
                  ⋮⋮
                </span>
                <button
                  type="button"
                  onClick={() => {
                    const idsArea = painel.abas.filter((item) => item.area === aba.area).map((item) => item.id);
                    const indice = idsArea.indexOf(aba.id);
                    const ids = novaOrdem(idsArea, aba.id, idsArea[indice - 1] ?? "");
                    if (!ids) return;
                    void onOrdemAbas(ids).catch((err: unknown) => falhar(err instanceof Error ? err.message : "Não foi possível reordenar."));
                  }}
                  className="font-medium text-pine"
                >
                  Subir
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const idsArea = painel.abas.filter((item) => item.area === aba.area).map((item) => item.id);
                    const indice = idsArea.indexOf(aba.id);
                    const ids = novaOrdem(idsArea, aba.id, idsArea[indice + 1] ?? "");
                    if (!ids) return;
                    void onOrdemAbas(ids).catch((err: unknown) => falhar(err instanceof Error ? err.message : "Não foi possível reordenar."));
                  }}
                  className="font-medium text-pine"
                >
                  Descer
                </button>
                {!aba.fixa && editandoAba === aba.id && (
                  <button
                    type="button"
                    onClick={() =>
                      void renomearAbaGestao({ data: { token, id: aba.id, nome: nomeEdicao } })
                        .then(() => {
                          setEditandoAba(null);
                          onMudou();
                        })
                        .catch((err: unknown) => falhar(err instanceof Error ? err.message : "Não foi possível renomear."))
                    }
                    className="font-medium text-pine"
                  >
                    Salvar
                  </button>
                )}
                {!aba.fixa && editandoAba !== aba.id && (
                  <button type="button" onClick={() => { setEditandoAba(aba.id); setNomeEdicao(aba.nome); }} className="font-medium text-pine">Editar</button>
                )}
                {!aba.fixa && (
                  <button
                    type="button"
                    onClick={() => void alternarAbaGestao({ data: { token, id: aba.id, ativa: !aba.ativa } }).then(onMudou).catch((err: unknown) => falhar(err instanceof Error ? err.message : "Não foi possível alterar a aba."))}
                    className="font-medium text-pine"
                  >
                    {aba.ativa ? "Arquivar" : "Reativar"}
                  </button>
                )}
                {!aba.fixa && (
                  <button
                    type="button"
                    onClick={() =>
                      pedirConfirmacao(`Excluir o tipo ${aba.nome}?`, () => {
                        void apagarAbaGestao({ data: { token, id: aba.id } })
                          .then(() => {
                            avisar("Tipo excluído.");
                            onMudou();
                          })
                          .catch((err: unknown) => falhar(err instanceof Error ? err.message : "Não foi possível excluir o tipo."));
                      })
                    }
                    className="font-medium text-seal"
                  >
                    Excluir
                  </button>
                )}
              </span>
            </li>
          ))}
        </ul>
      </section>
      <SecaoStatus token={token} status={painel.status} onMudou={onMudou} onErro={falhar} onAviso={avisar} onConfirmar={pedirConfirmacao} onOrdem={onOrdemStatus} />
        </>
      )}

      {guia === "sistema" && (
        <SecaoSistema
          token={token}
          painel={painel}
          onMudou={onMudou}
          onErro={falhar}
          onAviso={avisar}
          onConfirmar={pedirConfirmacao}
          acesso={
            <section className="rounded-2xl border border-line bg-sheet p-4">
              <h2 className="text-sm font-medium text-ink">Seu acesso</h2>
              <p className="mt-1 text-sm text-muted">Troque o e-mail e a senha quando quiser. A senha atual confirma a mudança.</p>
              <form className="mt-3 grid gap-2 md:grid-cols-2" onSubmit={(evento) => void trocar(evento)}>
                <label className="flex flex-col gap-1 text-sm font-medium text-ink">
                  E-mail
                  <input value={email} onChange={(evento) => setEmail(evento.target.value)} type="email" className="h-11 rounded-xl border border-line bg-paper px-3 font-normal" spellCheck={false} />
                </label>
                <label className="flex flex-col gap-1 text-sm font-medium text-ink">
                  Senha atual
                  <CampoSenha value={senhaAtual} onChange={(evento) => setSenhaAtual(evento.target.value)} className="h-11 rounded-xl border border-line bg-paper px-3 font-normal" />
                </label>
                <label className="flex flex-col gap-1 text-sm font-medium text-ink">
                  Nova senha
                  <CampoSenha value={senhaNova} onChange={(evento) => setSenhaNova(evento.target.value)} className="h-11 rounded-xl border border-line bg-paper px-3 font-normal" />
                </label>
                <label className="flex flex-col gap-1 text-sm font-medium text-ink">
                  Repetir a nova senha
                  <CampoSenha value={senhaDeNovo} onChange={(evento) => setSenhaDeNovo(evento.target.value)} className="h-11 rounded-xl border border-line bg-paper px-3 font-normal" />
                </label>
                <button type="submit" className="inline-flex h-11 items-center justify-center rounded-xl bg-pine text-sm font-medium text-sheet md:col-span-2">Salvar acesso</button>
              </form>
            </section>
          }
        />
      )}
    </main>
  );
}
