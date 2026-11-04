import { useEffect, useState, type FormEvent } from "react";
import { Link } from "@tanstack/react-router";
import { Scale } from "lucide-react";
import { authClient, GROK_PROVIDERS, signIn } from "@/lib/auth/client";
import { criarContaComCodigo, entrarPeloLink, lerLiberacaoCadastro, pedirCodigoCadastro, pedirCodigoSenha, redefinirComCodigo } from "@/lib/auth/senha-email.functions";
import { consultarExclusao, limparAvisoExclusao } from "@/lib/gestao.functions";
import { AvisoContaExcluida } from "@/components/aviso-exclusao";
import { TermosCadastro } from "@/components/termos-cadastro";
import { CampoSenha } from "@/components/campo-senha";
import { AvisoSenha } from "@/components/aviso-senha";
import { idadeEm, limitesNascimento } from "@/lib/idade";
import { soltarTemaDaConta } from "@/lib/preferencias";
import { concluirAcessoForcado, esquecerLembranca, guardarLembranca, lerLembranca } from "@/lib/lembrar-acesso";
import { campanhaDoMes, corClara, corNoDegrade, corTexto, degradeCampanha, type FaixaCampanha } from "@/lib/campanha-mes";

type Modo = "entrar" | "criar" | "esqueci";

function Fita({ cor }: { cor: string }) {
  return (
    <svg viewBox="0 0 24 24" className="mt-0.5 size-5 shrink-0" aria-hidden>
      <path
        fill={cor}
        stroke={corClara(cor) ? "#1c1915" : "rgba(255,255,255,.7)"}
        strokeWidth="1.2"
        d="M12 2.4c.3 1.8.9 3.2 1.8 4.4 1 1.3 1.4 2.4 1.4 3.6 0 1.3-.9 2.3-2.1 2.4v7.6L12 18.6 10.9 20.4v-7.6c-1.2-.1-2.1-1.1-2.1-2.4 0-1.2.4-2.3 1.4-3.6C11.1 5.6 11.7 4.2 12 2.4z"
      />
      <path
        fill={cor}
        stroke={corClara(cor) ? "#1c1915" : "rgba(255,255,255,.7)"}
        strokeWidth="1.2"
        d="M8.6 12.2 4.2 21.2l4.4-2.2 1.5-5.2zm6.8 0 4.4 9-4.4-2.2-1.5-5.2z"
      />
    </svg>
  );
}

