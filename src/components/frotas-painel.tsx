import { useEffect, useMemo, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Plus } from "lucide-react";
import { useConfirmarExclusao } from "@/components/confirmar-exclusao";
import {
  excluirAbastecimento,
  excluirAgendamento,
  excluirManutencao,
  excluirMulta,
  excluirSinistro,
  excluirVeiculo,
  lancarRetornoAgendado,
  lancarSaidaAgendada,
  listarFrotas,
  registrarRetorno,
  registrarSaida,
  salvarAbastecimento,
  salvarAgendamento,
  salvarManutencao,
  salvarMulta,
  salvarSinistro,
  salvarVeiculo,
  type AbastecimentoFrota,
  type AgendamentoFrota,
  type CondutorFrota,
  type ManutencaoFrota,
  type MultaFrota,
  type SaidaFrota,
  type SinistroFrota,
  type SituacaoFrota,
  type VeiculoFrota,
} from "@/lib/frotas.functions";

const TIPOS = ["Carro", "Moto", "Van", "Caminhão", "Ônibus", "Outro"];
const COMBUSTIVEIS = ["Flex", "Gasolina", "Etanol", "Diesel", "GNV", "Elétrico"];
const FINALIDADES = ["Cliente", "Entrega", "Carga", "Ordem de serviço", "Outro"];
const GRAVIDADES = ["Leve", "Média", "Grave", "Gravíssima"];
const ITENS: Record<ManutencaoFrota["classe"], string[]> = {
  preventiva: ["Troca de óleo", "Filtros", "Correias", "Alinhamento", "Balanceamento", "Freios", "Revisão"],
  corretiva: ["Quebra mecânica", "Peça", "Serviço de oficina"],
  pneu: ["Rodízio", "Calibragem", "Sulcagem", "Recapagem", "Substituição"],
};
const SITUACOES: { id: SituacaoFrota; nome: string }[] = [
  { id: "disponivel", nome: "Disponível" },
  { id: "em_uso", nome: "Em uso" },
  { id: "manutencao", nome: "Manutenção" },
  { id: "baixado", nome: "Baixado" },
];
const ABAS = [
  ["cadastro", "Cadastro"],
  ["combustivel", "Combustível"],
  ["manutencao", "Manutenção"],
  ["rotas", "Rotas"],
  ["ocorrencias", "Multas e sinistros"],
] as const;

type Aba = (typeof ABAS)[number][0];

function rotuloSituacao(id: SituacaoFrota) {
  return SITUACOES.find((item) => item.id === id)?.nome ?? id;
}

function tomSituacao(id: SituacaoFrota) {
  if (id === "disponivel") return "bg-pine-soft text-pine";
  if (id === "em_uso") return "bg-brass-soft text-brass";
  if (id === "manutencao") return "bg-seal-soft text-seal";
  return "bg-line text-muted";
}

function kmTexto(valor: number) {
  return `${valor.toLocaleString("pt-BR")} km`;
}

function dataTexto(valor: string) {
  const [ano, mes, dia] = valor.split("-");
  if (!ano || !mes || !dia) return "";
  return `${dia}/${mes}/${ano}`;
}

