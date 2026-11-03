import { useEffect, useState, type FormEvent } from "react";
import { Link } from "@tanstack/react-router";
import { Scale } from "lucide-react";
import { authClient, GROK_PROVIDERS, signIn } from "@/lib/auth/client";
import { criarContaComCodigo, entrarPeloLink, pedirCodigoCadastro, pedirCodigoSenha, redefinirComCodigo } from "@/lib/auth/senha-email.functions";
import { consultarExclusao, limparAvisoExclusao } from "@/lib/gestao.functions";
import { AvisoContaExcluida } from "@/components/aviso-exclusao";
import { TermosCadastro } from "@/components/termos-cadastro";
import { CampoSenha } from "@/components/campo-senha";
import { AvisoSenha } from "@/components/aviso-senha";
import { soltarTemaDaConta } from "@/lib/preferencias";
import { concluirAcessoForcado, esquecerLembranca, guardarLembranca, lerLembranca } from "@/lib/lembrar-acesso";

type Modo = "entrar" | "criar" | "esqueci";
const AVISO_EXCLUSAO = "prazos.conta-excluida";
const MOTIVO_EXCLUSAO = "prazos.exclusao-motivo";
const VISTA_EXCLUSAO = "prazos.exclusao-vista";
const CADASTRO_PENDENTE = "prazos.cadastro-pendente";

type RascunhoCadastro = { nome: string; email: string; senha: string; esperaAte: number; codigo: string };

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

function avisoPendente() {
  return sessionStorage.getItem(AVISO_EXCLUSAO) === "1" && sessionStorage.getItem(VISTA_EXCLUSAO) !== "1";
}

