import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Plus } from "lucide-react";
import { useConfirmarExclusao } from "@/components/confirmar-exclusao";
import {
  excluirVeiculo,
  listarFrotas,
  registrarRetorno,
  registrarSaida,
  salvarVeiculo,
  type SaidaFrota,
  type SituacaoFrota,
  type VeiculoFrota,
} from "@/lib/frotas.functions";

const TIPOS = ["Carro", "Moto", "Van", "Caminhão", "Ônibus", "Outro"];
const COMBUSTIVEIS = ["Flex", "Gasolina", "Etanol", "Diesel", "Elétrico"];
const SITUACOES: { id: SituacaoFrota; nome: string }[] = [
  { id: "disponivel", nome: "Disponível" },
  { id: "em_uso", nome: "Em uso" },
  { id: "manutencao", nome: "Manutenção" },
  { id: "baixado", nome: "Baixado" },
];

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
  if (!ano || !mes || !dia) return valor;
  return `${dia}/${mes}/${ano}`;
}

const vazio = {
  id: "",
  placa: "",
  descricao: "",
  ano: "",
  tipo: "Carro",
  combustivel: "Flex",
  km: "",
  situacao: "disponivel" as SituacaoFrota,
  setor: "",
};

export function FrotasPainel({ equipeId, onToast }: { equipeId: string | null; onToast: (texto: string) => void }) {
  const [veiculos, setVeiculos] = useState<VeiculoFrota[]>([]);
  const [saidas, setSaidas] = useState<SaidaFrota[]>([]);
  const [busca, setBusca] = useState("");
  const [form, setForm] = useState(vazio);
  const [aberto, setAberto] = useState(false);
  const [saidaDe, setSaidaDe] = useState<VeiculoFrota | null>(null);
  const [retornoDe, setRetornoDe] = useState<SaidaFrota | null>(null);
  const [motorista, setMotorista] = useState("");
  const [destino, setDestino] = useState("");
  const [motivo, setMotivo] = useState("");
  const [dataSaida, setDataSaida] = useState("");
  const [kmSaida, setKmSaida] = useState("");
  const [dataRetorno, setDataRetorno] = useState("");
  const [kmRetorno, setKmRetorno] = useState("");
  const exclusao = useConfirmarExclusao();

  function carregar() {
    void listarFrotas({ data: { equipeId } })
      .then((pacote) => {
        setVeiculos(pacote.veiculos);
        setSaidas(pacote.saidas);
      })
      .catch((err: unknown) => onToast(err instanceof Error ? err.message : "Não foi possível carregar a frota."));
  }

  useEffect(() => {
    carregar();
  }, [equipeId]);

  function falha(err: unknown, padrao: string) {
    onToast(err instanceof Error ? err.message : padrao);
  }

  const termo = busca.trim().toLowerCase();
  const lista = veiculos.filter((item) => {
    if (!termo) return true;
    return [item.placa, item.descricao, item.setor, item.tipo].join(" ").toLowerCase().includes(termo);
  });
  const contagem = {
    disponivel: veiculos.filter((item) => item.situacao === "disponivel").length,
    em_uso: veiculos.filter((item) => item.situacao === "em_uso").length,
    manutencao: veiculos.filter((item) => item.situacao === "manutencao").length,
  };

  function abrirNovo() {
    setForm(vazio);
    setAberto(true);
  }

  function abrirEdicao(item: VeiculoFrota) {
    setForm({
      id: item.id,
      placa: item.placa,
      descricao: item.descricao,
      ano: item.ano ? String(item.ano) : "",
      tipo: item.tipo,
      combustivel: item.combustivel,
      km: String(item.km),
      situacao: item.situacao,
      setor: item.setor,
    });
    setAberto(true);
  }

  return (
    <div className="mt-4">
      {exclusao.dialogo}
      <div className="grid grid-cols-3 gap-2">
        <Resumo valor={contagem.disponivel} rotulo="Disponíveis" />
        <Resumo valor={contagem.em_uso} rotulo="Em uso" />
        <Resumo valor={contagem.manutencao} rotulo="Manutenção" />
      </div>
      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        <input
          value={busca}
          onChange={(evento) => setBusca(evento.target.value)}
          placeholder="Buscar placa, modelo ou setor"
          className="campo-busca h-12 w-full rounded-xl border border-line px-3 text-sm text-ink placeholder:text-muted"
        />
        <button
          type="button"
          onClick={abrirNovo}
          className="inline-flex h-12 shrink-0 items-center justify-center gap-2 rounded-xl bg-pine px-4 text-sm font-medium text-sheet"
        >
          <Plus className="size-4" />
          Novo veículo
        </button>
      </div>
      <ul className="mt-4 grid gap-3 md:grid-cols-2">
        {lista.length === 0 && <li className="text-sm text-muted">Nenhum veículo nesta lista.</li>}
        {lista.map((item) => {
          const aberta = saidas.find((saida) => saida.veiculoId === item.id && !saida.retornoEm);
          const recentes = saidas.filter((saida) => saida.veiculoId === item.id).slice(0, 3);
          return (
            <li key={item.id} className="flex flex-col rounded-2xl border border-line bg-sheet p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-display text-2xl text-ink">{item.placa}</p>
                  <p className="text-sm text-ink">
                    {item.descricao}
                    {item.ano ? ` · ${item.ano}` : ""}
                  </p>
                  <p className="text-sm text-muted">
                    {item.tipo} · {item.combustivel}
                    {item.setor ? ` · ${item.setor}` : ""}
                  </p>
                </div>
                <span className={"shrink-0 rounded-full px-2 py-1 text-xs font-medium " + tomSituacao(item.situacao)}>
                  {rotuloSituacao(item.situacao)}
                </span>
              </div>
              <p className="mt-3 text-sm text-ink">{kmTexto(item.km)}</p>
              {aberta && (
                <p className="mt-2 text-sm text-muted">
                  Saiu em {dataTexto(aberta.saidaEm)} com {aberta.motorista}, para {aberta.destino}.
                </p>
              )}
              {recentes.length > 0 && (
                <ul className="mt-3 flex flex-col gap-1 border-t border-line pt-3 text-sm text-muted">
                  {recentes.map((saida) => (
                    <li key={saida.id}>
                      {dataTexto(saida.saidaEm)} · {saida.destino}
                      {saida.retornoEm ? ` · voltou ${dataTexto(saida.retornoEm)}` : " · em aberto"}
                    </li>
                  ))}
                </ul>
              )}
              <div className="mt-4 flex flex-wrap gap-2">
                {item.situacao === "disponivel" && (
                  <button
                    type="button"
                    onClick={() => {
                      setSaidaDe(item);
                      setMotorista("");
                      setDestino("");
                      setMotivo("");
                      setDataSaida(new Date().toISOString().slice(0, 10));
                      setKmSaida(String(item.km));
                    }}
                    className="inline-flex h-10 items-center rounded-xl bg-pine px-3 text-sm font-medium text-sheet"
                  >
                    Registrar saída
                  </button>
                )}
                {aberta && (
                  <button
                    type="button"
                    onClick={() => {
                      setRetornoDe(aberta);
                      setDataRetorno(new Date().toISOString().slice(0, 10));
                      setKmRetorno(String(aberta.kmSaida));
                    }}
                    className="inline-flex h-10 items-center rounded-xl bg-ink px-3 text-sm font-medium text-sheet"
                  >
                    Registrar retorno
                  </button>
                )}
                <button type="button" onClick={() => abrirEdicao(item)} className="inline-flex h-10 items-center rounded-xl border border-line px-3 text-sm font-medium text-ink">
                  Editar
                </button>
                <button
                  type="button"
                  onClick={() =>
                    exclusao.pedir(`Excluir o veículo ${item.placa}? As saídas dele também saem.`, () => {
                      void excluirVeiculo({ data: { id: item.id, equipeId } })
                        .then(() => {
                          onToast("Veículo excluído.");
                          carregar();
                        })
                        .catch((err: unknown) => falha(err, "Não foi possível excluir."));
                    })
                  }
                  className="inline-flex h-10 items-center text-sm font-medium text-seal"
                >
                  Excluir
                </button>
              </div>
            </li>
          );
        })}
      </ul>

      {aberto && (
        <Modal titulo={form.id ? "Editar veículo" : "Novo veículo"} onFechar={() => setAberto(false)}>
          <form
            className="flex flex-col gap-3"
            onSubmit={(evento) => {
              evento.preventDefault();
              void salvarVeiculo({
                data: {
                  ...form,
                  ano: form.ano,
                  km: Number(form.km),
                  equipeId,
                },
              })
                .then(() => {
                  setAberto(false);
                  onToast(form.id ? "Veículo atualizado." : "Veículo lançado.");
                  carregar();
                })
                .catch((err: unknown) => falha(err, "Não foi possível salvar o veículo."));
            }}
          >
            <Campo nome="Placa">
              <input value={form.placa} onChange={(evento) => setForm({ ...form, placa: evento.target.value })} className={campo} required autoComplete="off" />
            </Campo>
            <Campo nome="Modelo">
              <input value={form.descricao} onChange={(evento) => setForm({ ...form, descricao: evento.target.value })} className={campo} required autoComplete="off" />
            </Campo>
            <div className="grid grid-cols-2 gap-3">
              <Campo nome="Ano">
                <input value={form.ano} onChange={(evento) => setForm({ ...form, ano: evento.target.value })} inputMode="numeric" className={campo} autoComplete="off" />
              </Campo>
              <Campo nome="Quilometragem">
                <input value={form.km} onChange={(evento) => setForm({ ...form, km: evento.target.value })} inputMode="numeric" className={campo} required autoComplete="off" />
              </Campo>
            </div>
            <Campo nome="Tipo">
              <select value={form.tipo} onChange={(evento) => setForm({ ...form, tipo: evento.target.value })} className={campo}>
                {TIPOS.map((item) => (
                  <option key={item}>{item}</option>
                ))}
              </select>
            </Campo>
            <Campo nome="Combustível">
              <select value={form.combustivel} onChange={(evento) => setForm({ ...form, combustivel: evento.target.value })} className={campo}>
                {COMBUSTIVEIS.map((item) => (
                  <option key={item}>{item}</option>
                ))}
              </select>
            </Campo>
            <Campo nome="Situação">
              <select value={form.situacao} onChange={(evento) => setForm({ ...form, situacao: evento.target.value as SituacaoFrota })} className={campo}>
                {SITUACOES.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.nome}
                  </option>
                ))}
              </select>
            </Campo>
            <Campo nome="Setor">
              <input value={form.setor} onChange={(evento) => setForm({ ...form, setor: evento.target.value })} className={campo} autoComplete="off" />
            </Campo>
            <button type="submit" className="mt-1 inline-flex h-11 items-center justify-center rounded-xl bg-pine text-sm font-medium text-sheet">
              Salvar
            </button>
          </form>
        </Modal>
      )}

      {saidaDe && (
        <Modal titulo={`Saída · ${saidaDe.placa}`} onFechar={() => setSaidaDe(null)}>
          <form
            className="flex flex-col gap-3"
            onSubmit={(evento) => {
              evento.preventDefault();
              void registrarSaida({
                data: { veiculoId: saidaDe.id, equipeId, motorista, destino, motivo, saidaEm: dataSaida, kmSaida: Number(kmSaida) },
              })
                .then(() => {
                  setSaidaDe(null);
                  onToast("Saída registrada.");
                  carregar();
                })
                .catch((err: unknown) => falha(err, "Não foi possível registrar a saída."));
            }}
          >
            <Campo nome="Motorista">
              <input value={motorista} onChange={(evento) => setMotorista(evento.target.value)} className={campo} required autoComplete="off" />
            </Campo>
            <Campo nome="Destino">
              <input value={destino} onChange={(evento) => setDestino(evento.target.value)} className={campo} required autoComplete="off" />
            </Campo>
            <Campo nome="Motivo">
              <input value={motivo} onChange={(evento) => setMotivo(evento.target.value)} className={campo} autoComplete="off" />
            </Campo>
            <Campo nome="Data">
              <input type="date" value={dataSaida} onChange={(evento) => setDataSaida(evento.target.value)} className={campo} required />
            </Campo>
            <Campo nome="Quilometragem">
              <input value={kmSaida} onChange={(evento) => setKmSaida(evento.target.value)} inputMode="numeric" className={campo} required autoComplete="off" />
            </Campo>
            <button type="submit" className="mt-1 inline-flex h-11 items-center justify-center rounded-xl bg-pine text-sm font-medium text-sheet">
              Registrar saída
            </button>
          </form>
        </Modal>
      )}

      {retornoDe && (
        <Modal titulo="Retorno" onFechar={() => setRetornoDe(null)}>
          <form
            className="flex flex-col gap-3"
            onSubmit={(evento) => {
              evento.preventDefault();
              void registrarRetorno({ data: { saidaId: retornoDe.id, equipeId, retornoEm: dataRetorno, kmRetorno: Number(kmRetorno) } })
                .then(() => {
                  setRetornoDe(null);
                  onToast("Retorno registrado.");
                  carregar();
                })
                .catch((err: unknown) => falha(err, "Não foi possível registrar o retorno."));
            }}
          >
            <Campo nome="Data">
              <input type="date" value={dataRetorno} onChange={(evento) => setDataRetorno(evento.target.value)} className={campo} required />
            </Campo>
            <Campo nome="Quilometragem">
              <input value={kmRetorno} onChange={(evento) => setKmRetorno(evento.target.value)} inputMode="numeric" className={campo} required autoComplete="off" />
            </Campo>
            <button type="submit" className="mt-1 inline-flex h-11 items-center justify-center rounded-xl bg-pine text-sm font-medium text-sheet">
              Registrar retorno
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
      <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl border border-line bg-sheet p-5 shadow-xl">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="font-display text-2xl text-ink">{titulo}</h2>
          <button type="button" onClick={onFechar} className="text-sm font-medium text-muted">
            Fechar
          </button>
        </div>
        {children}
      </div>
    </div>,
    document.body,
  );
}