function reais(centavos: number) {
  return (centavos / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function centavosDe(texto: string) {
  const limpo = texto.trim().replace(/\./g, "").replace(",", ".");
  const numero = Number(limpo);
  if (!Number.isFinite(numero) || numero < 0) return 0;
  return Math.round(numero * 100);
}

function hoje() {
  return new Date().toISOString().slice(0, 10);
}

function venceEm(data: string, dias = 30) {
  if (!data) return false;
  const limite = new Date();
  limite.setDate(limite.getDate() + dias);
  return data <= limite.toISOString().slice(0, 10);
}

function consumoDe(lista: AbastecimentoFrota[]) {
  const grupos = new Map<string, AbastecimentoFrota[]>();
  for (const item of lista) {
    const chave = `${item.veiculoId}:${item.medidor}`;
    grupos.set(chave, [...(grupos.get(chave) ?? []), item]);
  }
  const resultado = new Map<string, { media: number; ultimo: number; unidade: string }>();
  for (const [chave, itens] of grupos) {
    const ordem = [...itens].sort((a, b) => a.odometro - b.odometro || a.data.localeCompare(b.data));
    const taxas: number[] = [];
    for (let i = 1; i < ordem.length; i += 1) {
      const delta = ordem[i].odometro - ordem[i - 1].odometro;
      if (delta > 0 && ordem[i].litros > 0) taxas.push(delta / ordem[i].litros);
    }
    if (!taxas.length) continue;
    const media = taxas.reduce((soma, item) => soma + item, 0) / taxas.length;
    resultado.set(chave, { media, ultimo: taxas[taxas.length - 1], unidade: chave.endsWith("horas") ? "h/l" : "km/l" });
  }
  return resultado;
}

const vazioVeiculo = {
  id: "",
  placa: "",
  descricao: "",
  marca: "",
  ano: "",
  chassi: "",
  renavam: "",
  tipo: "Carro",
  combustivel: "Flex",
  capacidade: "",
  posse: "Próprio",
  km: "",
  situacao: "disponivel" as SituacaoFrota,
  setor: "",
  seguroApolice: "",
  seguroCobertura: "",
  seguroVence: "",
};

function agoraLocal() {
  const data = new Date();
  const dois = (valor: number) => String(valor).padStart(2, "0");
  return {
    dia: `${data.getFullYear()}-${dois(data.getMonth() + 1)}-${dois(data.getDate())}`,
    hora: `${dois(data.getHours())}:${dois(data.getMinutes())}`,
  };
}

function noPeriodo(item: AgendamentoFrota, agora = agoraLocal()) {
  return item.dia === agora.dia && agora.hora >= item.horaInicio && agora.hora <= item.horaFim;
}

export function FrotasPainel({ equipeId, usuarioId, usuarioNome, onToast }: { equipeId: string | null; usuarioId: string; usuarioNome: string; onToast: (texto: string) => void }) {
  const [aba, setAba] = useState<Aba>("cadastro");
  const [veiculos, setVeiculos] = useState<VeiculoFrota[]>([]);
  const [condutores, setCondutores] = useState<CondutorFrota[]>([]);
  const [abastecimentos, setAbastecimentos] = useState<AbastecimentoFrota[]>([]);
  const [manutencoes, setManutencoes] = useState<ManutencaoFrota[]>([]);
  const [saidas, setSaidas] = useState<SaidaFrota[]>([]);
  const [multas, setMultas] = useState<MultaFrota[]>([]);
  const [sinistros, setSinistros] = useState<SinistroFrota[]>([]);
  const [agendamentos, setAgendamentos] = useState<AgendamentoFrota[]>([]);
  const [pagina, setPagina] = useState<"painel" | "agenda">("painel");
  const [agora, setAgora] = useState(agoraLocal);
  const exclusao = useConfirmarExclusao();

  function carregar() {
    void listarFrotas({ data: { equipeId } })
      .then((pacote) => {
        setVeiculos(pacote.veiculos);
        setCondutores(pacote.condutores);
        setAbastecimentos(pacote.abastecimentos);
        setManutencoes(pacote.manutencoes);
        setSaidas(pacote.saidas);
        setMultas(pacote.multas);
        setSinistros(pacote.sinistros);
        setAgendamentos(pacote.agendamentos);
      })
      .catch((err: unknown) => onToast(err instanceof Error ? err.message : "Não foi possível carregar a frota."));
  }

  useEffect(() => {
    carregar();
  }, [equipeId]);

  useEffect(() => {
    const id = window.setInterval(() => setAgora(agoraLocal()), 30_000);
    return () => window.clearInterval(id);
  }, []);

  function falha(err: unknown, padrao: string) {
    onToast(err instanceof Error ? err.message : padrao);
  }

  function placa(id: string) {
    return veiculos.find((item) => item.id === id)?.placa ?? "Veículo";
  }

  function nomeCondutor(id: string) {
    return condutores.find((item) => item.id === id)?.nome ?? "";
  }

  const alertas = useMemo(() => {
    const lista: string[] = [];
    for (const item of veiculos) {
      const docs = [["seguro", item.seguroVence]] as const;
      for (const [nome, data] of docs) {
        if (data && data < hoje()) lista.push(`${item.placa}: ${nome} vencido`);
        else if (venceEm(data)) lista.push(`${item.placa}: ${nome} vence em ${dataTexto(data)}`);
      }
    }
    for (const item of condutores) {
      if (item.validade && item.validade < hoje()) lista.push(`CNH de ${item.nome} vencida`);
      else if (venceEm(item.validade)) lista.push(`CNH de ${item.nome} vence em ${dataTexto(item.validade)}`);
      if (item.toxicologico && item.toxicologico < hoje()) lista.push(`Toxicológico de ${item.nome} vencido`);
    }
    for (const item of manutencoes) {
      const veiculo = veiculos.find((atual) => atual.id === item.veiculoId);
      if (item.proximaData && item.proximaData <= hoje()) lista.push(`${veiculo?.placa ?? "Veículo"}: ${item.item} vencido`);
      else if (veiculo && item.proximoKm != null && veiculo.km >= item.proximoKm) lista.push(`${veiculo.placa}: ${item.item} pela quilometragem`);
    }
    return lista.slice(0, 6);
  }, [veiculos, condutores, manutencoes]);

  const meus = agendamentos.filter((item) => item.userId === usuarioId && !item.horaRetorno && (Boolean(item.horaSaida) || noPeriodo(item, agora)));

  if (pagina === "agenda") {
    return (
      <PaginaAgenda
        equipeId={equipeId}
        usuarioNome={usuarioNome}
        veiculos={veiculos}
        agendamentos={agendamentos}
        agora={agora}
        onVoltar={() => setPagina("painel")}
        onToast={onToast}
        falha={falha}
        carregar={carregar}
        pedir={exclusao.pedir}
        dialogo={exclusao.dialogo}
      />
    );
  }

  return (
    <div className="mt-4">
      {exclusao.dialogo}
      {alertas.length > 0 && (
        <ul className="mb-4 flex flex-col gap-1 rounded-2xl border border-line bg-seal-soft px-4 py-3 text-sm text-seal">
          {alertas.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      )}
      {meus.map((item) => {
        const veiculo = veiculos.find((atual) => atual.id === item.veiculoId);
        return (
          <CartaoUso
            key={item.id}
            item={item}
            placa={veiculo?.placa ?? "Veículo"}
            kmAtual={veiculo?.km ?? item.kmSaida ?? 0}
            equipeId={equipeId}
            onToast={onToast}
            falha={falha}
            carregar={carregar}
          />
        );
      })}
      <div className="mb-4">
        <button type="button" onClick={() => setPagina("agenda")} className="inline-flex h-12 w-full items-center justify-center rounded-2xl bg-pine px-4 text-sm font-medium text-sheet sm:w-auto">
          Agendamento
        </button>
      </div>
      <div className="flex gap-2 overflow-x-auto pb-1">
        {ABAS.map(([id, nome]) => (
          <button
            key={id}
            type="button"
            onClick={() => setAba(id)}
            className={"h-10 shrink-0 rounded-full px-4 text-sm font-medium " + (aba === id ? "bg-pine text-sheet" : "border border-line text-ink")}
          >
            {nome}
          </button>
        ))}
      </div>
      {aba === "cadastro" && (
        <AbaCadastro
          equipeId={equipeId}
          veiculos={veiculos}
          onToast={onToast}
          falha={falha}
          carregar={carregar}
          pedir={exclusao.pedir}
        />
      )}
      {aba === "combustivel" && (
        <AbaCombustivel
          equipeId={equipeId}
          veiculos={veiculos}
          itens={abastecimentos}
          placa={placa}
          onToast={onToast}
          falha={falha}
          carregar={carregar}
          pedir={exclusao.pedir}
        />
      )}
      {aba === "manutencao" && (
        <AbaManutencao
          equipeId={equipeId}
          veiculos={veiculos}
          itens={manutencoes}
          placa={placa}
          onToast={onToast}
          falha={falha}
          carregar={carregar}
          pedir={exclusao.pedir}
        />
      )}
      {aba === "rotas" && (
        <AbaRotas
          equipeId={equipeId}
          veiculos={veiculos}
          condutores={condutores}
          saidas={saidas}
          onToast={onToast}
          falha={falha}
          carregar={carregar}
        />
      )}
      {aba === "ocorrencias" && (
        <AbaOcorrencias
          equipeId={equipeId}
          veiculos={veiculos}
          condutores={condutores}
          multas={multas}
          sinistros={sinistros}
          placa={placa}
          nomeCondutor={nomeCondutor}
          onToast={onToast}
          falha={falha}
          carregar={carregar}
          pedir={exclusao.pedir}
        />
      )}
    </div>
  );
}

function AbaCadastro({
  equipeId,
  veiculos,
  onToast,
  falha,
  carregar,
  pedir,
}: {
  equipeId: string | null;
  veiculos: VeiculoFrota[];
  onToast: (texto: string) => void;
  falha: (err: unknown, padrao: string) => void;
  carregar: () => void;
  pedir: (texto: string, aoConfirmar: () => void) => void;
}) {
  const [busca, setBusca] = useState("");
  const [veiculo, setVeiculo] = useState<typeof vazioVeiculo | null>(null);
  const termo = busca.trim().toLowerCase();
  const lista = veiculos.filter((item) => !termo || [item.placa, item.descricao, item.marca, item.setor].join(" ").toLowerCase().includes(termo));
  return (
    <div>
      <div className="mt-4 grid grid-cols-2 gap-2">
        <Resumo valor={veiculos.filter((item) => item.situacao === "disponivel").length} rotulo="Disponíveis" />
        <Resumo valor={veiculos.filter((item) => item.situacao === "em_uso").length} rotulo="Em uso" />
      </div>
      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        <input value={busca} onChange={(evento) => setBusca(evento.target.value)} placeholder="Buscar placa, modelo ou setor" className="campo-busca h-12 w-full rounded-xl border border-line px-3 text-sm text-ink placeholder:text-muted" />
        <button type="button" onClick={() => setVeiculo(vazioVeiculo)} className="inline-flex h-12 shrink-0 items-center justify-center gap-2 rounded-xl bg-pine px-4 text-sm font-medium text-sheet">
          <Plus className="size-4" />
          Novo veículo
        </button>
      </div>
      <ul className="mt-4 grid gap-3 md:grid-cols-2">
        {lista.length === 0 && <li className="text-sm text-muted">Nenhum veículo nesta lista.</li>}
        {lista.map((item) => (
          <li key={item.id} className="rounded-2xl border border-line bg-sheet p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-display text-2xl text-ink">{item.placa}</p>
                <p className="text-sm text-ink">{[item.marca, item.descricao].filter(Boolean).join(" ")}{item.ano ? ` · ${item.ano}` : ""}</p>
                <p className="text-sm text-muted">{item.tipo} · {item.combustivel} · {item.posse || "Próprio"}{item.capacidade ? ` · ${item.capacidade}` : ""}{item.setor ? ` · ${item.setor}` : ""}</p>
              </div>
              <span className={"shrink-0 rounded-full px-2 py-1 text-xs font-medium " + tomSituacao(item.situacao)}>{rotuloSituacao(item.situacao)}</span>
            </div>
            <p className="mt-3 text-sm text-ink">{kmTexto(item.km)}</p>
            <p className="mt-1 text-sm text-muted">{[item.chassi && `Chassi ${item.chassi}`, item.renavam && `Renavam ${item.renavam}`].filter(Boolean).join(" · ")}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <button type="button" onClick={() => setVeiculo({ ...vazioVeiculo, ...item, ano: item.ano ? String(item.ano) : "", km: String(item.km) })} className="inline-flex h-10 items-center rounded-xl border border-line px-3 text-sm font-medium text-ink">Editar</button>
              <button type="button" onClick={() => pedir(`Excluir o veículo ${item.placa}? Saídas, abastecimentos e o histórico dele também saem.`, () => { void excluirVeiculo({ data: { id: item.id, equipeId } }).then(() => { onToast("Veículo excluído."); carregar(); }).catch((err: unknown) => falha(err, "Não foi possível excluir.")); })} className="inline-flex h-10 items-center text-sm font-medium text-seal">Excluir</button>
            </div>
          </li>
        ))}
      </ul>
      {veiculo && (
        <Modal titulo={veiculo.id ? "Editar veículo" : "Novo veículo"} onFechar={() => setVeiculo(null)}>
          <form className="flex flex-col gap-3" onSubmit={(evento) => { evento.preventDefault(); void salvarVeiculo({ data: { ...veiculo, ano: veiculo.ano, km: Number(veiculo.km), equipeId } }).then(() => { setVeiculo(null); onToast(veiculo.id ? "Veículo atualizado." : "Veículo lançado."); carregar(); }).catch((err: unknown) => falha(err, "Não foi possível salvar o veículo.")); }}>
            <div className="grid grid-cols-2 gap-3">
              <Campo nome="Placa"><input value={veiculo.placa} onChange={(evento) => setVeiculo({ ...veiculo, placa: evento.target.value })} className={campo} required autoComplete="off" /></Campo>
              <Campo nome="Marca"><input value={veiculo.marca} onChange={(evento) => setVeiculo({ ...veiculo, marca: evento.target.value })} className={campo} autoComplete="off" /></Campo>
            </div>
            <Campo nome="Modelo"><input value={veiculo.descricao} onChange={(evento) => setVeiculo({ ...veiculo, descricao: evento.target.value })} className={campo} required autoComplete="off" /></Campo>
            <div className="grid grid-cols-2 gap-3">
              <Campo nome="Ano"><input value={veiculo.ano} onChange={(evento) => setVeiculo({ ...veiculo, ano: evento.target.value })} inputMode="numeric" className={campo} autoComplete="off" /></Campo>
              <Campo nome="Quilometragem"><input value={veiculo.km} onChange={(evento) => setVeiculo({ ...veiculo, km: evento.target.value })} inputMode="numeric" className={campo} required autoComplete="off" /></Campo>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Campo nome="Chassi"><input value={veiculo.chassi} onChange={(evento) => setVeiculo({ ...veiculo, chassi: evento.target.value })} className={campo} autoComplete="off" /></Campo>
              <Campo nome="Renavam"><input value={veiculo.renavam} onChange={(evento) => setVeiculo({ ...veiculo, renavam: evento.target.value })} className={campo} autoComplete="off" /></Campo>
            </div>
            <Campo nome="Capacidade de carga ou lotação"><input value={veiculo.capacidade} onChange={(evento) => setVeiculo({ ...veiculo, capacidade: evento.target.value })} className={campo} autoComplete="off" /></Campo>
            <Campo nome="Aquisição"><select value={veiculo.posse === "Alugado" ? "Alugado" : "Próprio"} onChange={(evento) => setVeiculo({ ...veiculo, posse: evento.target.value })} className={campo}><option>Próprio</option><option>Alugado</option></select></Campo>
            <div className="grid grid-cols-2 gap-3">
              <Campo nome="Tipo"><select value={veiculo.tipo} onChange={(evento) => setVeiculo({ ...veiculo, tipo: evento.target.value })} className={campo}>{TIPOS.map((item) => <option key={item}>{item}</option>)}</select></Campo>
              <Campo nome="Combustível"><select value={veiculo.combustivel} onChange={(evento) => setVeiculo({ ...veiculo, combustivel: evento.target.value })} className={campo}>{COMBUSTIVEIS.map((item) => <option key={item}>{item}</option>)}</select></Campo>
            </div>
            <Campo nome="Situação"><select value={veiculo.situacao} onChange={(evento) => setVeiculo({ ...veiculo, situacao: evento.target.value as SituacaoFrota })} className={campo}>{SITUACOES.map((item) => <option key={item.id} value={item.id}>{item.nome}</option>)}</select></Campo>
            <Campo nome="Setor"><input value={veiculo.setor} onChange={(evento) => setVeiculo({ ...veiculo, setor: evento.target.value })} className={campo} autoComplete="off" /></Campo>
            <Campo nome="Apólice do seguro"><input value={veiculo.seguroApolice} onChange={(evento) => setVeiculo({ ...veiculo, seguroApolice: evento.target.value })} className={campo} autoComplete="off" /></Campo>
            <Campo nome="Cobertura"><input value={veiculo.seguroCobertura} onChange={(evento) => setVeiculo({ ...veiculo, seguroCobertura: evento.target.value })} className={campo} autoComplete="off" /></Campo>
            <Campo nome="Seguro vence"><input type="date" value={veiculo.seguroVence} onChange={(evento) => setVeiculo({ ...veiculo, seguroVence: evento.target.value })} className={campo} /></Campo>
            <button type="submit" className="mt-1 inline-flex h-11 items-center justify-center rounded-xl bg-pine text-sm font-medium text-sheet">Salvar</button>
          </form>
        </Modal>
      )}
    </div>
  );
}

function AbaCombustivel({ equipeId, veiculos, itens, placa, onToast, falha, carregar, pedir }: { equipeId: string | null; veiculos: VeiculoFrota[]; itens: AbastecimentoFrota[]; placa: (id: string) => string; onToast: (texto: string) => void; falha: (err: unknown, padrao: string) => void; carregar: () => void; pedir: (texto: string, aoConfirmar: () => void) => void }) {
  const [aberto, setAberto] = useState(false);
  const [form, setForm] = useState({ veiculoId: "", data: hoje(), hora: "", posto: "", odometro: "", medidor: "km", tipo: "Diesel", litros: "" });
  const medias = consumoDe(itens);
  return (
    <div className="mt-4">
      <button type="button" onClick={() => { setForm({ veiculoId: veiculos[0]?.id ?? "", data: hoje(), hora: "", posto: "", odometro: "", medidor: "km", tipo: veiculos[0]?.combustivel ?? "Diesel", litros: "" }); setAberto(true); }} className="inline-flex h-11 items-center gap-2 rounded-xl bg-pine px-4 text-sm font-medium text-sheet"><Plus className="size-4" />Abastecimento</button>
      <ul className="mt-4 flex flex-col gap-2">
        {itens.length === 0 && <li className="text-sm text-muted">Nenhum abastecimento.</li>}
        {itens.map((item, indice) => {
          const taxa = medias.get(`${item.veiculoId}:${item.medidor}`);
          const alerta = taxa && taxa.ultimo < taxa.media * 0.7;
          return (
            <li key={item.id} className={"rounded-2xl px-4 py-3 " + (indice % 2 ? "bg-sheet" : "bg-pine-soft/40")}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-ink">{placa(item.veiculoId)} · {item.posto}</p>
                  <p className="text-sm text-muted">{dataTexto(item.data)}{item.hora ? ` ${item.hora}` : ""} · {item.litros.toLocaleString("pt-BR")} L de {item.tipo} · {item.odometro.toLocaleString("pt-BR")} {item.medidor === "horas" ? "h" : "km"}</p>
                  {taxa && <p className={"text-sm " + (alerta ? "text-seal" : "text-muted")}>Média {taxa.media.toFixed(1)} {taxa.unidade} · último {taxa.ultimo.toFixed(1)} {taxa.unidade}{alerta ? " · consumo abaixo do habitual" : ""}</p>}
                </div>
                <button type="button" onClick={() => pedir("Excluir este abastecimento?", () => { void excluirAbastecimento({ data: { id: item.id, veiculoId: item.veiculoId, equipeId } }).then(() => { onToast("Abastecimento excluído."); carregar(); }).catch((err: unknown) => falha(err, "Não foi possível excluir.")); })} className="text-sm font-medium text-seal">Excluir</button>
              </div>
            </li>
          );
        })}
      </ul>
      {aberto && (
        <Modal titulo="Abastecimento" onFechar={() => setAberto(false)}>
          <form className="flex flex-col gap-3" onSubmit={(evento) => { evento.preventDefault(); void salvarAbastecimento({ data: { ...form, equipeId, odometro: Number(form.odometro), litros: Number(form.litros.replace(",", ".")) } }).then(() => { setAberto(false); onToast("Abastecimento lançado."); carregar(); }).catch((err: unknown) => falha(err, "Não foi possível lançar.")); }}>
            <Campo nome="Veículo"><select value={form.veiculoId} onChange={(evento) => setForm({ ...form, veiculoId: evento.target.value })} className={campo} required>{veiculos.map((item) => <option key={item.id} value={item.id}>{item.placa}</option>)}</select></Campo>
            <div className="grid grid-cols-2 gap-3">
              <Campo nome="Data"><input type="date" value={form.data} onChange={(evento) => setForm({ ...form, data: evento.target.value })} className={campo} required /></Campo>
              <Campo nome="Hora"><input type="time" value={form.hora} onChange={(evento) => setForm({ ...form, hora: evento.target.value })} className={campo} /></Campo>
            </div>
            <Campo nome="Posto"><input value={form.posto} onChange={(evento) => setForm({ ...form, posto: evento.target.value })} className={campo} required autoComplete="off" /></Campo>
            <Campo nome="Medidor"><select value={form.medidor} onChange={(evento) => setForm({ ...form, medidor: evento.target.value })} className={campo}><option value="km">Odômetro (km)</option><option value="horas">Horímetro (h)</option></select></Campo>
            <Campo nome={form.medidor === "horas" ? "Horímetro" : "Odômetro"}><input value={form.odometro} onChange={(evento) => setForm({ ...form, odometro: evento.target.value })} inputMode="numeric" className={campo} required autoComplete="off" /></Campo>
            <Campo nome="Combustível"><select value={form.tipo} onChange={(evento) => setForm({ ...form, tipo: evento.target.value })} className={campo}>{COMBUSTIVEIS.map((item) => <option key={item}>{item}</option>)}</select></Campo>
            <Campo nome="Litros"><input value={form.litros} onChange={(evento) => setForm({ ...form, litros: evento.target.value })} inputMode="decimal" className={campo} required autoComplete="off" /></Campo>
            <button type="submit" className="mt-1 inline-flex h-11 items-center justify-center rounded-xl bg-pine text-sm font-medium text-sheet">Salvar</button>
          </form>
        </Modal>
      )}
    </div>
  );
}

function AbaManutencao({ equipeId, veiculos, itens, placa, onToast, falha, carregar, pedir }: { equipeId: string | null; veiculos: VeiculoFrota[]; itens: ManutencaoFrota[]; placa: (id: string) => string; onToast: (texto: string) => void; falha: (err: unknown, padrao: string) => void; carregar: () => void; pedir: (texto: string, aoConfirmar: () => void) => void }) {
  const [classe, setClasse] = useState<ManutencaoFrota["classe"] | null>(null);
  const [form, setForm] = useState({ veiculoId: "", item: "", data: hoje(), km: "", proximaData: "", proximoKm: "", oficina: "", diasParada: "", custo: "", pressao: "", sulco: "", detalhe: "" });
  function abrir(tipo: ManutencaoFrota["classe"]) {
    setClasse(tipo);
    setForm({ veiculoId: veiculos[0]?.id ?? "", item: ITENS[tipo][0], data: hoje(), km: String(veiculos[0]?.km ?? ""), proximaData: "", proximoKm: "", oficina: "", diasParada: "", custo: "", pressao: "", sulco: "", detalhe: "" });
  }
  return (
    <div className="mt-4">
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => abrir("preventiva")} className="inline-flex h-11 items-center rounded-xl bg-pine px-4 text-sm font-medium text-sheet">Preventiva</button>
        <button type="button" onClick={() => abrir("corretiva")} className="inline-flex h-11 items-center rounded-xl border border-line px-4 text-sm font-medium text-ink">Corretiva</button>
        <button type="button" onClick={() => abrir("pneu")} className="inline-flex h-11 items-center rounded-xl border border-line px-4 text-sm font-medium text-ink">Pneus</button>
      </div>
      <ul className="mt-4 flex flex-col gap-2">
        {itens.length === 0 && <li className="text-sm text-muted">Nenhuma manutenção lançada.</li>}
        {itens.map((item, indice) => (
          <li key={item.id} className={"rounded-2xl px-4 py-3 " + (indice % 2 ? "bg-sheet" : "bg-pine-soft/40")}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-ink">{placa(item.veiculoId)} · {item.item}</p>
                <p className="text-sm text-muted">{item.classe} · {dataTexto(item.data)} · {kmTexto(item.km)}{item.oficina ? ` · ${item.oficina}` : ""}{item.custo ? ` · ${reais(item.custo)}` : ""}</p>
                {item.classe === "corretiva" && item.diasParada > 0 && <p className="text-sm text-muted">{item.diasParada} dia(s) parado</p>}
                {item.classe === "pneu" && <p className="text-sm text-muted">{[item.pressao && `${item.pressao} psi`, item.sulco && `sulco ${item.sulco} mm`, item.detalhe].filter(Boolean).join(" · ")}</p>}
                {(item.proximaData || item.proximoKm != null) && <p className="text-sm text-muted">Próxima: {[item.proximaData && dataTexto(item.proximaData), item.proximoKm != null && kmTexto(item.proximoKm)].filter(Boolean).join(" ou ")}</p>}
                {item.detalhe && item.classe !== "pneu" && <p className="text-sm text-muted">{item.detalhe}</p>}
              </div>
              <button type="button" onClick={() => pedir(`Excluir ${item.item}?`, () => { void excluirManutencao({ data: { id: item.id, veiculoId: item.veiculoId, equipeId } }).then(() => { onToast("Manutenção excluída."); carregar(); }).catch((err: unknown) => falha(err, "Não foi possível excluir.")); })} className="text-sm font-medium text-seal">Excluir</button>
            </div>
          </li>
        ))}
      </ul>
      {classe && (
        <Modal titulo={classe === "preventiva" ? "Preventiva" : classe === "corretiva" ? "Corretiva" : "Pneus"} onFechar={() => setClasse(null)}>
          <form className="flex flex-col gap-3" onSubmit={(evento) => { evento.preventDefault(); void salvarManutencao({ data: { ...form, classe, equipeId, km: Number(form.km || 0), proximoKm: form.proximoKm ? Number(form.proximoKm) : null, diasParada: Number(form.diasParada || 0), custo: centavosDe(form.custo) } }).then(() => { setClasse(null); onToast("Manutenção lançada."); carregar(); }).catch((err: unknown) => falha(err, "Não foi possível lançar.")); }}>
            <Campo nome="Veículo"><select value={form.veiculoId} onChange={(evento) => setForm({ ...form, veiculoId: evento.target.value })} className={campo}>{veiculos.map((item) => <option key={item.id} value={item.id}>{item.placa}</option>)}</select></Campo>
            <Campo nome="Serviço"><select value={form.item} onChange={(evento) => setForm({ ...form, item: evento.target.value })} className={campo}>{ITENS[classe].map((item) => <option key={item}>{item}</option>)}</select></Campo>
            <div className="grid grid-cols-2 gap-3">
              <Campo nome="Data"><input type="date" value={form.data} onChange={(evento) => setForm({ ...form, data: evento.target.value })} className={campo} required /></Campo>
              <Campo nome="Quilometragem"><input value={form.km} onChange={(evento) => setForm({ ...form, km: evento.target.value })} inputMode="numeric" className={campo} autoComplete="off" /></Campo>
            </div>
            {classe === "preventiva" && (
              <div className="grid grid-cols-2 gap-3">
                <Campo nome="Próxima data"><input type="date" value={form.proximaData} onChange={(evento) => setForm({ ...form, proximaData: evento.target.value })} className={campo} /></Campo>
                <Campo nome="Próxima km"><input value={form.proximoKm} onChange={(evento) => setForm({ ...form, proximoKm: evento.target.value })} inputMode="numeric" className={campo} autoComplete="off" /></Campo>
              </div>
            )}
            {classe === "corretiva" && (
              <div className="grid grid-cols-2 gap-3">
                <Campo nome="Oficina"><input value={form.oficina} onChange={(evento) => setForm({ ...form, oficina: evento.target.value })} className={campo} autoComplete="off" /></Campo>
                <Campo nome="Dias parado"><input value={form.diasParada} onChange={(evento) => setForm({ ...form, diasParada: evento.target.value })} inputMode="numeric" className={campo} autoComplete="off" /></Campo>
              </div>
            )}
            {classe === "pneu" && (
              <div className="grid grid-cols-2 gap-3">
                <Campo nome="Calibragem (psi)"><input value={form.pressao} onChange={(evento) => setForm({ ...form, pressao: evento.target.value })} className={campo} autoComplete="off" /></Campo>
                <Campo nome="Sulco (mm)"><input value={form.sulco} onChange={(evento) => setForm({ ...form, sulco: evento.target.value })} className={campo} autoComplete="off" /></Campo>
              </div>
            )}
            <Campo nome="Custo (R$)"><input value={form.custo} onChange={(evento) => setForm({ ...form, custo: evento.target.value })} inputMode="decimal" className={campo} autoComplete="off" /></Campo>
            <Campo nome="Detalhe"><input value={form.detalhe} onChange={(evento) => setForm({ ...form, detalhe: evento.target.value })} className={campo} autoComplete="off" /></Campo>
            <button type="submit" className="mt-1 inline-flex h-11 items-center justify-center rounded-xl bg-pine text-sm font-medium text-sheet">Salvar</button>
          </form>
        </Modal>
      )}
    </div>
  );
}

function AbaRotas({ equipeId, veiculos, condutores, saidas, onToast, falha, carregar }: { equipeId: string | null; veiculos: VeiculoFrota[]; condutores: CondutorFrota[]; saidas: SaidaFrota[]; onToast: (texto: string) => void; falha: (err: unknown, padrao: string) => void; carregar: () => void }) {
  const [saidaDe, setSaidaDe] = useState<VeiculoFrota | null>(null);
  const [retornoDe, setRetornoDe] = useState<SaidaFrota | null>(null);
  const [form, setForm] = useState({ condutorId: "", motorista: "", destino: "", motivo: "", finalidade: "Outro", cliente: "", carga: "", ordem: "", saidaEm: hoje(), horaSaida: "", kmSaida: "" });
  const [volta, setVolta] = useState({ retornoEm: hoje(), horaRetorno: "", kmRetorno: "", velocidade: "", freadas: "", ocioso: "", desvio: "" });
  return (
    <div className="mt-4">
      <p className="mb-3 text-sm text-muted">O diário de bordo registra a viagem. Velocidade, freadas e motor ocioso são lançados no retorno. Não há rastreador ao vivo.</p>
      <ul className="grid gap-3 md:grid-cols-2">
        {veiculos.filter((item) => item.situacao !== "baixado").map((item) => {
          const aberta = saidas.find((saida) => saida.veiculoId === item.id && !saida.retornoEm);
          return (
            <li key={item.id} className="rounded-2xl border border-line bg-sheet p-4">
              <p className="font-display text-2xl text-ink">{item.placa}</p>
              <p className="text-sm text-muted">{kmTexto(item.km)} · {rotuloSituacao(item.situacao)}</p>
              {aberta && <p className="mt-2 text-sm text-muted">Saiu {dataTexto(aberta.saidaEm)}{aberta.horaSaida ? ` ${aberta.horaSaida}` : ""} com {aberta.motorista}. {aberta.finalidade ? `${aberta.finalidade}. ` : ""}{aberta.destino}</p>}
              <div className="mt-3">
                {!aberta && item.situacao === "disponivel" && <button type="button" onClick={() => { setSaidaDe(item); setForm({ condutorId: "", motorista: "", destino: "", motivo: "", finalidade: "Outro", cliente: "", carga: "", ordem: "", saidaEm: hoje(), horaSaida: "", kmSaida: String(item.km) }); }} className="inline-flex h-10 items-center rounded-xl bg-pine px-3 text-sm font-medium text-sheet">Registrar saída</button>}
                {aberta && <button type="button" onClick={() => { setRetornoDe(aberta); setVolta({ retornoEm: hoje(), horaRetorno: "", kmRetorno: String(aberta.kmSaida), velocidade: "", freadas: "", ocioso: "", desvio: "" }); }} className="inline-flex h-10 items-center rounded-xl bg-ink px-3 text-sm font-medium text-sheet">Registrar retorno</button>}
              </div>
            </li>
          );
        })}
      </ul>
      <ul className="mt-4 flex flex-col gap-2">
        {saidas.slice(0, 12).map((item, indice) => (
          <li key={item.id} className={"rounded-2xl px-4 py-3 text-sm text-muted " + (indice % 2 ? "bg-sheet" : "bg-pine-soft/40")}>
            <span className="font-medium text-ink">{veiculos.find((veiculo) => veiculo.id === item.veiculoId)?.placa}</span> · {dataTexto(item.saidaEm)}{item.horaSaida ? ` ${item.horaSaida}` : ""} → {item.retornoEm ? `${dataTexto(item.retornoEm)}${item.horaRetorno ? ` ${item.horaRetorno}` : ""}` : "em aberto"} · {item.destino}
            {item.finalidade ? ` · ${item.finalidade}` : ""}{item.cliente ? ` · ${item.cliente}` : ""}{item.carga ? ` · carga ${item.carga}` : ""}{item.ordem ? ` · OS ${item.ordem}` : ""}
            {item.velocidade != null ? ` · ${item.velocidade} km/h` : ""}{item.freadas != null ? ` · ${item.freadas} freadas` : ""}{item.ocioso != null ? ` · ${item.ocioso} min ocioso` : ""}{item.desvio ? ` · desvio: ${item.desvio}` : ""}
          </li>
        ))}
      </ul>
      {saidaDe && (
        <Modal titulo={`Saída · ${saidaDe.placa}`} onFechar={() => setSaidaDe(null)}>
          <form className="flex flex-col gap-3" onSubmit={(evento) => { evento.preventDefault(); void registrarSaida({ data: { veiculoId: saidaDe.id, equipeId, ...form, kmSaida: Number(form.kmSaida) } }).then(() => { setSaidaDe(null); onToast("Saída registrada."); carregar(); }).catch((err: unknown) => falha(err, "Não foi possível registrar a saída.")); }}>
            <Campo nome="Condutor"><select value={form.condutorId} onChange={(evento) => { const escolhido = condutores.find((item) => item.id === evento.target.value); setForm({ ...form, condutorId: evento.target.value, motorista: escolhido?.nome ?? form.motorista }); }} className={campo}><option value="">Informar o nome</option>{condutores.map((item) => <option key={item.id} value={item.id}>{item.nome}</option>)}</select></Campo>
            <Campo nome="Motorista"><input value={form.motorista} onChange={(evento) => setForm({ ...form, motorista: evento.target.value })} className={campo} required autoComplete="off" /></Campo>
            <Campo nome="Finalidade"><select value={form.finalidade} onChange={(evento) => setForm({ ...form, finalidade: evento.target.value })} className={campo}>{FINALIDADES.map((item) => <option key={item}>{item}</option>)}</select></Campo>
            <Campo nome="Destino"><input value={form.destino} onChange={(evento) => setForm({ ...form, destino: evento.target.value })} className={campo} required autoComplete="off" /></Campo>
            {form.finalidade === "Cliente" && <Campo nome="Cliente"><input value={form.cliente} onChange={(evento) => setForm({ ...form, cliente: evento.target.value })} className={campo} autoComplete="off" /></Campo>}
            {form.finalidade === "Carga" && <Campo nome="Carga"><input value={form.carga} onChange={(evento) => setForm({ ...form, carga: evento.target.value })} className={campo} autoComplete="off" /></Campo>}
            {form.finalidade === "Entrega" && <Campo nome="Entrega"><input value={form.carga} onChange={(evento) => setForm({ ...form, carga: evento.target.value })} className={campo} autoComplete="off" /></Campo>}
            {form.finalidade === "Ordem de serviço" && <Campo nome="Ordem de serviço"><input value={form.ordem} onChange={(evento) => setForm({ ...form, ordem: evento.target.value })} className={campo} autoComplete="off" /></Campo>}
            <Campo nome="Motivo"><input value={form.motivo} onChange={(evento) => setForm({ ...form, motivo: evento.target.value })} className={campo} autoComplete="off" /></Campo>
            <div className="grid grid-cols-2 gap-3">
              <Campo nome="Data"><input type="date" value={form.saidaEm} onChange={(evento) => setForm({ ...form, saidaEm: evento.target.value })} className={campo} required /></Campo>
              <Campo nome="Hora"><input type="time" value={form.horaSaida} onChange={(evento) => setForm({ ...form, horaSaida: evento.target.value })} className={campo} /></Campo>
            </div>
            <Campo nome="Quilometragem"><input value={form.kmSaida} onChange={(evento) => setForm({ ...form, kmSaida: evento.target.value })} inputMode="numeric" className={campo} required autoComplete="off" /></Campo>
            <button type="submit" className="mt-1 inline-flex h-11 items-center justify-center rounded-xl bg-pine text-sm font-medium text-sheet">Registrar saída</button>
          </form>
        </Modal>
      )}
      {retornoDe && (
        <Modal titulo="Retorno" onFechar={() => setRetornoDe(null)}>
          <form className="flex flex-col gap-3" onSubmit={(evento) => { evento.preventDefault(); void registrarRetorno({ data: { saidaId: retornoDe.id, equipeId, retornoEm: volta.retornoEm, horaRetorno: volta.horaRetorno, kmRetorno: Number(volta.kmRetorno), velocidade: volta.velocidade ? Number(volta.velocidade) : null, freadas: volta.freadas ? Number(volta.freadas) : null, ocioso: volta.ocioso ? Number(volta.ocioso) : null, desvio: volta.desvio } }).then(() => { setRetornoDe(null); onToast("Retorno registrado."); carregar(); }).catch((err: unknown) => falha(err, "Não foi possível registrar o retorno.")); }}>
            <div className="grid grid-cols-2 gap-3">
              <Campo nome="Data"><input type="date" value={volta.retornoEm} onChange={(evento) => setVolta({ ...volta, retornoEm: evento.target.value })} className={campo} required /></Campo>
              <Campo nome="Hora"><input type="time" value={volta.horaRetorno} onChange={(evento) => setVolta({ ...volta, horaRetorno: evento.target.value })} className={campo} /></Campo>
            </div>
            <Campo nome="Quilometragem"><input value={volta.kmRetorno} onChange={(evento) => setVolta({ ...volta, kmRetorno: evento.target.value })} inputMode="numeric" className={campo} required autoComplete="off" /></Campo>
            <div className="grid grid-cols-3 gap-3">
              <Campo nome="Velocidade"><input value={volta.velocidade} onChange={(evento) => setVolta({ ...volta, velocidade: evento.target.value })} inputMode="numeric" className={campo} autoComplete="off" /></Campo>
              <Campo nome="Freadas"><input value={volta.freadas} onChange={(evento) => setVolta({ ...volta, freadas: evento.target.value })} inputMode="numeric" className={campo} autoComplete="off" /></Campo>
              <Campo nome="Ocioso (min)"><input value={volta.ocioso} onChange={(evento) => setVolta({ ...volta, ocioso: evento.target.value })} inputMode="numeric" className={campo} autoComplete="off" /></Campo>
            </div>
            <Campo nome="Desvio de rota"><input value={volta.desvio} onChange={(evento) => setVolta({ ...volta, desvio: evento.target.value })} className={campo} autoComplete="off" /></Campo>
            <button type="submit" className="mt-1 inline-flex h-11 items-center justify-center rounded-xl bg-pine text-sm font-medium text-sheet">Registrar retorno</button>
          </form>
        </Modal>
      )}
    </div>
  );
}

function AbaOcorrencias({ equipeId, veiculos, condutores, multas, sinistros, placa, nomeCondutor, onToast, falha, carregar, pedir }: { equipeId: string | null; veiculos: VeiculoFrota[]; condutores: CondutorFrota[]; multas: MultaFrota[]; sinistros: SinistroFrota[]; placa: (id: string) => string; nomeCondutor: (id: string) => string; onToast: (texto: string) => void; falha: (err: unknown, padrao: string) => void; carregar: () => void; pedir: (texto: string, aoConfirmar: () => void) => void }) {
  const [qual, setQual] = useState<"multa" | "sinistro" | null>(null);
  const [multa, setMulta] = useState({ veiculoId: "", condutorId: "", data: hoje(), local: "", gravidade: "Leve", valor: "", desconto: false, pontos: "0" });
  const [sinistro, setSinistro] = useState({ veiculoId: "", condutorId: "", data: hoje(), boletim: "", avaria: "", custo: "", relato: "" });
  return (
    <div className="mt-4">
      <div className="flex gap-2">
        <button type="button" onClick={() => { setMulta({ veiculoId: veiculos[0]?.id ?? "", condutorId: "", data: hoje(), local: "", gravidade: "Leve", valor: "", desconto: false, pontos: "0" }); setQual("multa"); }} className="inline-flex h-11 items-center rounded-xl bg-pine px-4 text-sm font-medium text-sheet">Nova multa</button>
        <button type="button" onClick={() => { setSinistro({ veiculoId: veiculos[0]?.id ?? "", condutorId: "", data: hoje(), boletim: "", avaria: "", custo: "", relato: "" }); setQual("sinistro"); }} className="inline-flex h-11 items-center rounded-xl border border-line px-4 text-sm font-medium text-ink">Novo sinistro</button>
      </div>
      <h2 className="mt-5 font-display text-2xl text-ink">Multas</h2>
      <ul className="mt-2 flex flex-col gap-2">
        {multas.length === 0 && <li className="text-sm text-muted">Nenhuma multa.</li>}
        {multas.map((item, indice) => (
          <li key={item.id} className={"flex items-start justify-between gap-3 rounded-2xl px-4 py-3 " + (indice % 2 ? "bg-sheet" : "bg-pine-soft/40")}>
            <div>
              <p className="text-sm font-medium text-ink">{placa(item.veiculoId)} · {item.gravidade}</p>
              <p className="text-sm text-muted">{dataTexto(item.data)} · {item.local} · {reais(item.valor)} · {item.pontos} pts{item.desconto ? " · desconto em folha" : ""}{nomeCondutor(item.condutorId) ? ` · ${nomeCondutor(item.condutorId)}` : ""}</p>
            </div>
            <button type="button" onClick={() => pedir("Excluir esta multa? Os pontos saem da CNH do condutor.", () => { void excluirMulta({ data: { id: item.id, veiculoId: item.veiculoId, equipeId } }).then(() => { onToast("Multa excluída."); carregar(); }).catch((err: unknown) => falha(err, "Não foi possível excluir.")); })} className="text-sm font-medium text-seal">Excluir</button>
          </li>
        ))}
      </ul>
      <h2 className="mt-5 font-display text-2xl text-ink">Sinistros</h2>
      <ul className="mt-2 flex flex-col gap-2">
        {sinistros.length === 0 && <li className="text-sm text-muted">Nenhum sinistro.</li>}
        {sinistros.map((item, indice) => (
          <li key={item.id} className={"flex items-start justify-between gap-3 rounded-2xl px-4 py-3 " + (indice % 2 ? "bg-sheet" : "bg-pine-soft/40")}>
            <div>
              <p className="text-sm font-medium text-ink">{placa(item.veiculoId)} · {item.avaria}</p>
              <p className="text-sm text-muted">{dataTexto(item.data)}{item.boletim ? ` · BO ${item.boletim}` : ""}{item.custo ? ` · ${reais(item.custo)}` : ""}{nomeCondutor(item.condutorId) ? ` · ${nomeCondutor(item.condutorId)}` : ""}</p>
              {item.relato && <p className="text-sm text-muted">{item.relato}</p>}
            </div>
            <button type="button" onClick={() => pedir("Excluir este sinistro?", () => { void excluirSinistro({ data: { id: item.id, veiculoId: item.veiculoId, equipeId } }).then(() => { onToast("Sinistro excluído."); carregar(); }).catch((err: unknown) => falha(err, "Não foi possível excluir.")); })} className="text-sm font-medium text-seal">Excluir</button>
          </li>
        ))}
      </ul>
      {qual === "multa" && (
        <Modal titulo="Multa" onFechar={() => setQual(null)}>
          <form className="flex flex-col gap-3" onSubmit={(evento) => { evento.preventDefault(); void salvarMulta({ data: { ...multa, equipeId, valor: centavosDe(multa.valor), pontos: Number(multa.pontos || 0) } }).then(() => { setQual(null); onToast("Multa lançada e pontos somados na CNH."); carregar(); }).catch((err: unknown) => falha(err, "Não foi possível lançar.")); }}>
            <Campo nome="Veículo"><select value={multa.veiculoId} onChange={(evento) => setMulta({ ...multa, veiculoId: evento.target.value })} className={campo}>{veiculos.map((item) => <option key={item.id} value={item.id}>{item.placa}</option>)}</select></Campo>
            <Campo nome="Condutor"><select value={multa.condutorId} onChange={(evento) => setMulta({ ...multa, condutorId: evento.target.value })} className={campo}><option value="">Sem condutor</option>{condutores.map((item) => <option key={item.id} value={item.id}>{item.nome}</option>)}</select></Campo>
            <Campo nome="Data"><input type="date" value={multa.data} onChange={(evento) => setMulta({ ...multa, data: evento.target.value })} className={campo} required /></Campo>
            <Campo nome="Local"><input value={multa.local} onChange={(evento) => setMulta({ ...multa, local: evento.target.value })} className={campo} required autoComplete="off" /></Campo>
            <Campo nome="Gravidade"><select value={multa.gravidade} onChange={(evento) => setMulta({ ...multa, gravidade: evento.target.value })} className={campo}>{GRAVIDADES.map((item) => <option key={item}>{item}</option>)}</select></Campo>
            <div className="grid grid-cols-2 gap-3">
              <Campo nome="Valor (R$)"><input value={multa.valor} onChange={(evento) => setMulta({ ...multa, valor: evento.target.value })} inputMode="decimal" className={campo} autoComplete="off" /></Campo>
              <Campo nome="Pontos na CNH"><input value={multa.pontos} onChange={(evento) => setMulta({ ...multa, pontos: evento.target.value.replace(/\D/g, "") })} inputMode="numeric" className={campo} autoComplete="off" /></Campo>
            </div>
            <label className="flex items-center gap-2 text-sm text-ink"><input type="checkbox" checked={multa.desconto} onChange={(evento) => setMulta({ ...multa, desconto: evento.target.checked })} />Desconto em folha</label>
            <button type="submit" className="mt-1 inline-flex h-11 items-center justify-center rounded-xl bg-pine text-sm font-medium text-sheet">Salvar</button>
          </form>
        </Modal>
      )}
      {qual === "sinistro" && (
        <Modal titulo="Sinistro" onFechar={() => setQual(null)}>
          <form className="flex flex-col gap-3" onSubmit={(evento) => { evento.preventDefault(); void salvarSinistro({ data: { ...sinistro, equipeId, custo: centavosDe(sinistro.custo) } }).then(() => { setQual(null); onToast("Sinistro lançado."); carregar(); }).catch((err: unknown) => falha(err, "Não foi possível lançar.")); }}>
            <Campo nome="Veículo"><select value={sinistro.veiculoId} onChange={(evento) => setSinistro({ ...sinistro, veiculoId: evento.target.value })} className={campo}>{veiculos.map((item) => <option key={item.id} value={item.id}>{item.placa}</option>)}</select></Campo>
            <Campo nome="Condutor"><select value={sinistro.condutorId} onChange={(evento) => setSinistro({ ...sinistro, condutorId: evento.target.value })} className={campo}><option value="">Sem condutor</option>{condutores.map((item) => <option key={item.id} value={item.id}>{item.nome}</option>)}</select></Campo>
            <Campo nome="Data"><input type="date" value={sinistro.data} onChange={(evento) => setSinistro({ ...sinistro, data: evento.target.value })} className={campo} required /></Campo>
            <Campo nome="Boletim de ocorrência"><input value={sinistro.boletim} onChange={(evento) => setSinistro({ ...sinistro, boletim: evento.target.value })} className={campo} autoComplete="off" /></Campo>
            <Campo nome="Avaria"><input value={sinistro.avaria} onChange={(evento) => setSinistro({ ...sinistro, avaria: evento.target.value })} className={campo} required autoComplete="off" /></Campo>
            <Campo nome="Custo do reparo (R$)"><input value={sinistro.custo} onChange={(evento) => setSinistro({ ...sinistro, custo: evento.target.value })} inputMode="decimal" className={campo} autoComplete="off" /></Campo>
            <Campo nome="Relato"><textarea value={sinistro.relato} onChange={(evento) => setSinistro({ ...sinistro, relato: evento.target.value })} className={campo + " h-20 py-2"} /></Campo>
            <button type="submit" className="mt-1 inline-flex h-11 items-center justify-center rounded-xl bg-pine text-sm font-medium text-sheet">Salvar</button>
          </form>
        </Modal>
      )}
    </div>
  );
}

function CartaoUso({
  item,
  placa,
  kmAtual,
  equipeId,
  onToast,
  falha,
  carregar,
}: {
  item: AgendamentoFrota;
  placa: string;
  kmAtual: number;
  equipeId: string | null;
  onToast: (texto: string) => void;
  falha: (err: unknown, padrao: string) => void;
  carregar: () => void;
}) {
  const [aberto, setAberto] = useState<"saida" | "retorno" | null>(item.horaSaida ? "retorno" : "saida");
  const [hora, setHora] = useState(agoraLocal().hora);
  const [km, setKm] = useState(String(item.kmSaida ?? kmAtual));
  return (
    <article className="mb-4 rounded-2xl border border-line bg-sheet p-4">
      <p className="text-sm font-medium text-pine">Seu horário agora</p>
      <p className="mt-1 font-display text-2xl text-ink">{placa}</p>
      <p className="text-sm text-muted">
        {dataTexto(item.dia)} · {item.horaInicio} às {item.horaFim}
        {item.horaSaida ? ` · saiu às ${item.horaSaida}` : ""}
      </p>
      {aberto && (
        <form
          className="mt-3 flex flex-col gap-3"
          onSubmit={(evento) => {
            evento.preventDefault();
            const pedido = aberto === "saida"
              ? lancarSaidaAgendada({ data: { id: item.id, equipeId, horaSaida: hora, kmSaida: Number(km) } })
              : lancarRetornoAgendado({ data: { id: item.id, equipeId, horaRetorno: hora, kmRetorno: Number(km) } });
            void pedido
              .then(() => {
                onToast(aberto === "saida" ? "Saída lançada." : "Retorno lançado.");
                setAberto(null);
                carregar();
              })
              .catch((err: unknown) => falha(err, "Não foi possível lançar."));
          }}
        >
          <div className="grid grid-cols-2 gap-3">
            <Campo nome={aberto === "saida" ? "Hora da saída" : "Hora do retorno"}>
              <input type="time" value={hora} onChange={(evento) => setHora(evento.target.value)} className={campo} required />
            </Campo>
            <Campo nome="Quilometragem">
              <input value={km} onChange={(evento) => setKm(evento.target.value)} inputMode="numeric" className={campo} required autoComplete="off" />
            </Campo>
          </div>
          <button type="submit" className="inline-flex h-11 items-center justify-center rounded-xl bg-pine text-sm font-medium text-sheet">
            {aberto === "saida" ? "Lançar saída" : "Lançar retorno"}
          </button>
        </form>
      )}
    </article>
  );
}

function PaginaAgenda({
  equipeId,
  usuarioNome,
  veiculos,
  agendamentos,
  agora,
  onVoltar,
  onToast,
  falha,
  carregar,
  pedir,
  dialogo,
}: {
  equipeId: string | null;
  usuarioNome: string;
  veiculos: VeiculoFrota[];
  agendamentos: AgendamentoFrota[];
  agora: { dia: string; hora: string };
  onVoltar: () => void;
  onToast: (texto: string) => void;
  falha: (err: unknown, padrao: string) => void;
  carregar: () => void;
  pedir: (texto: string, aoConfirmar: () => void) => void;
  dialogo: ReactNode;
}) {
  const [dia, setDia] = useState(agora.dia);
  const [aberto, setAberto] = useState(false);
  const [form, setForm] = useState({ veiculoId: veiculos[0]?.id ?? "", dia: agora.dia, horaInicio: "08:00", horaFim: "12:00" });
  const doDia = agendamentos.filter((item) => item.dia === dia).sort((a, b) => a.horaInicio.localeCompare(b.horaInicio));
  return (
    <div className="mt-4">
      {dialogo}
      <button type="button" onClick={onVoltar} className="text-sm font-medium text-pine">
        Voltar
      </button>
      <h2 className="mt-2 font-display text-3xl text-ink">Agendamento</h2>
      <p className="mt-1 text-sm text-muted">Veja o dia e a hora de cada veículo e marque o seu uso.</p>
      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        <input type="date" value={dia} onChange={(evento) => setDia(evento.target.value)} className={campo} />
        <button
          type="button"
          onClick={() => {
            setForm({ veiculoId: veiculos[0]?.id ?? "", dia, horaInicio: "08:00", horaFim: "12:00" });
            setAberto(true);
          }}
          className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-pine px-4 text-sm font-medium text-sheet"
        >
          <Plus className="size-4" />
          Agendar
        </button>
      </div>
      <ul className="mt-4 flex flex-col gap-2">
        {doDia.length === 0 && <li className="text-sm text-muted">Nenhum veículo agendado neste dia.</li>}
        {doDia.map((item, indice) => {
          const placa = veiculos.find((veiculo) => veiculo.id === item.veiculoId)?.placa ?? "Veículo";
          return (
            <li key={item.id} className={"flex items-start justify-between gap-3 rounded-2xl px-4 py-3 " + (indice % 2 ? "bg-sheet" : "bg-pine-soft/40")}>
              <div>
                <p className="text-sm font-medium text-ink">{placa} · {item.horaInicio} às {item.horaFim}</p>
                <p className="text-sm text-muted">
                  {item.nome}
                  {item.horaSaida ? ` · saiu ${item.horaSaida}` : ""}
                  {item.kmSaida != null ? ` · ${kmTexto(item.kmSaida)}` : ""}
                  {item.horaRetorno ? ` · voltou ${item.horaRetorno}` : ""}
                  {item.kmRetorno != null ? ` · ${kmTexto(item.kmRetorno)}` : ""}
                </p>
              </div>
              {!item.horaSaida && (
                <button
                  type="button"
                  onClick={() =>
                    pedir(`Desmarcar ${placa} das ${item.horaInicio} às ${item.horaFim}?`, () => {
                      void excluirAgendamento({ data: { id: item.id, veiculoId: item.veiculoId, equipeId } })
                        .then(() => {
                          onToast("Agendamento desmarcado.");
                          carregar();
                        })
                        .catch((err: unknown) => falha(err, "Não foi possível desmarcar."));
                    })
                  }
                  className="text-sm font-medium text-seal"
                >
                  Desmarcar
                </button>
              )}
            </li>
          );
        })}
      </ul>
      {aberto && (
        <Modal titulo="Novo agendamento" onFechar={() => setAberto(false)}>
          <form
            className="flex flex-col gap-3"
            onSubmit={(evento) => {
              evento.preventDefault();
              void salvarAgendamento({ data: { ...form, equipeId, nome: usuarioNome } })
                .then(() => {
                  setAberto(false);
                  setDia(form.dia);
                  onToast("Horário agendado.");
                  carregar();
                })
                .catch((err: unknown) => falha(err, "Não foi possível agendar."));
            }}
          >
            <Campo nome="Veículo">
              <select value={form.veiculoId} onChange={(evento) => setForm({ ...form, veiculoId: evento.target.value })} className={campo}>
                {veiculos.map((item) => (
                  <option key={item.id} value={item.id}>{item.placa}</option>
                ))}
              </select>
            </Campo>
            <Campo nome="Dia">
              <input type="date" value={form.dia} onChange={(evento) => setForm({ ...form, dia: evento.target.value })} className={campo} required />
            </Campo>
            <div className="grid grid-cols-2 gap-3">
              <Campo nome="Início">
                <input type="time" value={form.horaInicio} onChange={(evento) => setForm({ ...form, horaInicio: evento.target.value })} className={campo} required />
              </Campo>
              <Campo nome="Término">
                <input type="time" value={form.horaFim} onChange={(evento) => setForm({ ...form, horaFim: evento.target.value })} className={campo} required />
              </Campo>
            </div>
            <button type="submit" className="mt-1 inline-flex h-11 items-center justify-center rounded-xl bg-pine text-sm font-medium text-sheet">
              Agendar
            </button>
          </form>
        </Modal>
      )}
    </div>
  );
}

const campo = "h-11 w-full rounded-xl border border-line bg-paper px-3 text-sm font-normal text-ink";

function Campo({ nome, children }: { nome: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-sm font-medium text-ink">
      {nome}
      {children}
    </label>
  );
}

function Resumo({ valor, rotulo }: { valor: number; rotulo: string }) {
  return (
    <article className="rounded-2xl border border-line bg-sheet p-4">
      <p className="font-display text-3xl text-ink">{valor}</p>
      <p className="text-sm text-muted">{rotulo}</p>
    </article>
  );
}

function Modal({ titulo, onFechar, children }: { titulo: string; onFechar: () => void; children: ReactNode }) {
  return createPortal(
    <div className="fixed inset-0 z-[100] grid place-items-center bg-ink/50 p-4" role="dialog" aria-modal="true">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-line bg-sheet p-5 shadow-xl">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="font-display text-2xl text-ink">{titulo}</h2>
          <button type="button" onClick={onFechar} className="text-sm font-medium text-muted">Fechar</button>
        </div>
        {children}
      </div>
    </div>,
    document.body,
  );
}