function ListaCampanha({ faixas, mes, clara = false }: { faixas: FaixaCampanha[]; mes: string; clara?: boolean }) {
  return (
    <ul className="mt-5 flex flex-col gap-2.5">
      {faixas.map((faixa) => (
        <li key={faixa.nome} className="flex items-start gap-2 text-sm leading-snug">
          <Fita cor={faixa.cor} />
          <span>
            <strong className="font-medium">
              {mes} {faixa.nome}
            </strong>
            <span className={`block text-[0.8rem] ${clara ? "text-ink/75" : "opacity-90"}`}>{faixa.tema}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}
const AVISO_EXCLUSAO = "prazos.conta-excluida";
const MOTIVO_EXCLUSAO = "prazos.exclusao-motivo";
const VISTA_EXCLUSAO = "prazos.exclusao-vista";
const CADASTRO_PENDENTE = "prazos.cadastro-pendente";

type RascunhoCadastro = { nome: string; email: string; senha: string; nascimento: string; esperaAte: number; codigo: string };

function lerRascunhoCadastro(): RascunhoCadastro | null {
  try {
    const bruto = sessionStorage.getItem(CADASTRO_PENDENTE);
    if (!bruto) return null;
    const dados = JSON.parse(bruto) as Partial<RascunhoCadastro>;
    if (!dados || typeof dados.email !== "string" || !dados.email.includes("@")) return null;
    return {
      nome: typeof dados.nome === "string" ? dados.nome : "",
      email: dados.email,
      senha: typeof dados.senha === "string" ? dados.senha : "",
      nascimento: typeof dados.nascimento === "string" && /^\d{4}-\d{2}-\d{2}$/.test(dados.nascimento) ? dados.nascimento : "",
      esperaAte: typeof dados.esperaAte === "number" ? dados.esperaAte : 0,
      codigo: typeof dados.codigo === "string" ? dados.codigo.replace(/\D/g, "").slice(0, 6) : "",
    };
  } catch {
    return null;
  }
}

function guardarRascunhoCadastro(dados: RascunhoCadastro) {
  sessionStorage.setItem(CADASTRO_PENDENTE, JSON.stringify(dados));
}

function limparRascunhoCadastro() {
  sessionStorage.removeItem(CADASTRO_PENDENTE);
}

const TRAVA_LOCAL = "prazos.emails-restritos";

function travasLocais() {
  try {
    const dados = JSON.parse(localStorage.getItem(TRAVA_LOCAL) || "{}") as Record<string, number>;
    return dados && typeof dados === "object" ? dados : {};
  } catch {
    return {};
  }
}

function marcarTravaLocal(email: string) {
  const normal = email.trim().toLowerCase();
  const mapa = travasLocais();
  mapa[normal] = Math.max(mapa[normal] ?? 0, Date.now() + 7 * 24 * 60 * 60 * 1000);
  localStorage.setItem(TRAVA_LOCAL, JSON.stringify(mapa));
}

function travaLocalDe(email: string) {
  const ate = travasLocais()[email.trim().toLowerCase()];
  return typeof ate === "number" && ate > Date.now() ? ate : null;
}

function textoTrava(ate: number | string) {
  const quando = new Date(ate).toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
  return `Menor de 18 anos não cria conta. Este e-mail está restrito até ${quando}. Se errou a data, escreva para auxilialegis@marquestecnologies.com e envie um comprovante de que você tem 18 anos ou mais. A liberação antes do prazo só ocorre depois desse contato.`;
}

function avisoPendente() {
  return sessionStorage.getItem(AVISO_EXCLUSAO) === "1" && sessionStorage.getItem(VISTA_EXCLUSAO) !== "1";
}

export function TelaConta() {
  const rascunho = lerRascunhoCadastro();
  const [modo, setModo] = useState<Modo>(() => (rascunho ? "criar" : sessionStorage.getItem(AVISO_EXCLUSAO) === "1" ? "criar" : "entrar"));
  const [nome, setNome] = useState(rascunho?.nome ?? "");
  const [nascimento, setNascimento] = useState(rascunho?.nascimento ?? "");
  const [email, setEmail] = useState(rascunho?.email ?? "");
  const [senha, setSenha] = useState(rascunho?.senha ?? "");
  const [erro, setErro] = useState("");
  const [aviso, setAviso] = useState("");
  const [excluida, setExcluida] = useState(() => sessionStorage.getItem(AVISO_EXCLUSAO) === "1");
  const [mostrarAviso, setMostrarAviso] = useState(avisoPendente);
  const [motivoAviso, setMotivoAviso] = useState(() => sessionStorage.getItem(MOTIVO_EXCLUSAO) ?? "");
  const [enviando, setEnviando] = useState(false);
  const [termos, setTermos] = useState(false);
  const [liberacao, setLiberacao] = useState("");
  const [confirmando, setConfirmando] = useState(Boolean(rascunho));
  const [codigoCadastro, setCodigoCadastro] = useState(rascunho?.codigo ?? "");
  const [codigoLink, setCodigoLink] = useState("");
  const [lembrar, setLembrar] = useState(false);
  const [reverSenha, setReverSenha] = useState(false);
  const [esperaCodigo, setEsperaCodigo] = useState(() => {
    const falta = (rascunho?.esperaAte ?? 0) - Date.now();
    return falta > 0 ? Math.ceil(falta / 1000) : 0;
  });

  useEffect(() => {
    if (esperaCodigo <= 0) return;
    const id = window.setTimeout(() => setEsperaCodigo((valor) => valor - 1), 1000);
    return () => window.clearTimeout(id);
  }, [esperaCodigo]);

  useEffect(() => {
    if (!confirmando) return;
    const atual = lerRascunhoCadastro();
    guardarRascunhoCadastro({
      nome: nome.trim(),
      email: email.trim(),
      senha,
      nascimento,
      esperaAte: atual?.esperaAte && atual.esperaAte > Date.now() ? atual.esperaAte : Date.now() + Math.max(esperaCodigo, 0) * 1000,
      codigo: codigoCadastro,
    });
  }, [confirmando, nome, email, senha, nascimento, codigoCadastro, esperaCodigo]);

  useEffect(() => {
    soltarTemaDaConta();
    const params = new URLSearchParams(window.location.search);
    const liberacaoQ = params.get("liberacao") ?? "";
    if (/^[a-f0-9]{64}$/.test(liberacaoQ)) {
      setEnviando(true);
      void lerLiberacaoCadastro({ data: { token: liberacaoQ } })
        .then((dados) => {
          const mapa = travasLocais();
          delete mapa[dados.email];
          localStorage.setItem(TRAVA_LOCAL, JSON.stringify(mapa));
          limparRascunhoCadastro();
          setModo("criar");
          setConfirmando(false);
          setEmail(dados.email);
          setNascimento(dados.nascimento);
          setLiberacao(liberacaoQ);
          setErro("");
        })
        .catch((err) => setErro(err instanceof Error ? err.message : "Este link de liberação não é válido."))
        .finally(() => setEnviando(false));
      return;
    }
    const acesso = params.get("acesso") ?? "";
    if (/^[a-f0-9]{64}$/.test(acesso)) {
      setEnviando(true);
      void entrarPeloLink({ data: { token: acesso } })
        .then(() => window.location.replace("/"))
        .catch((err) => {
          setErro(err instanceof Error ? err.message : "Este link expirou. Entre com seu e-mail e senha.");
          setEnviando(false);
        });
      return;
    }
    if (params.get("senha") === "1") {
      limparRascunhoCadastro();
      setConfirmando(false);
      const emailQ = params.get("email") ?? "";
      const codigoQ = (params.get("codigo") ?? "").replace(/\D/g, "").slice(0, 6);
      if (emailQ) setEmail(emailQ);
      setCodigoLink(codigoQ);
      setModo("esqueci");
      return;
    }
    if (lerRascunhoCadastro()) return;
    const guardado = lerLembranca();
    if (guardado) {
      setEmail(guardado.email);
      setSenha(guardado.senha);
      setLembrar(true);
      if (guardado.senha && (guardado.acessos + 1) % 5 === 0) setReverSenha(true);
    }
  }, []);

  async function concluir(modoAtual: Modo) {
    if (modoAtual === "criar") return;
    setEnviando(true);
    try {
      const resultado = await authClient.signIn.email({
              email: email.trim(),
              password: senha,
              callbackURL: "/",
              rememberMe: lembrar,
            });
      if (resultado.error) {
        if (modoAtual === "entrar") {
          const estado = await consultarExclusao({ data: { email: email.trim() } }).catch(() => ({ excluida: false, motivo: "" }));
          if (estado.excluida) {
            sessionStorage.setItem(AVISO_EXCLUSAO, "1");
            sessionStorage.setItem(MOTIVO_EXCLUSAO, estado.motivo);
            sessionStorage.removeItem(VISTA_EXCLUSAO);
            setExcluida(true);
            setMotivoAviso(estado.motivo);
            setMostrarAviso(true);
            setErro("");
            return;
          }
        }
        setErro(traduzir(resultado.error.message ?? ""));
        return;
      }
      if (lembrar) guardarLembranca(email.trim(), senha);
      else if ((lerLembranca()?.email ?? "").toLowerCase() === email.trim().toLowerCase()) esquecerLembranca();
      void limparAvisoExclusao({ data: { email: email.trim() } }).catch(() => undefined);
      sessionStorage.removeItem(AVISO_EXCLUSAO);
      sessionStorage.removeItem(MOTIVO_EXCLUSAO);
      sessionStorage.removeItem(VISTA_EXCLUSAO);
    } catch (err) {
      setErro(traduzir(err instanceof Error ? err.message : ""));
    } finally {
      setEnviando(false);
    }
  }

  function enviar(event: FormEvent) {
    event.preventDefault();
    if (modo === "esqueci") return;
    setErro("");
    if (modo === "criar" && nome.trim().length < 2) {
      setErro("Informe seu nome.");
      return;
    }
    if (modo === "criar") {
      const anos = idadeEm(nascimento);
      if (anos == null || anos > 120) {
        setErro("Escolha a data de nascimento.");
        return;
      }
    }
    if (senha.length < 8) {
      setErro("A senha precisa ter pelo menos 8 caracteres.");
      return;
    }
    if (modo === "criar") {
      const anos = idadeEm(nascimento) ?? 0;
      const presa = travaLocalDe(email);
      if (!liberacao && (presa || anos < 18)) {
        if (anos < 18) marcarTravaLocal(email);
        setErro(textoTrava(presa ?? Date.now() + 7 * 24 * 60 * 60 * 1000));
        void pedirCodigoCadastro({ data: { email: email.trim(), nome: nome.trim(), nascimento } }).catch((err) => {
          setErro(err instanceof Error && err.message ? err.message : textoTrava(presa ?? Date.now()));
        });
        return;
      }
      setTermos(true);
      return;
    }
    void concluir("entrar");
  }

  async function enviarCodigoCadastro() {
    setErro("");
    setAviso("");
    setEnviando(true);
    if ((idadeEm(nascimento) ?? 0) < 18) {
      marcarTravaLocal(email);
      setErro(textoTrava(travaLocalDe(email) ?? Date.now() + 7 * 24 * 60 * 60 * 1000));
      setEnviando(false);
      return;
    }
    try {
      const resultado = await pedirCodigoCadastro({ data: { email: email.trim(), nome: nome.trim(), nascimento, liberacao } });
      if (!resultado || typeof resultado !== "object" || !("enviado" in resultado) || !resultado.enviado) {
        const mensagem = resultado && typeof resultado === "object" && "mensagem" in resultado ? String(resultado.mensagem) : "";
        setErro(mensagem || "Não foi possível enviar o código.");
        return;
      }
      const esperaAte = Date.now() + 40_000;
      guardarRascunhoCadastro({ nome: nome.trim(), email: email.trim(), senha, nascimento, esperaAte, codigo: "" });
      setConfirmando(true);
      setEsperaCodigo(40);
      setAviso("Enviamos o código de confirmação para o seu e-mail.");
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Não foi possível enviar o código.");
    } finally {
      setEnviando(false);
    }
  }

  async function confirmarCadastro(event: FormEvent) {
    event.preventDefault();
    setErro("");
    setEnviando(true);
    try {
      if (!liberacao && travaLocalDe(email)) {
        setErro(textoTrava(travaLocalDe(email) ?? Date.now()));
        setEnviando(false);
        return;
      }
      const resultado = await criarContaComCodigo({
        data: { nome: nome.trim(), email: email.trim(), senha, codigo: codigoCadastro, nascimento, liberacao },
      });
      if (resultado && typeof resultado === "object" && "restrito" in resultado && resultado.restrito) {
        marcarTravaLocal(email);
        setErro("mensagem" in resultado && typeof resultado.mensagem === "string" ? resultado.mensagem : textoTrava(Date.now()));
        setEnviando(false);
        return;
      }
      limparRascunhoCadastro();
      window.location.assign("/");
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Não foi possível confirmar o e-mail.");
      setEnviando(false);
    }
  }

  const campanha = campanhaDoMes();
  const fundoTopo = corNoDegrade(campanha.faixas, 0.08);
  const fundoMeio = corNoDegrade(campanha.faixas, 0.46);
  const fundoBase = corNoDegrade(campanha.faixas, 0.92);
  const textoTopo = corTexto(fundoTopo);
  const textoMeio = corTexto(fundoMeio);
  const textoBase = corTexto(fundoBase);
  const painel = degradeCampanha(campanha.faixas);

  return (
    <main className="min-h-screen bg-[#f3eee6] lg:grid lg:grid-cols-5">
      {reverSenha && email && (
        <AvisoSenha
          email={email}
          onPronto={() => {
            concluirAcessoForcado();
            setReverSenha(false);
          }}
        />
      )}
      {termos && (
        <TermosCadastro
          onVoltar={() => setTermos(false)}
          onContinuar={() => {
            setTermos(false);
            void enviarCodigoCadastro();
          }}
        />
      )}
      {mostrarAviso && (
        <AvisoContaExcluida
          motivo={motivoAviso}
          onEntendi={() => {
            sessionStorage.setItem(VISTA_EXCLUSAO, "1");
            setMostrarAviso(false);
            setExcluida(true);
            setModo("criar");
          }}
        />
      )}
      <aside
        className="hidden min-h-screen flex-col px-8 py-8 lg:col-span-2 lg:flex xl:px-12"
        style={{ background: painel, color: textoTopo }}
      >
        <div className="flex items-center gap-3">
          <div
            className="grid size-12 place-items-center rounded-2xl"
            style={{ background: corClara(fundoTopo) ? "#1c1915" : "#f4efe4", color: corClara(fundoTopo) ? "#f6f1e6" : "#1c1915" }}
            aria-hidden
          >
            <Scale className="size-6" strokeWidth={1.75} />
          </div>
          <p className="font-painel text-2xl">Auxilia Legis</p>
        </div>
        <div className="flex flex-1 items-center" style={{ color: textoMeio }}>
          <div>
            <h1 className="font-painel text-[2.85rem] font-medium leading-[0.98] tracking-[-0.025em] xl:text-[3.7rem]">
              Assistente do
              <br />
              Poder Legislativo
            </h1>
            <ListaCampanha faixas={campanha.faixas} mes={campanha.nome} />
          </div>
        </div>
        <div className="mt-8" style={{ color: textoBase }}>
          <p className="text-center text-sm">
            <Link to="/privacidade" className="hover:underline">
              Política de Privacidade
            </Link>
            <span> · </span>
            <Link to="/termos" className="hover:underline">
              Termos de Serviço
            </Link>
          </p>
          <Link
            to="/gestao"
            className="mt-4 inline-flex h-12 w-full items-center justify-center rounded-2xl border text-sm font-medium"
            style={{ borderColor: "color-mix(in srgb, currentColor 45%, transparent)" }}
          >
            Área restrita
          </Link>
        </div>
      </aside>
      <section className="flex min-h-screen items-center justify-center px-4 py-8 lg:col-span-3">
        <div className="w-full max-w-[440px]">
          <div className="mb-6 text-ink lg:hidden">
            <div className="flex items-center gap-3">
              <div className="grid size-11 shrink-0 place-items-center rounded-2xl" style={{ background: painel, color: textoMeio }} aria-hidden>
                <Scale className="size-5" strokeWidth={1.75} />
              </div>
              <div>
                <p className="font-display text-xl">Auxilia Legis</p>
                <p className="font-painel text-sm leading-tight">Assistente do Poder Legislativo</p>
              </div>
            </div>
            <ListaCampanha faixas={campanha.faixas} mes={campanha.nome} clara />
          </div>
          <div className="rounded-[28px] bg-[#fffdf8] px-6 py-7 shadow-[0_18px_50px_rgba(28,25,21,0.06)] sm:px-8">
        {confirmando ? (
          <form className="flex flex-col gap-3" onSubmit={(event) => void confirmarCadastro(event)}>
            <h2 className="font-display text-3xl text-ink">Confirmar e-mail</h2>
            <p className="text-justify text-sm leading-relaxed text-muted">
              Digite o código enviado para {email}. Ele vale por 24 horas.
            </p>
            {aviso && <p className="rounded-xl bg-pine-soft px-3 py-2 text-justify text-sm leading-relaxed text-pine">{aviso}</p>}
            {erro && <p className="rounded-xl bg-seal-soft px-3 py-2 text-justify text-sm leading-relaxed text-seal">{erro}</p>}
            <label className="flex flex-col gap-1 text-sm font-medium text-ink">
              Código
              <input
                value={codigoCadastro}
                onChange={(event) => setCodigoCadastro(event.target.value.replace(/\D/g, "").slice(0, 6))}
                className={campo}
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="000000"
                required
              />
            </label>
            <button type="submit" disabled={enviando} className={botaoVerde}>
              {enviando ? "Confirmando…" : "Confirmar e criar conta"}
            </button>
            <button type="button" onClick={() => void enviarCodigoCadastro()} disabled={enviando || esperaCodigo > 0} className="h-11 text-sm font-medium text-pine disabled:opacity-60">
              {esperaCodigo > 0 ? `Novo código em ${esperaCodigo}s` : "Enviar outro código"}
            </button>
            <button
              type="button"
              onClick={() => {
                limparRascunhoCadastro();
                setConfirmando(false);
                setCodigoCadastro("");
                setErro("");
                setAviso("");
              }}
              className="h-11 text-sm font-medium text-muted"
            >
              Voltar
            </button>
          </form>
        ) : modo === "esqueci" ? (
          <RecuperarSenha
            emailInicial={email}
            codigoInicial={codigoLink}
            onVoltar={() => {
              setModo("entrar");
              setErro("");
            }}
            onPronto={() => {
              setModo("entrar");
              setSenha("");
              setErro("");
              setAviso("Senha atualizada. Entre com a nova senha.");
            }}
          />
        ) : (
      <form onSubmit={enviar} className="flex flex-col gap-3">
        <h2 className="font-display text-3xl text-ink">{modo === "criar" ? "Criar conta" : "Login"}</h2>
        {(excluida || modo === "criar") && (
          <p className="text-justify text-sm leading-relaxed text-muted">
            {excluida
              ? "Sua conta foi excluída e você foi desconectado. Para entrar de novo, crie outra conta."
              : "Crie a conta com e-mail e senha. O e-mail precisa ser confirmado com o código enviado."}
          </p>
        )}
        {aviso && <p className="rounded-xl bg-pine-soft px-3 py-2 text-justify text-sm leading-relaxed text-pine">{aviso}</p>}
        {erro && (
          <p role="alert" className="rounded-xl bg-seal-soft px-3 py-2 text-justify text-sm leading-relaxed text-seal">
            {erro}
          </p>
        )}
        {modo === "criar" && (
          <>
          <label className="flex flex-col gap-1 text-sm font-medium text-ink">
            Nome
            <input
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              className={campo}
              autoComplete="name"
              required
            />
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium text-ink">
            Data de nascimento
            <input
              type="date"
              value={nascimento}
              onChange={(e) => setNascimento(e.target.value)}
              className={campo}
              min={limitesNascimento().min}
              max={limitesNascimento().max}
              required
              disabled={Boolean(liberacao)}
            />
            {liberacao && <span className="text-xs font-normal text-muted">Data confirmada pelo Titular. Não pode ser alterada.</span>}
          </label>
          </>
        )}
        <label className="flex flex-col gap-1.5 text-sm font-medium text-ink">
          E-mail
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={campo}
            autoComplete="email"
            required
            disabled={Boolean(liberacao)}
          />
        </label>
        <label className="flex flex-col gap-1.5 text-sm font-medium text-ink">
          Senha
          <CampoSenha
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            className={campo}
            autoComplete={modo === "criar" ? "new-password" : "current-password"}
            minLength={8}
            required
          />
        </label>
        {modo === "entrar" && (
          <div className="flex items-center justify-between gap-3 pt-1 text-sm text-ink">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={lembrar}
                onChange={(evento) => setLembrar(evento.target.checked)}
                className="size-4 shrink-0 accent-[#1a4033]"
              />
              Lembre-se de mim
            </label>
            <button
              type="button"
              onClick={() => {
                setModo("esqueci");
                setErro("");
              }}
              className="text-ink"
            >
              Esqueci minha senha
            </button>
          </div>
        )}
        <button type="submit" disabled={enviando} className={botaoVerde}>
          {enviando ? "Aguarde…" : modo === "criar" ? "Criar conta" : "Login"}
        </button>
        <button
          type="button"
          onClick={() => {
            setModo(modo === "criar" ? "entrar" : "criar");
            setErro("");
          }}
          className="h-10 text-sm text-ink"
        >
          {modo === "criar" ? "Login" : "Criar conta"}
        </button>
        <div className="flex items-center gap-3 text-xs text-muted">
          <span className="h-px flex-1 bg-line" />
          ou
          <span className="h-px flex-1 bg-line" />
        </div>
        {GROK_PROVIDERS.map((provedor) => (
          <button
            key={provedor.providerId}
            type="button"
            onClick={() => {
              setErro("");
              void signIn(provedor.providerId, { callbackURL: "/" }).catch((falha) => {
                setErro(falha instanceof Error ? falha.message : "Não foi possível entrar.");
              });
            }}
            className="inline-flex h-12 items-center justify-center gap-2 rounded-xl border border-[#e4ddd2] bg-white text-sm font-medium text-ink"
          >
            <IconeProvedor id={provedor.idp} />
            Continuar com {provedor.label}
          </button>
        ))}
      </form>
        )}
          </div>
          <div className="mt-6 lg:hidden">
            <p className="text-center text-sm text-ink">
              <Link to="/privacidade" className="font-medium">
                Política de Privacidade
              </Link>
              <span className="text-muted"> · </span>
              <Link to="/termos" className="font-medium">
                Termos de Serviço
              </Link>
            </p>
            <Link
              to="/gestao"
              className="mt-3 inline-flex h-11 w-full items-center justify-center rounded-2xl border border-[#1a4033]/30 text-sm font-medium text-[#1a4033]"
            >
              Área restrita
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}

const campo = "h-12 w-full rounded-xl border border-transparent bg-[#f4efe6] px-3 text-sm font-normal text-ink outline-none focus:border-[#1a4033]/30";
const botaoVerde = "inline-flex h-12 items-center justify-center rounded-xl bg-[#1a4033] text-sm font-medium text-[#f7f3ea] disabled:opacity-60";

function IconeProvedor({ id }: { id: string }) {
  if (id === "google") {
    return (
      <svg viewBox="0 0 18 18" className="size-4" aria-hidden>
        <path fill="#4285F4" d="M17.6 9.2c0-.6-.1-1.2-.2-1.8H9v3.4h4.8a4.1 4.1 0 0 1-1.8 2.7v2.2h2.9c1.7-1.6 2.7-3.9 2.7-6.5z" />
        <path fill="#34A853" d="M9 18c2.4 0 4.5-.8 6-2.2l-2.9-2.2c-.8.6-1.9.9-3.1.9-2.4 0-4.4-1.6-5.1-3.8H.9v2.3A9 9 0 0 0 9 18z" />
        <path fill="#FBBC05" d="M3.9 10.7A5.4 5.4 0 0 1 3.6 9c0-.6.1-1.2.3-1.7V5H.9a9 9 0 0 0 0 8l3-2.3z" />
        <path fill="#EA4335" d="M9 3.6c1.3 0 2.5.5 3.4 1.3l2.6-2.6A9 9 0 0 0 .9 5l3 2.3C4.6 5.2 6.6 3.6 9 3.6z" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 16 16" className="size-4" aria-hidden>
      <path fill="currentColor" d="M9.3 6.8 14.7 1h-1.3L8.7 5.9 5.2 1H1l5.7 8.1L1 15h1.3l5-5.6L10.8 15H15L9.3 6.8Zm-1.8 2L2.8 2h1.5l8.9 12h-1.5l-4.2-5.2Z" />
    </svg>
  );
}

function RecuperarSenha({
  emailInicial,
  codigoInicial = "",
  onVoltar,
  onPronto,
}: {
  emailInicial: string;
  codigoInicial?: string;
  onVoltar: () => void;
  onPronto: () => void;
}) {
  const [email, setEmail] = useState(emailInicial);
  const [codigo, setCodigo] = useState(codigoInicial);
  const [senha, setSenha] = useState("");
  const [repete, setRepete] = useState("");
  const [enviado, setEnviado] = useState(codigoInicial.length === 6);
  const [erro, setErro] = useState("");
  const [aviso, setAviso] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [espera, setEspera] = useState(codigoInicial.length === 6 ? 40 : 0);

  useEffect(() => {
    if (espera <= 0) return;
    const id = window.setTimeout(() => setEspera((valor) => valor - 1), 1000);
    return () => window.clearTimeout(id);
  }, [espera]);

  async function pedir() {
    setErro("");
    setAviso("");
    setEnviando(true);
    try {
      await pedirCodigoSenha({ data: { email: email.trim() } });
      setEnviado(true);
      setEspera(40);
      setAviso("Se houver conta com este e-mail, o código foi enviado por auxilialegis@marquestecnologies.com.");
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Não foi possível enviar o código.");
    } finally {
      setEnviando(false);
    }
  }

  async function redefinir(event: FormEvent) {
    event.preventDefault();
    setErro("");
    if (!enviado) {
      await pedir();
      return;
    }
    if (senha !== repete) {
      setErro("A repetição não é igual à nova senha.");
      return;
    }
    setEnviando(true);
    try {
      await redefinirComCodigo({ data: { email: email.trim(), codigo, senha } });
      onPronto();
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Não foi possível redefinir a senha.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <form className="flex flex-col gap-3" onSubmit={(event) => void redefinir(event)}>
      <h2 className="font-display text-2xl text-ink">Esqueci minha senha</h2>
      {aviso && <p className="rounded-xl bg-pine-soft px-3 py-2 text-justify text-sm leading-relaxed text-pine">{aviso}</p>}
      {erro && <p className="rounded-xl bg-seal-soft px-3 py-2 text-justify text-sm leading-relaxed text-seal">{erro}</p>}
      <label className="flex flex-col gap-1 text-sm font-medium text-ink">
        E-mail
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={campo} autoComplete="email" required />
      </label>
      {enviado && (
        <>
          <label className="flex flex-col gap-1 text-sm font-medium text-ink">
            Código do e-mail
            <input
              value={codigo}
              onChange={(e) => setCodigo(e.target.value.replace(/\D/g, "").slice(0, 6))}
              className={campo}
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder="000000"
              required
            />
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium text-ink">
            Nova senha
            <CampoSenha value={senha} onChange={(e) => setSenha(e.target.value)} className={campo} autoComplete="new-password" minLength={8} required />
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium text-ink">
            Repetir nova senha
            <CampoSenha value={repete} onChange={(e) => setRepete(e.target.value)} className={campo} autoComplete="new-password" minLength={8} required />
          </label>
        </>
      )}
      <button type="submit" disabled={enviando} className={botaoVerde}>
        {enviando ? "Aguarde…" : enviado ? "Redefinir senha" : "Enviar código"}
      </button>
      {enviado && (
        <button type="button" onClick={() => void pedir()} disabled={enviando || espera > 0} className="h-11 text-sm font-medium text-pine disabled:opacity-60">
          {espera > 0 ? `Novo código em ${espera}s` : "Enviar outro código"}
        </button>
      )}
      <button type="button" onClick={onVoltar} className="h-11 text-sm font-medium text-pine">
        Voltar para entrar
      </button>
    </form>
  );
}

function traduzir(mensagem: string): string {
  const texto = mensagem.toLowerCase();
  if (texto.includes("already") || texto.includes("exist")) return "Já existe uma conta com este e-mail.";
  if (texto.includes("password") && (texto.includes("short") || texto.includes("8") || texto.includes("length"))) {
    return "A senha precisa ter pelo menos 8 caracteres.";
  }
  if (texto.includes("invalid email") || texto.includes("invalid password") || texto.includes("incorrect")) {
    return "E-mail ou senha incorretos.";
  }
  if (texto.includes("otp") && texto.includes("expired")) return "O código expirou. Peça outro.";
  if (texto.includes("too many") || texto.includes("attempts")) return "Muitas tentativas. Peça um código novo.";
  if (texto.includes("invalid otp") || texto.includes("otp")) return "Código incorreto.";
  if (texto.includes("configurado") || texto.includes("e-mail")) return mensagem;
  if (texto.includes("origin")) return "Não foi possível entrar neste endereço.";
  return "Não foi possível concluir. Confira os dados e tente de novo.";
}
