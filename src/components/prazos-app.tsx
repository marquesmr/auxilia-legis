import { Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useContext, useEffect, useMemo, useRef, useState, type DragEvent, type ReactNode } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import {
  Archive,
  Bell,
  BellOff,
  BarChart3,
  CalendarClock,
  Check,
  FileText,
  Pencil,
  Plus,
  RotateCcw,
  Search,
  Trash2,
  Users,
  X,
  Ellipsis,
} from "lucide-react";
import {
  type Andamento,
  type Processo,
  type TipoProcesso,
  TIPOS_LEI,
  TIPOS,
  type AlcanceVeto,
  type RetornoLegislativo,
  type TipoLei,
  addDaysIso,
  avisoKey,
  avisosJaEnviados,
  daysUntil,
  formatDate,
  juntarNumero,
  lerProcessosLocais,
  marcarAvisos,
  numeroComAno,
  ordenar,
  prazoLabel,
  precisaAviso,
  rotuloRetorno,
  rotuloResposta,
  separarNumero,
  todayIso,
  definirSemExpediente,
  urgencia,
  type Urgencia,
} from "@/lib/prazos";
import { CarregandoTemis } from "@/components/carregando-temis";
import { UserButton } from "@/lib/auth/gates";
import { authClient } from "@/lib/auth/client";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { apagarProcesso, listarProcessos, moverProcesso, salvarProcesso } from "@/lib/processos.functions";
import { listarAdmin } from "@/lib/admin.functions";
import { SoltarProcessoContext } from "@/components/soltar-processo";
import { adicionarNaEquipe, criarEquipe, listarEquipes, removerDaEquipe, renomearEquipe, type Equipe } from "@/lib/equipes.functions";
import { TelaConta } from "@/components/tela-conta";
import { TrocaSenhaPerfil } from "@/components/troca-senha";
import { Timbrado, TimbradoRodape } from "@/components/timbrado";
import { PainelEstatisticas } from "@/components/estatisticas";
import { intervaloPeriodo, type PeriodoRelatorio } from "@/lib/admin";
import type { ProcessoAdmin } from "@/lib/admin";
import { AdminPainel } from "@/components/admin-painel";
import { AjudaFlutuante } from "@/components/ajuda-flutuante";
import { CampoMes } from "@/components/campo-mes";
import { BotaoRelatorio } from "@/components/botao-relatorio";
import { marcarPresenca, estadoSistema, consultarExclusao, abrirGestaoPelaConta } from "@/lib/gestao.functions";
import { definirStatus, encerraStatus, nomeStatus, statusDaArea } from "@/lib/status-catalogo";
import { carregarInicio } from "@/lib/inicio.functions";
import { AvisoContaExcluida } from "@/components/aviso-exclusao";
import { signOut } from "@/lib/auth/client";
import { BotaoConfiguracoes } from "@/components/configuracoes";
import { assumirTemaDaConta, lerPreferencias } from "@/lib/preferencias";
import { entrarPeloLink } from "@/lib/auth/senha-email.functions";
import { NOME_APLICACAO } from "@/lib/nome-aplicacao";
import { registrarAcesso } from "@/lib/lembrar-acesso";
import { AvisoSenha } from "@/components/aviso-senha";

type Filtro = "abertos" | "atencao" | "vencidos" | "prazo" | "concluidos" | "todos";

type FormState = {
  numero: string;
  numeroAno: number;
  parte: string;
  assunto: string;
  tipo: TipoProcesso;
  dataLancamento: string;
  prazo: string;
  alertaDias: number;
  nota: string;
};

const FILTROS: { id: Filtro; label: string }[] = [
  { id: "abertos", label: "Abertos" },
  { id: "atencao", label: "Atenção" },
  { id: "vencidos", label: "Vencidos" },
  { id: "prazo", label: "No prazo" },
  { id: "concluidos", label: "Arquivados" },
  { id: "todos", label: "Todos" },
];

const ALERTA_OPCOES = [1, 2, 3, 5, 7, 10, 15, 30];

const ABAS_FIXAS = ["Requerimentos", "Indicações", "Projetos de Lei", "Outros"];

type OrdemCampo = "numero" | "tipo" | "prazo";
type Guia = "lista" | "estatisticas" | "relatorio";
type Area = "legislativo" | "administrativo";

function evento(texto: string, autorNome: string): Andamento {
  return { id: crypto.randomUUID(), em: new Date().toISOString(), texto, autorNome };
}

function textoMudanca(antes: Processo, form: FormState): string | null {
  const partes: string[] = [];
  if (numeroComAno(antes.numero, antes.dataLancamento) !== juntarNumero(form.numero, form.numeroAno)) partes.push("o número");
  if (antes.parte !== form.parte.trim()) partes.push("a parte");
  if (antes.assunto !== form.assunto.trim()) partes.push("o assunto");
  if (antes.tipo !== form.tipo) partes.push(`o tipo para ${form.tipo}`);
  if (antes.dataLancamento !== form.dataLancamento) partes.push("a data de lançamento");
  if (antes.prazo !== form.prazo) partes.push(`o prazo para ${formatDate(form.prazo)}`);
  if (antes.alertaDias !== form.alertaDias) partes.push("a antecedência do aviso");
  if (!partes.length) return null;
  if (partes.length === 1) return `Alterou ${partes[0]}.`;
  const ultimo = partes.pop();
  return `Alterou ${partes.join(", ")} e ${ultimo}.`;
}

function classificar(lista: Processo[], campo: OrdemCampo, dir: "asc" | "desc"): Processo[] {
  const fator = dir === "asc" ? 1 : -1;
  return [...lista].sort((a, b) => {
    const numero = numeroComAno(a.numero, a.dataLancamento).localeCompare(numeroComAno(b.numero, b.dataLancamento), "pt-BR", { numeric: true });
    const cmp =
      campo === "numero"
        ? numero
        : campo === "tipo"
          ? a.tipo.localeCompare(b.tipo, "pt-BR") || numero
          : a.prazo.localeCompare(b.prazo) || numero;
    return cmp * fator;
  });
}

function useGradeTresColunas() {
  const [tres, setTres] = useState(true);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    const aplicar = () => setTres(mq.matches);
    aplicar();
    mq.addEventListener("change", aplicar);
    return () => mq.removeEventListener("change", aplicar);
  }, []);
  return tres;
}

function emptyForm(): FormState {
  return {
    numero: "",
    numeroAno: new Date().getFullYear(),
    parte: "",
    assunto: "",
    tipo: "Requerimentos",
    dataLancamento: todayIso(),
    prazo: addDaysIso(15),
    alertaDias: 3,
    nota: "",
  };
}

function formFrom(p: Processo): FormState {
  const partes = separarNumero(p.numero, p.dataLancamento);
  return {
    numero: partes.numero,
    numeroAno: partes.ano,
    parte: p.parte,
    assunto: p.assunto,
    tipo: p.tipo,
    dataLancamento: p.dataLancamento,
    prazo: p.prazo,
    alertaDias: p.alertaDias,
    nota: "",
  };
}

const TOM: Record<Urgencia, { badge: string; bar: string; label: string }> = {
  vencido: { badge: "bg-seal-soft text-seal", bar: "bg-seal", label: "Vencido" },
  hoje: { badge: "bg-seal-soft text-seal", bar: "bg-seal", label: "Hoje" },
  proximo: { badge: "bg-brass-soft text-brass", bar: "bg-brass", label: "Vencendo" },
  ok: { badge: "bg-pine-soft text-pine", bar: "bg-pine", label: "No prazo" },
  concluido: { badge: "bg-line text-muted", bar: "bg-line", label: "Arquivado" },
};

function PranchetaGrafico({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="6" y="3.5" width="12" height="17" rx="2" />
      <path d="M9 3.5h6v2.2a1 1 0 0 1-1 1h-4a1 1 0 0 1-1-1z" />
      <path d="M9 17.5V14" />
      <path d="M12 17.5v-6" />
      <path d="M15 17.5v-3.5" />
    </svg>
  );
}