export function TelaConta() {
  const rascunho = lerRascunhoCadastro();
  const [modo, setModo] = useState<Modo>(() => (rascunho ? "criar" : sessionStorage.getItem(AVISO_EXCLUSAO) === "1" ? "criar" : "entrar"));
  const [nome, setNome] = useState(rascunho?.nome ?? "");
  const [email, setEmail] = useState(rascunho?.email ?? "");
  const [senha, setSenha] = useState(rascunho?.senha ?? "");
  const [erro, setErro] = useState("");
  const [aviso, setAviso] = useState("");
  const [excluida, setExcluida] = useState(() => sessionStorage.getItem(AVISO_EXCLUSAO) === "1");
  const [mostrarAviso, setMostrarAviso] = useState(avisoPendente);
  const [motivoAviso, setMotivoAviso] = useState(() => sessionStorage.getItem(MOTIVO_EXCLUSAO) ?? "");
  const [enviando, setEnviando] = useState(false);
  const [termos, setTermos] = useState(false);
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
      esperaAte: atual?.esperaAte && atual.esperaAte > Date.now() ? atual.esperaAte : Date.now() + Math.max(esperaCodigo, 0) * 1000,
      codigo: codigoCadastro,
    });
  }, [confirmando, nome, email, senha, codigoCadastro, esperaCodigo]);

  useEffect(() => {
    soltarTemaDaConta();
    const params = new URLSearchParams(window.location.search);
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
    if (senha.length < 8) {
      setErro("A senha precisa ter pelo menos 8 caracteres.");
      return;
    }
    if (modo === "criar") {
      setTermos(true);
      return;
    }
    void concluir("entrar");
  }

  async function enviarCodigoCadastro() {
    setErro("");
    setAviso("");
    setEnviando(true);
    try {
      await pedirCodigoCadastro({ data: { email: email.trim(), nome: nome.trim() } });
      const esperaAte = Date.now() + 40_000;
      guardarRascunhoCadastro({ nome: nome.trim(), email: email.trim(), senha, esperaAte, codigo: "" });
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
      await criarContaComCodigo({
        data: { nome: nome.trim(), email: email.trim(), senha, codigo: codigoCadastro },
      });
      limparRascunhoCadastro();
      window.location.assign("/");
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Não foi possível confirmar o e-mail.");
      setEnviando(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4 py-10">
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
      <div className="flex items-center gap-3">
        <div className="grid size-11 place-items-center rounded-xl bg-pine text-sheet" aria-hidden>
          <Scale className="size-5" strokeWidth={1.75} />
        </div>
        <div>
          <h1 className="font-display text-2xl leading-tight text-ink sm:text-3xl">Assistente do Poder Legislativo</h1>
        </div>
      </div>
      <p className="mt-4 text-sm leading-relaxed text-muted">
        {confirmando
          ? "O código continua valendo nesta página. Pode abrir o e-mail e voltar para digitar."
          : excluida
          ? "Sua conta foi excluída e você foi desconectado. Para entrar de novo, crie outra conta."
          : modo === "criar"
            ? "Crie a conta com e-mail e senha. O e-mail precisa ser confirmado com o código enviado."
            : "Entre com o mesmo e-mail e senha para abrir os processos neste navegador."}
      </p>

      <div className="mt-6 rounded-2xl border border-line bg-sheet p-5">
        {confirmando ? (
          <form className="flex flex-col gap-3" onSubmit={(event) => void confirmarCadastro(event)}>
            <h2 className="font-display text-2xl text-ink">Confirmar e-mail</h2>
            <p className="text-sm text-muted">
              Digite o código enviado para {email}. Ele vale por 24 horas e sai de auxilialegis@marquestecnologies.com.
            </p>
            {aviso && <p className="rounded-xl bg-pine-soft px-3 py-2 text-sm text-pine">{aviso}</p>}
            {erro && <p className="rounded-xl bg-seal-soft px-3 py-2 text-sm text-seal">{erro}</p>}
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
            <button type="submit" disabled={enviando} className="inline-flex h-12 items-center justify-center rounded-xl bg-pine text-sm font-medium text-sheet disabled:opacity-60">
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
              className="h-11 text-sm font-medium text-pine"
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
        <h2 className="font-display text-2xl text-ink">{modo === "criar" ? "Criar conta" : "Login"}</h2>
        {aviso && <p className="rounded-xl bg-pine-soft px-3 py-2 text-sm text-pine">{aviso}</p>}
        {erro && (
          <p role="alert" className="rounded-xl bg-seal-soft px-3 py-2 text-sm text-seal">
            {erro}
          </p>
        )}
        {modo === "criar" && (
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
        )}
        <label className="flex flex-col gap-1 text-sm font-medium text-ink">
          E-mail
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={campo}
            autoComplete="email"
            required
          />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium text-ink">
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
          <>
            <label className="flex items-center gap-2 text-sm text-ink">
              <input
                type="checkbox"
                checked={lembrar}
                onChange={(evento) => setLembrar(evento.target.checked)}
                className="size-4 shrink-0"
              />
              Lembre-se de mim
            </label>
          </>
        )}
        {modo === "entrar" && (
          <button
            type="button"
            onClick={() => {
              setModo("esqueci");
              setErro("");
            }}
            className="self-start text-sm font-medium text-pine"
          >
            Esqueci minha senha
          </button>
        )}
        <button
          type="submit"
          disabled={enviando}
          className="inline-flex h-12 items-center justify-center rounded-xl bg-pine text-sm font-medium text-sheet disabled:opacity-60"
        >
          {enviando ? "Aguarde…" : modo === "criar" ? "Criar conta" : "Login"}
        </button>
        <button
          type="button"
          onClick={() => {
            setModo(modo === "criar" ? "entrar" : "criar");
            setErro("");
          }}
          className="h-11 text-sm font-medium text-pine"
        >
          {modo === "criar" ? "Login" : "Criar conta"}
        </button>
      </form>
        )}
      </div>

      <div className="mt-4 flex flex-col gap-2">
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
            className="inline-flex h-12 items-center justify-center rounded-xl border border-line bg-sheet text-sm font-medium text-ink"
          >
            Continuar com {provedor.label}
          </button>
        ))}
      </div>
      <Link to="/privacidade" className="mt-6 text-center text-sm font-medium text-pine">
        Política de Privacidade
      </Link>
      <Link
        to="/gestao"
        className="mt-2 inline-flex h-11 w-full items-center justify-center rounded-xl border border-line bg-sheet text-sm font-medium text-ink"
      >
        Área restrita
      </Link>
    </main>
  );
}

const campo = "h-11 w-full rounded-xl border border-line bg-paper px-3 text-sm font-normal text-ink";

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
      {aviso && <p className="rounded-xl bg-pine-soft px-3 py-2 text-sm text-pine">{aviso}</p>}
      {erro && <p className="rounded-xl bg-seal-soft px-3 py-2 text-sm text-seal">{erro}</p>}
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
      <button type="submit" disabled={enviando} className="inline-flex h-12 items-center justify-center rounded-xl bg-pine text-sm font-medium text-sheet disabled:opacity-60">
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
