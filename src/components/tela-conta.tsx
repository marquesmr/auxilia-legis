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
import { campanhaDoMes, corClara, corTexto, type FaixaCampanha } from "@/lib/campanha-mes";

type Modo = "entrar" | "criar" | "esqueci";

function textoDaCampanha(tema: string) {
  const assunto = tema
    .replace(/^(prevenção|combate e prevenção|combate|conscientização|incentivo)\s+(ao|à|aos|às|de|do|da|dos|das|sobre|no|na)\s+/i, "")
    .replace(/^(o|a|os|as)\s+/i, "");
  return `Mês de prevenção ao ${assunto}`.toLocaleUpperCase("pt-BR");
}

function Fita({ cor, fundo, propria }: { cor: string; fundo: string; propria: boolean }) {
  const some = !propria && corClara(cor) === corClara(fundo);
  return (
    <svg viewBox="0 0 100 195.71" className="mt-0.5 h-9 w-[1.15rem] shrink-0" aria-hidden>
      <path fill={cor} stroke={some ? corTexto(fundo) : "none"} strokeWidth={some ? 6 : 0} strokeLinejoin="round" d="M78.46 195.71C78.46 195.71 78.46 195.71 78.46 195.71C78.03 195.7 77.63 195.47 77.41 195.1C75.07 191.02 19.87 95.07 17.03 89.57C12.69 81.15 9.55 73.12 7.69 65.7C5.95 58.74 5.28 52.07 5.69 45.87C6.42 35.04 10.4 25.22 17.88 15.85C18.19 15.46 18.71 15.3 19.18 15.45C19.66 15.59 19.99 16.02 20.03 16.51C20.04 16.57 20.49 22.09 23.76 28.13C24.52 29.52 99.03 158.37 99.78 159.67C100 160.05 100 160.51 99.77 160.89L79.5 195.11C79.29 195.48 78.89 195.71 78.46 195.71ZM73.47 24.29C73.29 24.29 73.11 24.25 72.94 24.17C66.13 20.84 58.42 19.16 50 19.16C41.58 19.16 33.87 20.84 27.06 24.17C26.75 24.32 26.39 24.33 26.07 24.2C25.75 24.07 25.5 23.8 25.39 23.48C23.57 18.21 23.71 13.81 23.86 12.16C23.88 11.87 24.01 11.61 24.21 11.4C31.76 3.94 40.68 0 50 0C59.32 0 68.24 3.94 75.79 11.4C75.99 11.61 76.12 11.87 76.14 12.16C76.29 13.81 76.43 18.21 74.61 23.48C74.5 23.8 74.25 24.07 73.93 24.2C73.78 24.26 73.63 24.29 73.47 24.29ZM73.1 105.82C72.66 105.82 72.26 105.59 72.05 105.21C65.22 93.41 58.41 81.63 52.23 70.93C52.01 70.55 52.01 70.09 52.23 69.71C67.24 43.74 75.99 28.59 76.24 28.13C79.51 22.08 79.96 16.57 79.97 16.51C80.01 16.02 80.34 15.59 80.82 15.45C81.29 15.3 81.81 15.46 82.12 15.85C89.6 25.22 93.58 35.04 94.31 45.87C94.72 52.07 94.05 58.74 92.31 65.7C90.45 73.12 87.31 81.15 82.97 89.57C82.97 89.57 82.97 89.57 82.97 89.57C82.36 90.74 79.39 96.01 74.15 105.21C73.93 105.58 73.53 105.82 73.1 105.82C73.1 105.82 73.1 105.82 73.1 105.82ZM21.54 195.71C21.11 195.71 20.71 195.48 20.5 195.11L0.23 160.89C0 160.51 0 160.05 0.22 159.67C0.22 159.67 11.75 139.73 25.83 115.38C26.04 115.01 26.44 114.78 26.88 114.78C27.31 114.78 27.71 115.01 27.92 115.39C33.51 125.16 40.38 137.15 47.78 150.05C47.99 150.42 47.99 150.88 47.78 151.25C34.67 174.1 22.7 194.89 22.59 195.1C22.37 195.47 21.97 195.71 21.54 195.71C21.54 195.71 21.54 195.71 21.54 195.71Z" />
    </svg>
  );
}