export function PrazosApp() {
  const { user, isPending } = useCurrentUserState();
  const irPara = useNavigate();
  const [ready, setReady] = useState(false);
  const [contaId, setContaId] = useState<string | null>(null);
  const [processos, setProcessos] = useState<Processo[]>([]);
  const [filtro, setFiltro] = useState<Filtro>("abertos");
  const [busca, setBusca] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Processo | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [erros, setErros] = useState<string[]>([]);
  const [andamentoId, setAndamentoId] = useState<string | null>(null);
  const [notaAndamento, setNotaAndamento] = useState("");
  const [statusAndamento, setStatusAndamento] = useState("andamento");
  const [novoPrazo, setNovoPrazo] = useState("");
  const [retorno, setRetorno] = useState<"" | RetornoLegislativo>("");
  const [vetoAlcance, setVetoAlcance] = useState<"" | AlcanceVeto>("");
  const [leiTipo, setLeiTipo] = useState<"" | TipoLei>("");
  const [leiNumero, setLeiNumero] = useState("");
  const [leiAno, setLeiAno] = useState(new Date().getFullYear());
  const [apreciacao, setApreciacao] = useState("");
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [perm, setPerm] = useState<NotificationPermission | "unsupported">("unsupported");
  const [toast, setToast] = useState("");
  const [equipes, setEquipes] = useState<Equipe[]>([]);
  const [equipeAtual, setEquipeAtual] = useState<string | null>(null);
  const [tipoAba, setTipoAba] = useState<string>("todos");
  const [abasLeg, setAbasLeg] = useState<string[]>([...TIPOS]);
  const [abasAdm, setAbasAdm] = useState<string[]>([]);
  const [adminLista, setAdminLista] = useState<ProcessoAdmin[]>([]);
  const [cargaId, setCargaId] = useState(0);
  const [ordemCampo, setOrdemCampo] = useState<OrdemCampo>("numero");
  const [ordemDir, setOrdemDir] = useState<"asc" | "desc">("asc");
  const [guia, setGuia] = useState<Guia>("lista");
  const [periodoRelatorio, setPeriodoRelatorio] = useState<PeriodoRelatorio>("mensal");
  const [ancoraRelatorio, setAncoraRelatorio] = useState(() => todayIso().slice(0, 7));
  const [situacaoRelatorio, setSituacaoRelatorio] = useState<"todos" | Filtro>("todos");
  const [relatorio, setRelatorio] = useState<{ rotulo: string; inicio: string; fim: string; itens: Processo[] } | null>(null);
  const [perfilOpen, setPerfilOpen] = useState(false);
  const [nomePerfil, setNomePerfil] = useState("");
  const [salvandoPerfil, setSalvandoPerfil] = useState(false);
  const [parte, setParte] = useState(0);
  const [area, setArea] = useState<Area>("legislativo");
  const [trava, setTrava] = useState<string | null>(null);
  const [souGestor, setSouGestor] = useState(false);
  const [excluida, setExcluida] = useState(false);
  const [motivoExclusaoId, setMotivoExclusaoId] = useState("");
  const exclusaoVista = useRef(false);
  const tresColunas = useGradeTresColunas();
  const meuNome = user?.displayName?.trim() || "Sem nome";
  const aberturaAplicada = useRef(false);
  const [pedirSenha, setPedirSenha] = useState(false);

  useEffect(() => {
    if (!user?.id) return;
    assumirTemaDaConta(user.id);
  }, [user?.id]);

  useEffect(() => {
    const email = user?.primaryEmail;
    if (!email) return;
    if (registrarAcesso(email)) setPedirSenha(true);
  }, [user?.primaryEmail]);

  useEffect(() => {
    if (!user?.id) return;
    const acesso = new URLSearchParams(window.location.search).get("acesso") ?? "";
    if (!/^[a-f0-9]{64}$/.test(acesso)) return;
    void entrarPeloLink({ data: { token: acesso } }).finally(() => window.location.replace("/"));
  }, [user?.id]);

  useEffect(() => {
    if (typeof Notification === "undefined") setPerm("unsupported");
    else setPerm(Notification.permission);
  }, []);

  useEffect(() => {
    if (!user?.id || !ready) return;
    let vivo = true;
    const ler = () => {
      void estadoSistema()
        .then((estado) => {
          if (!vivo) return;
          definirSemExpediente(estado.datas);
          setSouGestor(Boolean(estado.administrador));
          if (estado.bloqueado) setTrava("Seu acesso está bloqueado.");
          else if (estado.manutencao && !estado.administrador) setTrava("O sistema está em manutenção. Tente de novo mais tarde.");
          else setTrava(null);
        })
        .catch(() => undefined);
    };
    const id = window.setInterval(ler, 30_000);
    return () => {
      vivo = false;
      window.clearInterval(id);
    };
  }, [user?.id, ready]);

  useEffect(() => {
    if (!user?.id || !ready) return;
    let vivo = true;
    const ler = () => {
      void consultarExclusao({ data: { userId: user.id } })
        .then((estado) => {
          if (!vivo || !estado.excluida || exclusaoVista.current) return;
          sessionStorage.setItem("prazos.conta-excluida", "1");
          sessionStorage.setItem("prazos.exclusao-motivo", estado.motivo);
          setMotivoExclusaoId(estado.motivo);
          setExcluida(true);
        })
        .catch(() => undefined);
    };
    const id = window.setInterval(ler, 3000);
    return () => {
      vivo = false;
      window.clearInterval(id);
    };
  }, [user?.id, ready]);

  useEffect(() => {
    if (!user?.id) return;
    let cancelado = false;
    const usuarioId = user.id;
    if (!aberturaAplicada.current) {
      aberturaAplicada.current = true;
      const prefs = lerPreferencias(usuarioId);
      const equipeInicial = prefs.escopo === "equipe" ? prefs.equipeId : null;
      if (prefs.area !== area) setArea(prefs.area);
      if (equipeInicial !== equipeAtual) {
        setEquipeAtual(equipeInicial);
        return;
      }
    }
    const equipeId = equipeAtual;
    if (contaId !== usuarioId) {
      setReady(false);
    }
    (async () => {
      try {
        const pacote = await carregarInicio({ data: { equipeId } });
        if (cancelado) return;
        setEquipes(pacote.equipes);
        if (pacote.equipeId !== equipeId) setEquipeAtual(pacote.equipeId);
        let lista = pacote.processos;
        const marca = `prazos.importado.${usuarioId}`;
        if (!pacote.equipeId && lista.length === 0 && localStorage.getItem(marca) !== "1") {
          const locais = lerProcessosLocais();
          for (const item of locais) await salvarProcesso({ data: { ...item, equipeId: null } });
          if (locais.length) lista = await listarProcessos({ data: null });
          localStorage.setItem(marca, "1");
          if (!cancelado && locais.length) setToast("Processos deste navegador foram salvos na sua conta.");
        }
        if (cancelado) return;
        setProcessos(garantirAno(lista));
        setAdminLista(pacote.administrativos);
        setCargaId((valor) => valor + 1);
        if (pacote.abas.legislativo.length) setAbasLeg(pacote.abas.legislativo);
        setAbasAdm(pacote.abas.administrativo);
        definirStatus(pacote.status);
        definirSemExpediente(pacote.estado.datas);
        setSouGestor(Boolean(pacote.estado.administrador));
        if (pacote.estado.bloqueado) setTrava("Seu acesso está bloqueado.");
        else if (pacote.estado.manutencao && !pacote.estado.administrador) setTrava("O sistema está em manutenção. Tente de novo mais tarde.");
        else setTrava(null);
        if (pacote.exclusao.excluida && !exclusaoVista.current) {
          sessionStorage.setItem("prazos.conta-excluida", "1");
          sessionStorage.setItem("prazos.exclusao-motivo", pacote.exclusao.motivo);
          setMotivoExclusaoId(pacote.exclusao.motivo);
          setExcluida(true);
        }
        setContaId(usuarioId);
        setReady(true);
      } catch {
        if (cancelado) return;
        setProcessos([]);
        setContaId(usuarioId);
        setToast("Não foi possível carregar seus processos.");
        setReady(true);
      }
    })();
    return () => {
      cancelado = true;
    };
  }, [user?.id, equipeAtual]);

  useEffect(() => {
    if (!user?.id || !ready) return;
    const id = window.setInterval(() => {
      void listarProcessos({ data: equipeAtual })
        .then((lista) => setProcessos(garantirAno(lista)))
        .catch(() => undefined);
      void listarAdmin({ data: equipeAtual })
        .then((lista) => setAdminLista(lista))
        .catch(() => undefined);
      void listarEquipes()
        .then((minhas) => setEquipes(minhas))
        .catch(() => undefined);
    }, 30_000);
    return () => window.clearInterval(id);
  }, [user?.id, equipeAtual, ready]);

  useEffect(() => {
    if (!user?.id || !ready) return;
    const bater = () => void marcarPresenca().catch(() => undefined);
    bater();
    const id = window.setInterval(bater, 20_000);
    return () => window.clearInterval(id);
  }, [user?.id, ready]);

  const abasTipo = [
    { id: "todos", label: "Todos" },
    ...[...ABAS_FIXAS, ...abasLeg.filter((nome) => !ABAS_FIXAS.includes(nome))].map((nome) => ({ id: nome, label: nome })),
  ];
  const atencao = useMemo(
    () => ordenar(processos.filter((p) => precisaAviso(p))),
    [processos],
  );

  useEffect(() => {
    if (!ready) return;
    const n = atencao.length;
    document.title = n > 0 ? `(${n}) ${NOME_APLICACAO}` : NOME_APLICACAO;
  }, [atencao.length, ready]);

  useEffect(() => {
    if (!ready || perm !== "granted") return;

    const disparar = () => {
      if (typeof Notification === "undefined" || Notification.permission !== "granted") return;
      const enviados = new Set(avisosJaEnviados());
      const novos: string[] = [];
      let mostrados = 0;
      for (const p of ordenar(processos).filter((p) => precisaAviso(p))) {
        const key = avisoKey(p);
        if (enviados.has(key)) continue;
        novos.push(key);
        if (mostrados < 3) {
          const titulo =
            urgencia(p) === "vencido"
              ? "Prazo vencido"
              : urgencia(p) === "hoje"
                ? "Prazo vence hoje"
                : "Prazo vencendo";
          try {
            new Notification(titulo, {
              body: `${p.numero} — ${p.assunto}. ${prazoLabel(p)}.`,
              tag: p.id,
            });
            mostrados += 1;
          } catch {
            /* iframe ou permissão revogada no meio do caminho */
          }
        }
      }
      if (novos.length) marcarAvisos(novos);
    };

    disparar();
    const id = window.setInterval(disparar, 60_000);
    const aoVoltar = () => {
      if (document.visibilityState === "visible") disparar();
    };
    document.addEventListener("visibilitychange", aoVoltar);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", aoVoltar);
    };
  }, [ready, perm, processos]);

  useEffect(() => {
    if (!toast) return;
    const id = window.setTimeout(() => setToast(""), 2400);
    return () => window.clearTimeout(id);
  }, [toast]);

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    const lista = processos.filter((p) => {
      const u = urgencia(p);
      const passaFiltro =
        filtro === "todos" ||
        (filtro === "abertos" && !encerraStatus("legislativo", p.status)) ||
        (filtro === "atencao" && precisaAviso(p)) ||
        (filtro === "vencidos" && u === "vencido") ||
        (filtro === "prazo" && u === "ok") ||
        (filtro === "concluidos" && encerraStatus("legislativo", p.status));
      const passaTipo = tipoAba === "todos" || p.tipo === tipoAba;
      if (!passaFiltro || !passaTipo) return false;
      if (!q) return true;
      return [p.numero, p.parte, p.assunto, p.tipo, p.autorNome].join(" ").toLowerCase().includes(q);
    });
    return classificar(lista, ordemCampo, ordemDir);
  }, [processos, filtro, busca, tipoAba, ordemCampo, ordemDir]);

  const porParte = (tresColunas ? 3 : 1) * 5;
  const totalPartes = Math.max(1, Math.ceil(filtrados.length / porParte));
  const parteAtual = Math.min(parte, totalPartes - 1);
  const daParte = filtrados.slice(parteAtual * porParte, parteAtual * porParte + porParte);

  useEffect(() => {
    setParte(0);
  }, [filtro, busca, tipoAba, ordemCampo, ordemDir, equipeAtual, tresColunas]);

  const contagem = useMemo(() => {
    let vencidos = 0;
    let hoje = 0;
    let proximos = 0;
    let abertos = 0;
    for (const p of processos) {
      const u = urgencia(p);
      if (!encerraStatus("legislativo", p.status)) abertos += 1;
      if (u === "vencido") vencidos += 1;
      if (u === "hoje") hoje += 1;
      if (u === "proximo") proximos += 1;
    }
    return { vencidos, hoje, proximos, abertos };
  }, [processos]);

  function abrirNovo() {
    setEditing(null);
    setForm(emptyForm());
    setErros([]);
    setFormOpen(true);
  }

  function abrirEdicao(p: Processo) {
    setEditing(p);
    setForm(formFrom(p));
    setErros([]);
    setFormOpen(true);
  }

  function validar(f: FormState): string[] {
    const lista: string[] = [];
    if (!f.numero.trim()) lista.push("Informe o número do processo.");
    if (!/^\d{4}$/.test(String(f.numeroAno))) lista.push("Informe o ano do processo.");
    if (!f.parte.trim()) lista.push("Informe a parte ou o cliente.");
    if (!f.assunto.trim()) lista.push("Informe o assunto.");
    if (!f.dataLancamento) lista.push("Informe a data de lançamento.");
    if (!f.prazo) lista.push("Informe o prazo de resposta ou andamento.");
    return lista;
  }

  async function persistir(proximo: Processo[], salvo: Processo | null, apagado: string | null, ok: string) {
    const anterior = processos;
    setProcessos(proximo);
    try {
      if (apagado) await apagarProcesso({ data: apagado });
      if (salvo) await salvarProcesso({ data: salvo });
      setToast(ok);
      return true;
    } catch {
      setProcessos(anterior);
      setToast("Não foi possível salvar. Tente de novo.");
      return false;
    }
  }

  async function salvarForm() {
    const problemas = validar(form);
    setErros(problemas);
    if (problemas.length) return;

    const nota = form.nota.trim();
    if (editing) {
      const mudou = textoMudanca(editing, form);
      const extra: Andamento[] = [];
      if (mudou) extra.push(evento(mudou, meuNome));
      if (nota) extra.push(evento(nota, meuNome));
      const atualizado: Processo = {
        ...editing,
        numero: juntarNumero(form.numero, form.numeroAno),
        parte: form.parte.trim(),
        assunto: form.assunto.trim(),
        tipo: form.tipo,
        dataLancamento: form.dataLancamento,
        prazo: form.prazo,
        alertaDias: form.alertaDias,
        historico: [...editing.historico, ...extra],
      };
      const ok = await persistir(
        processos.map((p) => (p.id === atualizado.id ? atualizado : p)),
        atualizado,
        null,
        "Processo atualizado",
      );
      if (ok) setFormOpen(false);
      return;
    }

    const criado: Processo = {
      id: crypto.randomUUID(),
      numero: juntarNumero(form.numero, form.numeroAno),
      parte: form.parte.trim(),
      assunto: form.assunto.trim(),
      tipo: form.tipo,
      dataLancamento: form.dataLancamento,
      prazo: form.prazo,
      alertaDias: form.alertaDias,
      status: "andamento",
      historico: nota
        ? [evento("Lançou o processo.", meuNome), evento(nota, meuNome)]
        : [evento("Lançou o processo.", meuNome)],
      equipeId: equipeAtual,
      autorId: user?.id ?? null,
      autorNome: meuNome,
      retorno: null,
      vetoAlcance: null,
      leiTipo: null,
      leiNumero: null,
      leiAno: null,
      apreciacaoPrazo: null,
    };
    const ok = await persistir([criado, ...processos], criado, null, "Processo lançado");
    if (ok) setFormOpen(false);
  }

  async function registrarAndamento() {
    if (!andamentoId) return;
    const texto = notaAndamento.trim();
    const atual = processos.find((p) => p.id === andamentoId);
    if (!atual) return;
    if (!texto && !retorno && statusAndamento === atual.status) return;
    const numero = Number(leiNumero);
    if (retorno === "veto") {
      if (vetoAlcance !== "integral" && vetoAlcance !== "parcial") {
        setToast("Informe se o veto é integral ou parcial.");
        return;
      }
      if (!Number.isInteger(numero) || numero < 1 || !apreciacao) {
        setToast("Informe o número, o ano e o prazo de apreciação do veto.");
        return;
      }
    }
    if (retorno === "sancionada") {
      if (!leiTipo || !Number.isInteger(numero) || numero < 1) {
        setToast("Informe o tipo, o número e o ano da lei.");
        return;
      }
    }
    const peca = retorno ? `${String(numero).padStart(2, "0")}/${leiAno}` : "";
    const mudouStatus = statusAndamento !== atual.status;
    const resumoBase = !retorno
      ? texto
      : retorno === "sancionada"
        ? `Retornou como sancionada · ${leiTipo} ${peca}${texto ? `. ${texto}` : ""}`
        : `Retornou como veto ${vetoAlcance} · ${peca}. Apreciação até ${formatDate(apreciacao)}${texto ? `. ${texto}` : ""}`;
    const resumo = [mudouStatus ? `Status alterado para ${nomeStatus("legislativo", statusAndamento)}.` : "", resumoBase].filter(Boolean).join(" ");
    const atualizado: Processo = {
      ...atual,
      status: statusAndamento,
      prazo: retorno === "veto" ? apreciacao : novoPrazo || atual.prazo,
      retorno: retorno || null,
      vetoAlcance: retorno === "veto" ? (vetoAlcance as AlcanceVeto) : null,
      leiTipo: retorno === "sancionada" ? (leiTipo as TipoLei) : null,
      leiNumero: retorno ? numero : null,
      leiAno: retorno ? leiAno : null,
      apreciacaoPrazo: retorno === "veto" ? apreciacao : null,
      historico: [...atual.historico, evento(resumo, meuNome)],
    };
    const ok = await persistir(
      processos.map((p) => (p.id === atualizado.id ? atualizado : p)),
      atualizado,
      null,
      "Andamento registrado",
    );
    if (!ok) return;
    setAndamentoId(null);
    setNotaAndamento("");
    setStatusAndamento("andamento");
    setNovoPrazo("");
  }

  function concluir(id: string) {
    const atual = processos.find((p) => p.id === id);
    if (!atual) return;
    const atualizado: Processo = {
      ...atual,
      status: "concluido",
      historico: [
        ...atual.historico,
        { id: crypto.randomUUID(), em: new Date().toISOString(), texto: "Marcou como concluído.", autorNome: meuNome },
      ],
    };
    void persistir(
      processos.map((p) => (p.id === id ? atualizado : p)),
      atualizado,
      null,
      "Enviado para Arquivados",
    ).then((ok) => {
      if (ok) {
        setGuia("lista");
        setFiltro("concluidos");
      }
    });
  }

  function reabrir(id: string) {
    const atual = processos.find((p) => p.id === id);
    if (!atual) return;
    const atualizado: Processo = {
      ...atual,
      status: "andamento",
      historico: [
        ...atual.historico,
        { id: crypto.randomUUID(), em: new Date().toISOString(), texto: "Reabriu o processo.", autorNome: meuNome },
      ],
    };
    void persistir(
      processos.map((p) => (p.id === id ? atualizado : p)),
      atualizado,
      null,
      "Processo reaberto",
    );
  }

  function excluir() {
    if (!deleteId) return;
    const id = deleteId;
    setDeleteId(null);
    void persistir(
      processos.filter((p) => p.id !== id),
      null,
      id,
      "Processo excluído",
    );
  }

  const equipeSelecionada = equipes.find((equipe) => equipe.id === equipeAtual) ?? null;

  const moverLegislativo = useCallback(
    async (id: string, equipeId: string | null) => {
      const atual = processos.find((item) => item.id === id);
      if (!atual || (atual.equipeId ?? null) === equipeId) return;
      try {
        await moverProcesso({ data: { id, equipeId } });
        setProcessos(await listarProcessos({ data: equipeAtual }));
        setToast(equipeId ? "Processo movido para a equipe." : "Processo movido para os seus.");
      } catch (err) {
        setToast(err instanceof Error ? err.message : "Não foi possível mover.");
      }
    },
    [equipeAtual, processos],
  );

  async function criarNovaEquipe(nome: string) {
    try {
      const criada = await criarEquipe({ data: nome });
      setEquipeAtual(criada.id);
      setToast(`Equipe ${criada.nome} criada`);
    } catch (err) {
      setToast(err instanceof Error ? err.message : "Não foi possível criar a equipe.");
    }
  }

  async function mudarNomeEquipe(equipeId: string, nome: string) {
    try {
      await renomearEquipe({ data: { equipeId, nome } });
      setEquipes(await listarEquipes());
      setToast("Nome da equipe atualizado");
    } catch (err) {
      setToast(err instanceof Error ? err.message : "Não foi possível mudar o nome.");
    }
  }

  async function incluirNaEquipe(email: string) {
    if (!equipeAtual) return;
    try {
      const resultado = await adicionarNaEquipe({ data: { equipeId: equipeAtual, email } });
      setEquipes(await listarEquipes());
      setToast(
        resultado.entrou
          ? `${resultado.nome} agora vê os processos desta equipe.`
          : "Convite guardado. A pessoa entra quando criar a conta com este e-mail.",
      );
    } catch (err) {
      setToast(err instanceof Error ? err.message : "Não foi possível adicionar.");
    }
  }

  async function tirarDaEquipe(email: string) {
    if (!equipeAtual) return;
    try {
      await removerDaEquipe({ data: { equipeId: equipeAtual, email } });
      const minhas = await listarEquipes();
      setEquipes(minhas);
      if (!minhas.some((equipe) => equipe.id === equipeAtual)) setEquipeAtual(null);
      setToast("Equipe atualizada");
    } catch (err) {
      setToast(err instanceof Error ? err.message : "Não foi possível atualizar a equipe.");
    }
  }

  async function salvarPerfil() {
    const nome = nomePerfil.trim();
    if (nome.length < 2) {
      setToast("Informe seu nome.");
      return;
    }
    setSalvandoPerfil(true);
    try {
      const resposta = await authClient.updateUser({ name: nome });
      if (resposta.error) {
        setToast("Não foi possível atualizar o perfil.");
        return;
      }
      setPerfilOpen(false);
      setToast("Perfil atualizado");
    } catch {
      setToast("Não foi possível atualizar o perfil.");
    } finally {
      setSalvandoPerfil(false);
    }
  }

  async function ativarAvisos() {
    if (typeof Notification === "undefined") {
      setPerm("unsupported");
      return;
    }
    try {
      const resultado = await Notification.requestPermission();
      setPerm(resultado);
      if (resultado === "granted") setToast("Avisos do navegador ativados");
    } catch {
      setPerm("denied");
    }
  }

  if (isPending) return <CarregandoTemis />;

  if (trava) {
    return (
      <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6">
        <p className="font-display text-3xl text-ink">Auxilia Legis</p>
        <p className="mt-2 text-sm text-muted">{trava}</p>
        <Link to="/gestao" className="mt-6 text-sm font-medium text-pine">
          Área restrita
        </Link>
      </main>
    );
  }

  if (excluida) {
    return (
      <AvisoContaExcluida
        motivo={motivoExclusaoId}
        onEntendi={() => {
          exclusaoVista.current = true;
          sessionStorage.setItem("prazos.exclusao-vista", "1");
          void signOut().finally(() => setExcluida(false));
        }}
      />
    );
  }

  if (!user) return <TelaConta />;

  if (pedirSenha && user.primaryEmail) {
    return <AvisoSenha email={user.primaryEmail} onPronto={() => setPedirSenha(false)} />;
  }

  if (!ready || contaId !== user.id) return <CarregandoTemis />;

  return (
    <div className="mx-auto min-h-screen max-w-6xl px-4 py-6 md:px-8 md:py-8">
      <header className="flex flex-col gap-4 border-b border-line pb-6 md:flex-row md:items-center md:justify-between">
        <h1 className="font-display text-2xl leading-tight text-ink sm:text-3xl">Assistente do Poder Legislativo</h1>
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
          <UserButton />
          <div className="flex items-center gap-2">
            <BotaoConfiguracoes equipes={equipes} userId={user.id} />
            {souGestor && (
            <button
              type="button"
              onClick={() => {
                void abrirGestaoPelaConta()
                  .then((resultado) => sessionStorage.setItem("gestao.token", resultado.token))
                  .catch(() => undefined)
                  .finally(() => void irPara({ to: "/gestao" }));
              }}
              className="inline-flex h-11 flex-1 items-center justify-center rounded-xl border border-line bg-sheet px-4 text-sm font-medium text-ink sm:flex-none"
            >
              Área restrita
            </button>
            )}
            <button
              type="button"
              onClick={() => {
                setNomePerfil(user.displayName ?? "");
                setPerfilOpen(true);
              }}
              className="inline-flex h-11 flex-1 items-center justify-center rounded-xl border border-line bg-sheet px-4 text-sm font-medium text-ink sm:flex-none"
            >
              Perfil
            </button>
          </div>
          {area !== "administrativo" && (
          <button
            type="button"
            onClick={abrirNovo}
            className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-pine px-4 text-sm font-medium text-sheet sm:w-auto"
          >
            <Plus className="size-4" />
            Novo processo
          </button>
          )}
        </div>
      </header>

      <div className="mt-6 grid grid-cols-1 gap-2 sm:grid-cols-2" role="tablist" aria-label="Área">
        <button
          type="button"
          role="tab"
          aria-selected={area === "legislativo"}
          onClick={() => setArea("legislativo")}
          className={
            "inline-flex min-h-12 items-center justify-center rounded-xl px-4 py-2 text-sm font-medium " +
            (area === "legislativo" ? "bg-pine text-sheet" : "border border-line bg-sheet text-ink")
          }
        >
          Processos Legislativos
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={area === "administrativo"}
          onClick={() => setArea("administrativo")}
          className={
            "inline-flex min-h-12 items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-medium " +
            (area === "administrativo" ? "bg-pine text-sheet" : "border border-line bg-sheet text-ink")
          }
        >
          <PranchetaGrafico className="size-5 shrink-0" />
          Controle e Estatística de Processos Administrativo
        </button>
      </div>

      {area === "administrativo" ? (
        <AdminPainel
          equipeAtual={equipeAtual}
          equipes={equipes}
          meuNome={meuNome}
          sinalNovo={0}
          onToast={setToast}
          processosIniciais={adminLista}
          cargaId={cargaId}
          abasIniciais={abasAdm}
        >
          <PainelEquipe
            equipes={equipes}
            atual={equipeAtual}
            meuEmail={user.primaryEmail ?? ""}
            onEscolher={setEquipeAtual}
            onCriar={criarNovaEquipe}
            onAdicionar={incluirNaEquipe}
            onRemover={tirarDaEquipe}
            onRenomear={mudarNomeEquipe}
          />
          <CaixaAvisos perm={perm} onAtivar={ativarAvisos} />
        </AdminPainel>
      ) : (
      <SoltarProcessoContext.Provider value={moverLegislativo}>
      <div className="mt-4 grid gap-6 md:grid-cols-[16rem_1fr]">
        <aside className="flex flex-col gap-4 md:sticky md:top-6 md:self-start">
          <div className="grid grid-cols-2 gap-2">
            <Resumo valor={contagem.vencidos} rotulo="Vencidos" tom="seal" />
            <Resumo valor={contagem.hoje} rotulo="Vencem hoje" tom="seal" />
            <Resumo valor={contagem.proximos} rotulo="Vencendo" tom="brass" />
            <Resumo valor={contagem.abertos} rotulo="Em aberto" tom="pine" />
          </div>

          <PainelEquipe
            equipes={equipes}
            atual={equipeAtual}
            meuEmail={user.primaryEmail ?? ""}
            onEscolher={setEquipeAtual}
            onCriar={criarNovaEquipe}
            onAdicionar={incluirNaEquipe}
            onRemover={tirarDaEquipe}
            onRenomear={mudarNomeEquipe}
          />

          <div className="rounded-2xl border border-line bg-sheet p-4">
            <div className="flex items-center gap-2 text-sm font-medium text-ink">
              <Bell className="size-4 text-pine" />
              Avisos
            </div>
            <TextoAvisos perm={perm} onAtivar={ativarAvisos} />
          </div>
        </aside>

        <section className="min-w-0">
          <div className="mb-4 flex gap-2">
            <button
              type="button"
              onClick={() => setGuia("lista")}
              className={
                "inline-flex h-11 items-center rounded-xl px-4 text-sm font-medium " +
                (guia === "lista" ? "bg-ink text-sheet" : "border border-line bg-sheet text-ink")
              }
            >
              Lista
            </button>
            <button
              type="button"
              onClick={() => setGuia("estatisticas")}
              className={
                "inline-flex h-11 items-center gap-2 rounded-xl px-4 text-sm font-medium " +
                (guia === "estatisticas" ? "bg-ink text-sheet" : "border border-line bg-sheet text-ink")
              }
            >
              <BarChart3 className="size-4" />
              Estatísticas
            </button>
            <button
              type="button"
              onClick={() => setGuia("relatorio")}
              className={
                "inline-flex h-11 items-center gap-2 rounded-xl px-4 text-sm font-medium " +
                (guia === "relatorio" ? "bg-ink text-sheet" : "border border-line bg-sheet text-ink")
              }
            >
              <FileText className="size-4" />
              Relatório
            </button>
          </div>

          {guia === "estatisticas" ? (
            <PainelEstatisticas processos={processos} />
          ) : guia === "relatorio" ? (
            <RelatorioLegislativo
              periodo={periodoRelatorio}
              ancora={ancoraRelatorio}
              situacao={situacaoRelatorio}
              relatorio={relatorio}
              onPeriodo={setPeriodoRelatorio}
              onAncora={setAncoraRelatorio}
              onSituacao={setSituacaoRelatorio}
              onGerar={() => {
                const intervalo = intervaloPeriodo(ancoraRelatorio, periodoRelatorio);
                if (!intervalo) {
                  setToast("Escolha um mês de referência.");
                  return;
                }
                const itens = processos
                  .filter((item) => item.dataLancamento <= intervalo.fim && item.prazo >= intervalo.inicio)
                  .filter((item) => passaSituacao(item, situacaoRelatorio))
                  .sort((a, b) =>
                    numeroComAno(a.numero, a.dataLancamento).localeCompare(numeroComAno(b.numero, b.dataLancamento), "pt-BR", { numeric: true }),
                  );
                setRelatorio({ ...intervalo, itens });
              }}
            />
          ) : (
            <>
              {atencao.length > 0 && (
                <div role="status" aria-live="polite" className="mb-4 rounded-2xl border border-line bg-sheet p-4">
                  <p className="text-sm font-medium text-ink">
                    {atencao.length === 1
                      ? "1 prazo precisa de atenção"
                      : `${atencao.length} prazos precisam de atenção`}
                  </p>
                  {equipeSelecionada && (
                    <p className="mt-1 text-sm text-muted">
                      A equipe {equipeSelecionada.nome} acompanha estes prazos junta — {equipeSelecionada.membros.length}{" "}
                      {equipeSelecionada.membros.length === 1 ? "pessoa" : "pessoas"}.
                    </p>
                  )}
                  <ul className="mt-3 flex flex-col gap-2">
                    {atencao.slice(0, 4).map((p) => {
                      const u = urgencia(p);
                      return (
                        <li key={p.id} className="flex items-start gap-3 text-sm">
                          <span className={`mt-0.5 h-2.5 w-2.5 shrink-0 rounded-full ${TOM[u].bar}`} />
                          <span className="min-w-0">
                            <span className="font-medium text-ink">{numeroComAno(p.numero, p.dataLancamento)}</span>
                            <span className="text-pine"> · {p.tipo}</span>
                            <span className="block text-ink">{p.parte}</span>
                            <span className="text-muted"> · {p.assunto}</span>
                            <span className="block text-muted">
                              {prazoLabel(p)} · {formatDate(p.prazo)}
                            </span>
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}

              <div className="flex flex-col gap-3">
                <label className="relative block">
                  <span className="sr-only">Buscar processo</span>
                  <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" />
                  <input
                    value={busca}
                    onChange={(e) => setBusca(e.target.value)}
                    placeholder="Buscar número, parte ou assunto"
                    className="h-12 w-full rounded-xl border border-line bg-sheet pr-3 pl-10 text-sm text-ink placeholder:text-muted"
                  />
                </label>
                <div className="flex gap-2 overflow-x-auto pb-1" role="tablist" aria-label="Tipo de processo">
                  {abasTipo.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      role="tab"
                      aria-selected={tipoAba === item.id}
                      onClick={() => setTipoAba(item.id)}
                      className={
                        "h-10 shrink-0 rounded-full px-3 text-sm font-medium " +
                        (tipoAba === item.id ? "bg-pine text-sheet" : "border border-line bg-sheet text-ink")
                      }
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {FILTROS.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setFiltro(item.id)}
                      className={
                        "inline-flex h-10 shrink-0 items-center gap-1.5 rounded-full px-3 text-sm font-medium " +
                        (filtro === item.id ? "bg-ink text-sheet" : "border border-line bg-sheet text-ink")
                      }
                    >
                      {item.id === "concluidos" && <Archive className="size-3.5" />}
                      {item.label}
                      {item.id === "concluidos" ? ` (${processos.filter((p) => encerraStatus("legislativo", p.status)).length})` : ""}
                    </button>
                  ))}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <label className="flex items-center gap-2 text-sm text-muted">
                    Ordenar
                    <select
                      value={ordemCampo}
                      onChange={(e) => setOrdemCampo(e.target.value as OrdemCampo)}
                      className="h-10 rounded-full border border-line bg-sheet px-3 text-sm text-ink"
                    >
                      <option value="numero">Número</option>
                      <option value="tipo">Tipo</option>
                      <option value="prazo">Prazo</option>
                    </select>
                  </label>
                  <button
                    type="button"
                    onClick={() => setOrdemDir((dir) => (dir === "asc" ? "desc" : "asc"))}
                    className="h-10 rounded-full border border-line bg-sheet px-3 text-sm font-medium text-ink"
                  >
                    {ordemDir === "asc" ? "Crescente" : "Decrescente"}
                  </button>
                </div>
              </div>

          {filtrados.length === 0 ? (
            <div className="mt-6 rounded-2xl border border-dashed border-line bg-sheet px-6 py-12 text-center">
              <p className="font-display text-2xl text-ink">Nenhum processo aqui</p>
              <p className="mx-auto mt-2 max-w-sm text-sm text-muted">
                {processos.length === 0
                  ? equipeSelecionada
                    ? "Nenhum processo nesta equipe. Lance um para todos acompanharem o prazo."
                    : "Lance o primeiro processo com a data e o prazo de resposta."
                  : filtro === "concluidos"
                    ? "A pasta Arquivados está vazia. Ao concluir um processo, ele vem para cá."
                    : "Nada corresponde a este filtro ou à busca."}
              </p>
              {processos.length === 0 && (
                <button
                  type="button"
                  onClick={abrirNovo}
                  className="mt-4 inline-flex h-11 items-center gap-2 rounded-xl bg-pine px-4 text-sm font-medium text-sheet"
                >
                  <Plus className="size-4" />
                  Lançar processo
                </button>
              )}
            </div>
          ) : (
            <ul className={"mt-4 grid gap-3 " + (tresColunas ? "grid-cols-3" : "grid-cols-1")}>
              {daParte.map((p) => (
                <ProcessoCard
                  key={p.id}
                  processo={p}
                  equipes={equipes}
                  onMover={moverLegislativo}
                  onEditar={() => abrirEdicao(p)}
                  onAndamento={() => {
                    setAndamentoId(p.id);
                    setStatusAndamento(p.status);
                    setNotaAndamento("");
                    setNovoPrazo("");
                    setRetorno(p.retorno ?? "");
                    setVetoAlcance(p.vetoAlcance ?? "");
                    setLeiTipo(p.leiTipo ?? "");
                    setLeiNumero(p.leiNumero != null ? String(p.leiNumero) : "");
                    setLeiAno(p.leiAno ?? new Date().getFullYear());
                    setApreciacao(p.apreciacaoPrazo ?? "");
                  }}
                  onConcluir={() => concluir(p.id)}
                  onReabrir={() => reabrir(p.id)}
                  onExcluir={() => setDeleteId(p.id)}
                />
              ))}
            </ul>
          )}
          {filtrados.length > porParte && (
            <nav className="mt-4 flex flex-col items-center gap-3" aria-label="Páginas da lista">
              <p className="text-sm text-muted">
                {parteAtual + 1} de {totalPartes}
                <span className="text-muted"> · {filtrados.length} processos</span>
              </p>
              <div className="flex max-w-full gap-2 overflow-x-auto pb-1">
                {Array.from({ length: totalPartes }, (_, indice) => (
                  <button
                    key={indice}
                    type="button"
                    onClick={() => setParte(indice)}
                    aria-current={indice === parteAtual ? "page" : undefined}
                    className={
                      "grid size-10 shrink-0 place-items-center rounded-full text-sm font-medium " +
                      (indice === parteAtual ? "bg-ink text-sheet" : "border border-line bg-sheet text-ink")
                    }
                  >
                    {indice + 1}
                  </button>
                ))}
              </div>
            </nav>
          )}
            </>
          )}
        </section>
      </div>
      </SoltarProcessoContext.Provider>
      )}

      <Dialog.Root open={formOpen} onOpenChange={setFormOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-ink/40" />
          <Dialog.Content className="fixed inset-x-3 top-4 bottom-4 z-10 flex flex-col overflow-hidden rounded-2xl border border-line bg-sheet md:inset-auto md:top-1/2 md:left-1/2 md:max-h-[90vh] md:w-full md:max-w-lg md:-translate-x-1/2 md:-translate-y-1/2">
            <div className="flex items-start justify-between gap-3 border-b border-line px-5 py-4">
              <div>
                <Dialog.Title className="font-display text-2xl text-ink">
                  {editing ? "Editar processo" : "Lançar processo"}
                </Dialog.Title>
                <Dialog.Description className="mt-1 text-sm text-muted">
                  Data do lançamento e prazo de resposta ou andamento.
                </Dialog.Description>
              </div>
              <Dialog.Close className="grid size-10 place-items-center rounded-lg text-muted" aria-label="Fechar">
                <X className="size-4" />
              </Dialog.Close>
            </div>
            <form
              className="flex min-h-0 flex-1 flex-col"
              onSubmit={(e) => {
                e.preventDefault();
                salvarForm();
              }}
            >
              <div className="flex flex-col gap-3 overflow-y-auto px-5 py-4">
                {erros.length > 0 && (
                  <ul className="rounded-xl bg-seal-soft px-3 py-2 text-sm text-seal">
                    {erros.map((erro) => (
                      <li key={erro}>{erro}</li>
                    ))}
                  </ul>
                )}
                <Campo label="Número do processo">
                  <div className="grid grid-cols-[1fr_auto_7rem] items-center gap-2">
                    <input
                      value={form.numero}
                      onChange={(e) => {
                        const bruto = e.target.value;
                        const corte = /^(.*)\/(\d{1,4})$/.exec(bruto);
                        if (corte) {
                          setForm({ ...form, numero: corte[1], numeroAno: Number(corte[2]) });
                          return;
                        }
                        setForm({ ...form, numero: bruto.replace(/\/+$/, "") });
                      }}
                      className={inputCls}
                      placeholder="198"
                      inputMode="numeric"
                      required
                    />
                    <span className="text-lg text-muted" aria-hidden>
                      /
                    </span>
                    <input
                      value={form.numeroAno || ""}
                      onChange={(e) => {
                        const digitos = e.target.value.replace(/\D/g, "").slice(0, 4);
                        setForm({ ...form, numeroAno: digitos ? Number(digitos) : 0 });
                      }}
                      className={inputCls}
                      placeholder="2026"
                      inputMode="numeric"
                      aria-label="Ano do processo"
                      required
                    />
                  </div>
                </Campo>
                <Campo label="Parte ou cliente">
                  <input
                    value={form.parte}
                    onChange={(e) => setForm({ ...form, parte: e.target.value })}
                    className={inputCls}
                    placeholder="Nome da parte"
                    required
                  />
                </Campo>
                <Campo label="Assunto">
                  <input
                    value={form.assunto}
                    onChange={(e) => setForm({ ...form, assunto: e.target.value })}
                    className={inputCls}
                    placeholder="O que precisa de resposta"
                    required
                  />
                </Campo>
                <Campo label="Tipo">
                  <select
                    value={form.tipo}
                    onChange={(e) => setForm({ ...form, tipo: e.target.value as TipoProcesso })}
                    className={inputCls}
                  >
                    {abasTipo.filter((item) => item.id !== "todos").map((tipo) => (
                      <option key={tipo.id}>{tipo.label}</option>
                    ))}
                  </select>
                </Campo>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <Campo label="Data de lançamento">
                    <input
                      type="date"
                      value={form.dataLancamento}
                      onChange={(e) => setForm({ ...form, dataLancamento: e.target.value })}
                      className={inputCls}
                      required
                    />
                  </Campo>
                  <Campo label="Prazo de resposta">
                    <input
                      type="date"
                      value={form.prazo}
                      onChange={(e) => setForm({ ...form, prazo: e.target.value })}
                      className={inputCls}
                      required
                    />
                  </Campo>
                </div>
                <Campo label="Avisar com antecedência">
                  <select
                    value={form.alertaDias}
                    onChange={(e) => setForm({ ...form, alertaDias: Number(e.target.value) })}
                    className={inputCls}
                  >
                    {ALERTA_OPCOES.map((n) => (
                      <option key={n} value={n}>
                        {n === 1 ? "1 dia antes" : `${n} dias antes`}
                      </option>
                    ))}
                  </select>
                </Campo>
                <Campo label={editing ? "Nota (opcional)" : "Andamento inicial (opcional)"}>
                  <textarea
                    value={form.nota}
                    onChange={(e) => setForm({ ...form, nota: e.target.value })}
                    className={`${inputCls} min-h-20 py-2`}
                    placeholder="O que já foi feito"
                  />
                </Campo>
              </div>
              <div className="flex gap-2 border-t border-line px-5 py-4">
                <Dialog.Close
                  type="button"
                  className="inline-flex h-11 flex-1 items-center justify-center rounded-xl border border-line text-sm font-medium text-ink"
                >
                  Cancelar
                </Dialog.Close>
                <button
                  type="submit"
                  className="inline-flex h-11 flex-1 items-center justify-center rounded-xl bg-pine text-sm font-medium text-sheet"
                >
                  Salvar
                </button>
              </div>
            </form>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      <Dialog.Root open={andamentoId !== null} onOpenChange={(open) => !open && setAndamentoId(null)}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-ink/40" />
          <Dialog.Content className="fixed inset-x-3 top-1/2 z-10 -translate-y-1/2 rounded-2xl border border-line bg-sheet p-5 md:left-1/2 md:w-full md:max-w-md md:-translate-x-1/2">
            <Dialog.Title className="font-display text-2xl text-ink">Registrar andamento</Dialog.Title>
            <Dialog.Description className="mt-1 text-sm text-muted">
              Anote o que foi feito. Se o prazo mudou, informe a nova data.
            </Dialog.Description>
            <form
              className="mt-4 flex flex-col gap-3"
              onSubmit={(e) => {
                e.preventDefault();
                registrarAndamento();
              }}
            >
              <Campo label="Status">
                <select value={statusAndamento} onChange={(e) => setStatusAndamento(e.target.value)} className={inputCls}>
                  {statusDaArea("legislativo").map((status) => (
                    <option key={status.codigo} value={status.codigo}>{status.nome}</option>
                  ))}
                </select>
              </Campo>
              <Campo label="Andamento">
                <textarea
                  value={notaAndamento}
                  onChange={(e) => setNotaAndamento(e.target.value)}
                  className={`${inputCls} min-h-24 py-2`}
                  placeholder="O que aconteceu"
                />
              </Campo>
              <Campo label="Novo prazo (opcional)">
                <input
                  type="date"
                  value={novoPrazo}
                  onChange={(e) => setNovoPrazo(e.target.value)}
                  className={inputCls}
                />
              </Campo>
              <Campo label="Retornou como">
                <select value={retorno} onChange={(e) => setRetorno(e.target.value as "" | RetornoLegislativo)} className={inputCls}>
                  <option value="">Ainda não</option>
                  <option value="veto">Veto</option>
                  <option value="sancionada">Sancionada</option>
                </select>
              </Campo>
              {retorno === "veto" && (
                <Campo label="Veto">
                  <select value={vetoAlcance} onChange={(e) => setVetoAlcance(e.target.value as "" | AlcanceVeto)} className={inputCls}>
                    <option value="">Integral ou parcial</option>
                    <option value="integral">Integral</option>
                    <option value="parcial">Parcial</option>
                  </select>
                </Campo>
              )}
              {retorno === "sancionada" && (
                <Campo label="Tipo de lei">
                  <select value={leiTipo} onChange={(e) => setLeiTipo(e.target.value as "" | TipoLei)} className={inputCls}>
                    <option value="">Escolha</option>
                    {TIPOS_LEI.map((tipo) => (
                      <option key={tipo} value={tipo}>{tipo}</option>
                    ))}
                  </select>
                </Campo>
              )}
              {retorno && (
                <div className="grid grid-cols-2 gap-3">
                  <Campo label="Número">
                    <input value={leiNumero} onChange={(e) => setLeiNumero(e.target.value.replace(/\D/g, "").slice(0, 6))} inputMode="numeric" className={inputCls} />
                  </Campo>
                  <Campo label="Ano">
                    <input value={leiAno} onChange={(e) => setLeiAno(Number(e.target.value))} inputMode="numeric" className={inputCls} />
                  </Campo>
                </div>
              )}
              {retorno === "veto" && (
                <Campo label="Prazo de apreciação">
                  <input type="date" value={apreciacao} onChange={(e) => setApreciacao(e.target.value)} className={inputCls} />
                </Campo>
              )}
              <div className="flex gap-2 pt-1">
                <Dialog.Close
                  type="button"
                  className="inline-flex h-11 flex-1 items-center justify-center rounded-xl border border-line text-sm font-medium"
                >
                  Cancelar
                </Dialog.Close>
                <button
                  type="submit"
                  className="inline-flex h-11 flex-1 items-center justify-center rounded-xl bg-pine text-sm font-medium text-sheet"
                >
                  Registrar
                </button>
              </div>
            </form>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      <Dialog.Root open={deleteId !== null} onOpenChange={(open) => !open && setDeleteId(null)}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-ink/40" />
          <Dialog.Content className="fixed inset-x-3 top-1/2 z-10 -translate-y-1/2 rounded-2xl border border-line bg-sheet p-5 md:left-1/2 md:w-full md:max-w-sm md:-translate-x-1/2">
            <Dialog.Title className="font-display text-2xl text-ink">Excluir processo?</Dialog.Title>
            <Dialog.Description className="mt-1 text-sm text-muted">
              O lançamento e o histórico saem da lista. Não dá para desfazer.
            </Dialog.Description>
            <div className="mt-4 flex gap-2">
              <Dialog.Close
                type="button"
                className="inline-flex h-11 flex-1 items-center justify-center rounded-xl border border-line text-sm font-medium"
              >
                Cancelar
              </Dialog.Close>
              <button
                type="button"
                onClick={excluir}
                className="inline-flex h-11 flex-1 items-center justify-center rounded-xl bg-seal text-sm font-medium text-sheet"
              >
                Excluir
              </button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      <Dialog.Root open={perfilOpen} onOpenChange={setPerfilOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-ink/40" />
          <Dialog.Content className="fixed inset-x-3 top-1/2 z-10 max-h-[90vh] -translate-y-1/2 overflow-y-auto rounded-2xl border border-line bg-sheet p-5 md:left-1/2 md:w-full md:max-w-md md:-translate-x-1/2">
            <Dialog.Title className="font-display text-2xl text-ink">Seu perfil</Dialog.Title>
            <Dialog.Description className="mt-1 text-sm text-muted">
              O nome aparece como autor dos lançamentos e andamentos.
            </Dialog.Description>
            <form
              className="mt-4 flex flex-col gap-3"
              onSubmit={(event) => {
                event.preventDefault();
                void salvarPerfil();
              }}
            >
              <Campo label="Nome">
                <input
                  value={nomePerfil}
                  onChange={(event) => setNomePerfil(event.target.value)}
                  className={inputCls}
                  required
                  minLength={2}
                  maxLength={80}
                />
              </Campo>
              <div className="flex gap-2 pt-1">
                <Dialog.Close
                  type="button"
                  className="inline-flex h-11 flex-1 items-center justify-center rounded-xl border border-line text-sm font-medium"
                >
                  Cancelar
                </Dialog.Close>
                <button
                  type="submit"
                  disabled={salvandoPerfil}
                  className="inline-flex h-11 flex-1 items-center justify-center rounded-xl bg-pine text-sm font-medium text-sheet disabled:opacity-60"
                >
                  Salvar perfil
                </button>
              </div>
            </form>
            <TrocaSenhaPerfil />
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      {toast && (
        <p
          role="status"
          className="fixed bottom-4 left-1/2 z-20 -translate-x-1/2 rounded-full bg-ink px-4 py-2 text-sm text-sheet"
        >
          {toast}
        </p>
      )}
      <AjudaFlutuante nome={meuNome} area={area} />
    </div>
  );
}

const inputCls =
  "h-11 w-full rounded-xl border border-line bg-paper px-3 text-sm text-ink placeholder:text-muted";

function CaixaAvisos({
  perm,
  onAtivar,
}: {
  perm: NotificationPermission | "unsupported";
  onAtivar: () => void;
}) {
  return (
    <div className="rounded-2xl border border-line bg-sheet p-4">
      <div className="flex items-center gap-2 text-sm font-medium text-ink">
        <Bell className="size-4 text-pine" />
        Avisos
      </div>
      <TextoAvisos perm={perm} onAtivar={onAtivar} />
    </div>
  );
}

function TextoAvisos({
  perm,
  onAtivar,
}: {
  perm: NotificationPermission | "unsupported";
  onAtivar: () => void;
}) {
  return (
    <>
      <p className="mt-2 text-sm leading-relaxed text-muted">
        Os prazos vencidos e os que entram na antecedência escolhida ficam destacados no topo. Com a página aberta, o
        navegador também notifica — uma vez por dia para cada prazo.
      </p>
      {perm === "granted" ? (
        <p className="mt-3 text-sm font-medium text-pine">Avisos do navegador ativos.</p>
      ) : perm === "denied" ? (
        <p className="mt-3 flex items-start gap-2 text-sm text-brass">
          <BellOff className="mt-0.5 size-4 shrink-0" />
          Bloqueados neste navegador. Os alertas continuam nesta tela.
        </p>
      ) : perm === "default" ? (
        <button
          type="button"
          onClick={onAtivar}
          className="mt-3 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-line bg-paper text-sm font-medium text-ink"
        >
          <Bell className="size-4" />
          Ativar avisos
        </button>
      ) : (
        <p className="mt-3 text-sm text-muted">Este navegador não mostra notificações do sistema.</p>
      )}
    </>
  );
}

function Campo({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex min-w-0 max-w-full flex-col gap-1 text-sm font-medium text-ink">
      {label}
      {children}
    </label>
  );
}

function Resumo({
  valor,
  rotulo,
  tom,
}: {
  valor: number;
  rotulo: string;
  tom: "seal" | "brass" | "pine";
}) {
  const cor = tom === "seal" ? "text-seal" : tom === "brass" ? "text-brass" : "text-pine";
  return (
    <div className="rounded-2xl border border-line bg-sheet px-3 py-3">
      <p className={`font-display text-3xl leading-none ${cor}`}>{valor}</p>
      <p className="mt-1 text-xs text-muted">{rotulo}</p>
    </div>
  );
}

function ProcessoCard({
  processo,
  equipes,
  onMover,
  onEditar,
  onAndamento,
  onConcluir,
  onReabrir,
  onExcluir,
}: {
  processo: Processo;
  equipes: { id: string; nome: string }[];
  onMover: (id: string, equipeId: string | null) => void;
  onEditar: () => void;
  onAndamento: () => void;
  onConcluir: () => void;
  onReabrir: () => void;
  onExcluir: () => void;
}) {
  const [aberto, setAberto] = useState(false);
  const [moverAberto, setMoverAberto] = useState(false);
  const u = urgencia(processo);
  const tom = TOM[u];
  const ultimo = processo.historico[processo.historico.length - 1];
  const dias = daysUntil(processo.prazo);

  return (
    <li
      draggable
      onDragStart={(evento) => {
        evento.dataTransfer.setData("text/plain", processo.id);
        evento.dataTransfer.effectAllowed = "move";
      }}
      className="relative flex h-full cursor-grab flex-col overflow-hidden rounded-2xl border border-line bg-sheet active:cursor-grabbing"
    >
      <span className={`absolute inset-y-0 left-0 w-1.5 ${tom.bar}`} aria-hidden />
      <div className="flex flex-1 flex-col px-4 py-4 pl-5">
        <div className="flex flex-wrap items-center gap-2">
          <span className={`rounded-full px-2 py-1 text-xs font-medium ${tom.badge}`}>{prazoLabel(processo)}</span>
        </div>
        <p className="mt-3 font-display text-2xl leading-none tracking-tight text-ink">
          {numeroComAno(processo.numero, processo.dataLancamento)}
        </p>
        <p className="mt-1 text-sm font-semibold text-pine">{processo.tipo}</p>
        <p className="text-xs text-muted">{nomeStatus("legislativo", processo.status)}</p>
        <h2 className="mt-2 text-base font-semibold text-ink">{processo.parte}</h2>
        <p className="text-sm text-muted">{processo.assunto}</p>
        {processo.retorno && (
          <p className="mt-2 text-sm font-medium text-ink">
            {processo.retorno === "sancionada"
              ? `Sancionada · ${processo.leiTipo ?? "Lei"} ${String(processo.leiNumero ?? "").padStart(2, "0")}/${processo.leiAno ?? ""}`
              : `Veto ${processo.vetoAlcance ?? ""} · ${String(processo.leiNumero ?? "").padStart(2, "0")}/${processo.leiAno ?? ""}`}
            {processo.retorno === "veto" && processo.apreciacaoPrazo ? ` · apreciação ${formatDate(processo.apreciacaoPrazo)}` : ""}
          </p>
        )}
        <p className="mt-1 text-xs text-muted">Lançado por {processo.autorNome || "sem nome"}</p>

        <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
          <div>
            <p className="text-xs text-muted">Lançamento</p>
            <p className="font-medium text-ink">{formatDate(processo.dataLancamento)}</p>
          </div>
          <div>
            <p className="flex items-center gap-1 text-xs text-muted">
              <CalendarClock className="size-3" />
              Prazo
            </p>
            <p className="font-medium text-ink">{formatDate(processo.prazo)}</p>
            {!encerraStatus("legislativo", processo.status) && dias > 0 && (
              <p className="text-xs text-muted">Aviso {processo.alertaDias} dias antes</p>
            )}
          </div>
        </div>

        {ultimo && (
          <p className="mt-3 text-sm leading-relaxed text-ink">
            <span className="text-muted">Último · {ultimo.autorNome || "sem nome"} · </span>
            {ultimo.texto}
          </p>
        )}

        {processo.historico.length > 0 && (
          <button
            type="button"
            onClick={() => setAberto((v) => !v)}
            className="mt-2 text-sm font-medium text-pine"
          >
            {aberto ? "Ocultar histórico" : `Ver histórico (${processo.historico.length})`}
          </button>
        )}
        {aberto && (
          <ol className="mt-2 flex flex-col gap-2 border-t border-line pt-2">
            {[...processo.historico].reverse().map((item) => (
              <li key={item.id} className="text-sm">
                <span className="text-xs text-muted">
                  {new Intl.DateTimeFormat("pt-BR", {
                    day: "2-digit",
                    month: "short",
                    hour: "2-digit",
                    minute: "2-digit",
                  }).format(new Date(item.em))}
                  {" · "}
                  {item.autorNome || "sem nome"}
                </span>
                <span className="mt-0.5 block text-ink">{item.texto}</span>
              </li>
            ))}
          </ol>
        )}

        <div className="mt-auto flex flex-wrap gap-2 pt-4">
          <button
            type="button"
            onClick={onAndamento}
            className="inline-flex h-10 items-center gap-1 rounded-lg bg-pine-soft px-3 text-sm font-medium text-pine"
          >
            Andamento
          </button>
          {!encerraStatus("legislativo", processo.status) ? (
            <button
              type="button"
              onClick={onConcluir}
              className="inline-flex h-10 items-center gap-1 rounded-lg border border-line px-3 text-sm font-medium text-ink"
            >
              <Check className="size-4" />
              Arquivar
            </button>
          ) : (
            <button
              type="button"
              onClick={onReabrir}
              className="inline-flex h-10 items-center gap-1 rounded-lg border border-line px-3 text-sm font-medium text-ink"
            >
              <RotateCcw className="size-4" />
              Reabrir
            </button>
          )}
          <button
            type="button"
            onClick={() => setMoverAberto((v) => !v)}
            className="inline-flex h-10 items-center rounded-lg border border-line px-3 text-sm font-medium text-ink"
          >
            Mover
          </button>
          <button
            type="button"
            onClick={onEditar}
            className="inline-flex h-10 items-center gap-1 rounded-lg border border-line px-3 text-sm font-medium text-ink"
            aria-label={`Editar ${processo.numero}`}
          >
            <Pencil className="size-4" />
            Editar
          </button>
          <button
            type="button"
            onClick={onExcluir}
            className="inline-flex h-10 items-center gap-1 rounded-lg border border-line px-3 text-sm font-medium text-seal"
            aria-label={`Excluir ${processo.numero}`}
          >
            <Trash2 className="size-4" />
            Excluir
          </button>
        </div>
        {moverAberto && (
          <div className="mt-2 flex flex-col gap-1 rounded-xl border border-line bg-paper p-2">
            <p className="px-2 text-xs text-muted">Ou arraste o card até a equipe.</p>
            {processo.equipeId && (
              <button type="button" onClick={() => { setMoverAberto(false); onMover(processo.id, null); }} className="h-9 rounded-lg px-2 text-left text-sm font-medium text-ink hover:bg-sheet">
                Só meus
              </button>
            )}
            {equipes.filter((equipe) => equipe.id !== processo.equipeId).map((equipe) => (
              <button key={equipe.id} type="button" onClick={() => { setMoverAberto(false); onMover(processo.id, equipe.id); }} className="h-9 rounded-lg px-2 text-left text-sm font-medium text-ink hover:bg-sheet">
                {equipe.nome}
              </button>
            ))}
            {!processo.equipeId && equipes.length === 0 && (
              <p className="px-2 text-sm text-muted">Crie uma equipe para mover o processo.</p>
            )}
          </div>
        )}
      </div>
    </li>
  );
}

function PainelEquipe({
  equipes,
  atual,
  meuEmail,
  onEscolher,
  onCriar,
  onAdicionar,
  onRemover,
  onRenomear,
}: {
  equipes: Equipe[];
  atual: string | null;
  meuEmail: string;
  onEscolher: (id: string | null) => void;
  onCriar: (nome: string) => Promise<void>;
  onAdicionar: (email: string) => Promise<void>;
  onRemover: (email: string) => Promise<void>;
  onRenomear: (equipeId: string, nome: string) => Promise<void>;
}) {
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [sobre, setSobre] = useState<string | null>(null);
  const [menuId, setMenuId] = useState<string | null>(null);
  const [nomeEdicao, setNomeEdicao] = useState("");
  const soltar = useContext(SoltarProcessoContext);
  const selecionada = equipes.find((equipe) => equipe.id === atual) ?? null;
  const soltou = useRef(false);

  function escolher(id: string | null) {
    if (soltou.current) {
      soltou.current = false;
      return;
    }
    onEscolher(id);
  }

  function alvoArraste(chave: string, equipeId: string | null) {
    return {
      onDragOver: (evento: DragEvent<HTMLButtonElement>) => {
        evento.preventDefault();
        evento.dataTransfer.dropEffect = "move";
        setSobre(chave);
      },
      onDragLeave: () => setSobre((valor) => (valor === chave ? null : valor)),
      onDrop: (evento: DragEvent<HTMLButtonElement>) => aoSoltar(evento, equipeId),
    };
  }

  function aoSoltar(evento: DragEvent<HTMLButtonElement>, equipeId: string | null) {
    evento.preventDefault();
    evento.stopPropagation();
    setSobre(null);
    soltou.current = true;
    const id = evento.dataTransfer.getData("text/plain");
    if (id) soltar?.(id, equipeId);
  }

  function classeAlvo(chave: string, ativo: boolean) {
    return (
      "h-10 rounded-xl px-3 text-left text-sm font-medium " +
      (sobre === chave ? "ring-2 ring-pine " : "") +
      (ativo ? "bg-ink text-sheet" : "border border-line text-ink")
    );
  }

  return (
    <div className="rounded-2xl border border-line bg-sheet p-4">
      <div className="flex items-center gap-2 text-sm font-medium text-ink">
        <Users className="size-4 text-pine" />
        Equipe
      </div>
      <p className="mt-2 text-sm leading-relaxed text-muted">
        Arraste o processo até a equipe, ou use o botão Mover no card. Soltar em Só meus devolve para você.
      </p>
      <div className="mt-3 flex flex-col gap-2">
        <button
          type="button"
          onClick={() => escolher(null)}
          {...alvoArraste("meus", null)}
          className={classeAlvo("meus", atual === null)}
        >
          Só meus
        </button>
        {equipes.map((equipe) => (
          <div key={equipe.id} className="relative">
            <button
              type="button"
              onClick={() => escolher(equipe.id)}
              {...alvoArraste(equipe.id, equipe.id)}
              className={classeAlvo(equipe.id, atual === equipe.id) + " w-full " + (equipe.papel === "dono" ? "pr-9" : "")}
            >
              <span className="block truncate">{equipe.nome}</span>
            </button>
            {equipe.papel === "dono" && (
              <button
                type="button"
                aria-label="Opções da equipe"
                aria-expanded={menuId === equipe.id}
                onClick={() => {
                  setMenuId((atualId) => (atualId === equipe.id ? null : equipe.id));
                  setNomeEdicao(equipe.nome);
                }}
                className={
                  "absolute right-1 top-1.5 grid size-7 place-items-center rounded-lg " +
                  (atual === equipe.id ? "text-sheet" : "text-muted")
                }
              >
                <Ellipsis className="size-4" />
              </button>
            )}
            {equipe.papel === "dono" && menuId === equipe.id && (
              <form
                className="absolute right-0 top-11 z-20 flex w-full flex-col gap-2 rounded-xl border border-line bg-sheet p-3 shadow-lg"
                onSubmit={(event) => {
                  event.preventDefault();
                  const proximo = nomeEdicao.trim();
                  if (ocupado || proximo.length < 2 || proximo === equipe.nome) {
                    setMenuId(null);
                    return;
                  }
                  setOcupado(true);
                  void onRenomear(equipe.id, proximo).finally(() => {
                    setOcupado(false);
                    setMenuId(null);
                  });
                }}
              >
                <label className="flex flex-col gap-1 text-sm font-medium text-ink">
                  Mudar nome
                  <input
                    value={nomeEdicao}
                    onChange={(event) => setNomeEdicao(event.target.value)}
                    className="h-11 rounded-xl border border-line bg-paper px-3 text-sm font-normal"
                    spellCheck
                    lang="pt-BR"
                    autoFocus
                  />
                </label>
                <button
                  type="submit"
                  disabled={ocupado}
                  className="inline-flex h-11 items-center justify-center rounded-xl bg-pine text-sm font-medium text-sheet disabled:opacity-60"
                >
                  Salvar
                </button>
              </form>
            )}
          </div>
        ))}
      </div>

      {!selecionada ? (
        <form
          className="mt-3 flex flex-col gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            if (ocupado || nome.trim().length < 2) return;
            setOcupado(true);
            void onCriar(nome.trim()).finally(() => {
              setNome("");
              setOcupado(false);
            });
          }}
        >
          <label className="flex flex-col gap-1 text-sm font-medium text-ink">
            Nova equipe
            <input
              value={nome}
              onChange={(event) => setNome(event.target.value)}
              placeholder="Ex.: Gabinete"
              className="h-11 rounded-xl border border-line bg-paper px-3 text-sm font-normal"
            />
          </label>
          <button
            type="submit"
            disabled={ocupado}
            className="inline-flex h-11 items-center justify-center rounded-xl bg-pine text-sm font-medium text-sheet disabled:opacity-60"
          >
            Criar equipe
          </button>
        </form>
      ) : (
        <div className="mt-3 flex flex-col gap-2">
          <ul className="flex flex-col gap-1">
            {selecionada.membros.map((membro) => (
              <li key={membro.userId} className="flex items-center justify-between gap-2 text-sm">
                <span className="flex min-w-0 items-center gap-2 text-ink">
                  <span className="grid size-8 shrink-0 place-items-center rounded-full bg-pine-soft text-xs font-medium text-pine">
                    {(membro.nome || "?").charAt(0).toUpperCase()}
                  </span>
                  <span className="min-w-0 truncate">
                    {membro.nome}
                    <span className="text-muted"> · {membro.papel === "dono" ? "criou" : "membro"}</span>
                  </span>
                </span>
                {selecionada.papel === "dono" && membro.papel !== "dono" && (
                  <button type="button" onClick={() => void onRemover(membro.email)} className="inline-flex h-11 items-center text-sm font-medium text-seal">
                    Remover
                  </button>
                )}
                {selecionada.papel !== "dono" && membro.email.toLowerCase() === meuEmail.toLowerCase() && (
                  <button type="button" onClick={() => void onRemover(membro.email)} className="inline-flex h-11 items-center text-sm font-medium text-seal">
                    Sair
                  </button>
                )}
              </li>
            ))}
            {selecionada.convites.map((convite) => (
              <li key={convite} className="flex items-center justify-between gap-2 text-sm text-muted">
                <span className="min-w-0 truncate">{convite} · convite</span>
                {selecionada.papel === "dono" && (
                  <button type="button" onClick={() => void onRemover(convite)} className="inline-flex h-11 items-center text-sm font-medium text-seal">
                    Remover
                  </button>
                )}
              </li>
            ))}
          </ul>
          {selecionada.papel === "dono" && (
            <form
              className="flex flex-col gap-2"
              onSubmit={(event) => {
                event.preventDefault();
                if (ocupado || !email.trim()) return;
                setOcupado(true);
                void onAdicionar(email.trim()).finally(() => {
                  setEmail("");
                  setOcupado(false);
                });
              }}
            >
              <label className="flex flex-col gap-1 text-sm font-medium text-ink">
                Adicionar por e-mail
                <input
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="pessoa@email.com"
                  className="h-11 rounded-xl border border-line bg-paper px-3 text-sm font-normal"
                />
              </label>
              <button
                type="submit"
                disabled={ocupado}
                className="inline-flex h-11 items-center justify-center rounded-xl border border-line text-sm font-medium text-ink disabled:opacity-60"
              >
                Adicionar
              </button>
            </form>
          )}
        </div>
      )}
    </div>
  );
}

function garantirAno(lista: Processo[]): Processo[] {
  const pendentes: Processo[] = [];
  const saida = lista.map((item) => {
    const numero = numeroComAno(item.numero, item.dataLancamento);
    if (numero === item.numero) return item;
    const atualizado = { ...item, numero };
    pendentes.push(atualizado);
    return atualizado;
  });
  for (const item of pendentes) void salvarProcesso({ data: item });
  return saida;
}

function passaSituacao(item: Processo, situacao: "todos" | Filtro) {
  if (situacao === "todos") return true;
  const u = urgencia(item);
  if (situacao === "abertos") return !encerraStatus("legislativo", item.status);
  if (situacao === "atencao") return precisaAviso(item);
  if (situacao === "vencidos") return u === "vencido";
  if (situacao === "prazo") return u === "ok";
  if (situacao === "concluidos") return encerraStatus("legislativo", item.status);
  return true;
}

function RelatorioLegislativo({
  periodo,
  ancora,
  situacao,
  relatorio,
  onPeriodo,
  onAncora,
  onSituacao,
  onGerar,
}: {
  periodo: PeriodoRelatorio;
  ancora: string;
  situacao: "todos" | Filtro;
  relatorio: { rotulo: string; inicio: string; fim: string; itens: Processo[] } | null;
  onPeriodo: (valor: PeriodoRelatorio) => void;
  onAncora: (valor: string) => void;
  onSituacao: (valor: "todos" | Filtro) => void;
  onGerar: () => void;
}) {
  const rotuloSituacao =
    situacao === "todos" ? "todas as situações" : (FILTROS.find((item) => item.id === situacao)?.label.toLowerCase() ?? situacao);
  return (
    <div className="flex flex-col gap-4">
      <div className="no-print min-w-0 rounded-2xl border border-line bg-sheet p-4">
        <h2 className="font-display text-2xl text-ink">Gerar relatório</h2>
        <p className="mt-1 text-sm text-muted">
          Entram os processos cujo lançamento e prazo cruzam o período. Os gráficos acompanham o recorte.
        </p>
        <div className="mt-4 grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-3">
          <Campo label="Período">
            <select value={periodo} onChange={(e) => onPeriodo(e.target.value as PeriodoRelatorio)} className={inputCls}>
              <option value="mensal">Mensal</option>
              <option value="trimestral">Trimestral</option>
              <option value="semestral">Semestral</option>
              <option value="anual">Anual</option>
            </select>
          </Campo>
          <Campo label="Mês de referência">
            <CampoMes value={ancora} onChange={onAncora} />
          </Campo>
          <Campo label="Situação">
            <select value={situacao} onChange={(e) => onSituacao(e.target.value as "todos" | Filtro)} className={inputCls}>
              {FILTROS.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label}
                </option>
              ))}
            </select>
          </Campo>
        </div>
        <button
          type="button"
          onClick={onGerar}
          className="mt-4 inline-flex h-11 items-center gap-2 rounded-xl bg-pine px-4 text-sm font-medium text-sheet"
        >
          <FileText className="size-4" />
          Gerar relatório
        </button>
      </div>
      {relatorio && (
        <article className="relatorio-folha rounded-2xl border border-line bg-sheet p-4 md:p-6">
          <Timbrado />
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-pine">Processos legislativos</p>
              <h2 className="font-display text-2xl text-ink sm:text-3xl">Relatório · {relatorio.rotulo}</h2>
              <p className="mt-1 text-sm text-muted">
                {formatDate(relatorio.inicio)} a {formatDate(relatorio.fim)} · {rotuloSituacao} · {relatorio.itens.length}{" "}
                {relatorio.itens.length === 1 ? "processo" : "processos"}
              </p>
            </div>
            <BotaoRelatorio />
          </div>
          <PainelEstatisticas processos={relatorio.itens} className="relatorio-graficos mt-4 grid gap-4 lg:grid-cols-2" />
          {relatorio.itens.length === 0 ? (
            <p className="mt-4 text-sm text-muted">Nenhum processo neste período.</p>
          ) : (
            <>
              <ul className="relatorio-cards mt-4 flex flex-col gap-3 md:hidden">
                {relatorio.itens.map((item) => (
                  <li key={item.id} className="rounded-xl border border-line p-3 text-sm">
                    <p className="font-medium text-ink">{numeroComAno(item.numero, item.dataLancamento)}</p>
                    <p className="text-pine">{item.tipo}</p>
                    <p className="text-ink">{item.parte}</p>
                    <p className="text-muted">{item.assunto}</p>
                    <p className="mt-1 text-ink">
                      {prazoLabel(item)} · {formatDate(item.prazo)}
                    </p>
                    <p className="text-muted">{rotuloRetorno(item)}</p>
                    <p className="text-ink">{rotuloResposta(item)}</p>
                  </li>
                ))}
              </ul>
              <div className="relatorio-tabela-wrap mt-4 hidden md:block">
                <table className="relatorio-tabela w-full border-collapse text-left text-sm">
                  <thead>
                    <tr className="border-b border-line text-xs text-muted">
                      <th className="py-2 pr-3 font-medium">Número</th>
                      <th className="py-2 pr-3 font-medium">Tipo</th>
                      <th className="py-2 pr-3 font-medium">Parte</th>
                      <th className="py-2 pr-3 font-medium">Assunto</th>
                      <th className="py-2 pr-3 font-medium">Prazo</th>
                      <th className="py-2 pr-3 font-medium">Retorno</th>
                      <th className="py-2 font-medium">Resposta</th>
                    </tr>
                  </thead>
                  <tbody>
                    {relatorio.itens.map((item) => (
                      <tr key={item.id} className="border-b border-line align-top">
                        <td className="py-2 pr-3 font-medium text-ink">{numeroComAno(item.numero, item.dataLancamento)}</td>
                        <td className="py-2 pr-3 text-ink">{item.tipo}</td>
                        <td className="py-2 pr-3 text-ink">{item.parte}</td>
                        <td className="py-2 pr-3 text-ink">{item.assunto}</td>
                        <td className="py-2 pr-3 text-ink">
                          {prazoLabel(item)} · {formatDate(item.prazo)}
                        </td>
                        <td className="py-2 pr-3 text-ink">{rotuloRetorno(item)}</td>
                        <td className="py-2 text-ink">{rotuloResposta(item)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
          <TimbradoRodape />
        </article>
      )}
    </div>
  );
}