function ListaCampanha({ faixas, mes, painel, clara = false }: { faixas: FaixaCampanha[]; mes: string; painel: string; clara?: boolean }) {
  const fundo = clara ? "#f3eee6" : painel;
  return (
    <ul className="mt-5 flex flex-col gap-2.5">
      {faixas.map((faixa, indice) => (
        <li key={faixa.nome} className="flex items-start gap-2 text-sm leading-snug">
          <Fita cor={faixa.cor} fundo={fundo} propria={indice > 0} />
          <span>
            <strong className="font-medium">
              {mes} {faixa.nome}
            </strong>
            <span className={`block text-[0.68rem] leading-snug uppercase ${clara ? "text-ink/75" : "opacity-90"}`}>{textoDaCampanha(faixa.tema)}</span>
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
    const bruto = localStorage.getItem(CADASTRO_PENDENTE) || sessionStorage.getItem(CADASTRO_PENDENTE);
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
  const texto = JSON.stringify(dados);
  localStorage.setItem(CADASTRO_PENDENTE, texto);
  sessionStorage.setItem(CADASTRO_PENDENTE, texto);
}

function limparRascunhoCadastro() {
  localStorage.removeItem(CADASTRO_PENDENTE);
  sessionStorage.removeItem(CADASTRO_PENDENTE);
}

const SENHA_PENDENTE = "prazos.senha-codigo";

function lerSenhaPendente(): { email: string; codigo: string; esperaAte: number } | null {
  try {
    const bruto = localStorage.getItem(SENHA_PENDENTE);
    if (!bruto) return null;
    const dados = JSON.parse(bruto) as { email?: unknown; codigo?: unknown; esperaAte?: unknown };
    if (typeof dados.email !== "string" || !dados.email.includes("@")) return null;
    return {
      email: dados.email,
      codigo: typeof dados.codigo === "string" ? dados.codigo.replace(/\D/g, "").slice(0, 6) : "",
      esperaAte: typeof dados.esperaAte === "number" ? dados.esperaAte : 0,
    };
  } catch {
    return null;
  }
}

function guardarSenhaPendente(dados: { email: string; codigo: string; esperaAte: number }) {
  localStorage.setItem(SENHA_PENDENTE, JSON.stringify(dados));
}

function limparSenhaPendente() {
  localStorage.removeItem(SENHA_PENDENTE);
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
  const senhaPendente = lerSenhaPendente();
  const [modo, setModo] = useState<Modo>(() => (rascunho ? "criar" : senhaPendente ? "esqueci" : sessionStorage.getItem(AVISO_EXCLUSAO) === "1" ? "criar" : "entrar"));
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
  const [emailConvite, setEmailConvite] = useState(false);
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
    function restaurar() {
      const atual = lerRascunhoCadastro();
      if (!atual) return;
      setModo("criar");
      setConfirmando(true);
      setNome(atual.nome);
      setEmail(atual.email);
      setSenha(atual.senha);
      setNascimento(atual.nascimento);
      setCodigoCadastro(atual.codigo);
      const falta = atual.esperaAte - Date.now();
      setEsperaCodigo(falta > 0 ? Math.ceil(falta / 1000) : 0);
    }
    function aoVoltar() {
      if (document.visibilityState === "visible") restaurar();
    }
    document.addEventListener("visibilitychange", aoVoltar);
    window.addEventListener("pageshow", restaurar);
    return () => {
      document.removeEventListener("visibilitychange", aoVoltar);
      window.removeEventListener("pageshow", restaurar);
    };
  }, []);

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
    if (params.get("convite") === "1") {
      limparRascunhoCadastro();
      setConfirmando(false);
      setModo("criar");
      const emailQ = params.get("email") ?? "";
      const nomeQ = params.get("nome") ?? "";
      if (emailQ) setEmail(emailQ);
      if (nomeQ) setNome(nomeQ);
      setEmailConvite(Boolean(emailQ));
      setAviso("Você foi convidado para uma equipe. Crie a senha para entrar.");
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
      const esperaAte = Date.now() + 40_000;
      guardarRascunhoCadastro({ nome: nome.trim(), email: email.trim(), senha, nascimento, esperaAte, codigo: codigoCadastro });
      setConfirmando(true);
      setEsperaCodigo(40);
      setAviso("Enviando o código para o seu e-mail…");
      const resultado = await pedirCodigoCadastro({ data: { email: email.trim(), nome: nome.trim(), nascimento, liberacao } });
      if (!resultado || typeof resultado !== "object" || !("enviado" in resultado) || !resultado.enviado) {
        const mensagem = resultado && typeof resultado === "object" && "mensagem" in resultado ? String(resultado.mensagem) : "";
        setErro(mensagem || "Não foi possível enviar o código.");
        setEsperaCodigo(0);
        return;
      }
      setAviso("Enviamos o código de confirmação para o seu e-mail.");
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Não foi possível enviar o código.");
      setEsperaCodigo(0);
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
  const principal = campanha.faixas[0].cor;
  const texto = corTexto(principal);

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
        style={{ background: principal, color: texto }}
      >
        <div className="flex items-center gap-3">
          <div
            className="grid size-12 place-items-center rounded-2xl"
            style={{ background: corClara(principal) ? "#1c1915" : "#f4efe4", color: corClara(principal) ? "#f6f1e6" : "#1c1915" }}
            aria-hidden
          >
            <Scale className="size-6" strokeWidth={1.75} />
          </div>
          <p className="font-painel text-2xl">Auxilia Legis</p>
        </div>
        <div className="flex flex-1 items-center">
          <div>
            <h1 className="font-painel text-[2.85rem] font-medium leading-[0.98] tracking-[-0.025em] xl:text-[3.7rem]">
              Assistente do
              <br />
              Poder Legislativo
            </h1>
            <ListaCampanha faixas={campanha.faixas} mes={campanha.nome} painel={principal} />
          </div>
        </div>
        <div className="mt-8">
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
              <div className="grid size-11 shrink-0 place-items-center rounded-2xl" style={{ background: principal, color: texto }} aria-hidden>
                <Scale className="size-5" strokeWidth={1.75} />
              </div>
              <div>
                <p className="font-display text-xl">Auxilia Legis</p>
                <p className="font-painel text-sm leading-tight">Assistente do Poder Legislativo</p>
              </div>
            </div>
            <ListaCampanha faixas={campanha.faixas} mes={campanha.nome} painel={principal} clara />
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
            emailInicial={senhaPendente?.email || email}
            codigoInicial={senhaPendente?.codigo || codigoLink}
            onVoltar={() => {
              limparSenhaPendente();
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
            disabled={Boolean(liberacao) || emailConvite}
          />
          {emailConvite && <span className="text-xs font-normal text-muted">Este é o e-mail do convite. Não pode ser alterado.</span>}
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
  const pendente = codigoInicial.length === 6 ? null : lerSenhaPendente();
  const [email, setEmail] = useState(pendente?.email || emailInicial);
  const [codigo, setCodigo] = useState(codigoInicial || pendente?.codigo || "");
  const [senha, setSenha] = useState("");
  const [repete, setRepete] = useState("");
  const [enviado, setEnviado] = useState(codigoInicial.length === 6 || Boolean(pendente));
  const [erro, setErro] = useState("");
  const [aviso, setAviso] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [espera, setEspera] = useState(() => {
    const falta = (pendente?.esperaAte ?? 0) - Date.now();
    if (falta > 0) return Math.ceil(falta / 1000);
    return codigoInicial.length === 6 ? 40 : 0;
  });

  useEffect(() => {
    if (espera <= 0) return;
    const id = window.setTimeout(() => setEspera((valor) => valor - 1), 1000);
    return () => window.clearTimeout(id);
  }, [espera]);

  useEffect(() => {
    if (!enviado) return;
    guardarSenhaPendente({
      email: email.trim(),
      codigo,
      esperaAte: Date.now() + Math.max(espera, 0) * 1000,
    });
  }, [enviado, email, codigo, espera]);

  async function pedir() {
    setErro("");
    setAviso("");
    setEnviando(true);
    try {
      const esperaAte = Date.now() + 40_000;
      guardarSenhaPendente({ email: email.trim(), codigo, esperaAte });
      setEnviado(true);
      setEspera(40);
      setAviso("Enviando o código para o seu e-mail…");
      await pedirCodigoSenha({ data: { email: email.trim() } });
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
      limparSenhaPendente();
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
