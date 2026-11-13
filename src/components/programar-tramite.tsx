import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Clock, X } from "lucide-react";
import { pedePrevisao, rotuloNumero, rotuloTipo, statusAdminLabel, type ProcessoAdmin } from "@/lib/admin";
import { cancelarTramiteProgramado, listarAdmin, listarTramitesProgramados, programarTramite } from "@/lib/admin.functions";
import { listaCodigos } from "@/lib/status-catalogo";

const campo = "h-11 w-full rounded-xl border border-line bg-paper px-3 text-sm text-ink";

function horaLocal(iso: string) {
  const data = new Date(iso);
  if (Number.isNaN(data.getTime())) return iso;
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(data);
}

export function BotaoTramite({ equipeId }: { equipeId: string | null }) {
  const [aberto, setAberto] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setAberto(true)}
        className="grid size-11 place-items-center rounded-xl border border-line bg-sheet text-ink"
        aria-label="Programar trâmite"
      >
        <Clock className="size-5" />
      </button>
      {aberto ? <TelaTramite equipeId={equipeId} onFechar={() => setAberto(false)} /> : null}
    </>
  );
}

function TelaTramite({ equipeId, onFechar }: { equipeId: string | null; onFechar: () => void }) {
  const [processos, setProcessos] = useState<ProcessoAdmin[]>([]);
  const [programados, setProgramados] = useState<{ id: string; processoId: string; status: string; quando: string; prazo: string | null; numero: string; numeroAno: number | null }[]>([]);
  const [processoId, setProcessoId] = useState("");
  const [status, setStatus] = useState("");
  const [quando, setQuando] = useState("");
  const [prazo, setPrazo] = useState("");
  const [aviso, setAviso] = useState("");
  const [erro, setErro] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const pede = status ? pedePrevisao(status) || status === "encerrado" : false;

  function carregar() {
    void listarAdmin({ data: equipeId })
      .then((lista) => setProcessos(lista.filter((item) => item.status !== "cancelado")))
      .catch(() => setErro("Não foi possível carregar os processos."));
    void listarTramitesProgramados({ data: equipeId })
      .then(setProgramados)
      .catch(() => undefined);
  }

  useEffect(() => {
    carregar();
  }, [equipeId]);

  async function salvar() {
    setErro("");
    setAviso("");
    if (!processoId || !status || !quando) {
      setErro("Selecione o processo, o status e o horário.");
      return;
    }
    if (pede && !prazo) {
      setErro(status === "encerrado" ? "Informe a data de encerramento." : "Informe o prazo do novo status.");
      return;
    }
    setOcupado(true);
    try {
      await programarTramite({
        data: {
          processoId,
          status,
          quando: new Date(quando).toISOString(),
          prazo: prazo || null,
          equipeId,
        },
      });
      setAviso("Trâmite programado.");
      setProcessoId("");
      setStatus("");
      setQuando("");
      setPrazo("");
      carregar();
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Não foi possível programar.");
    } finally {
      setOcupado(false);
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-40 grid place-items-center bg-ink/40 p-4">
      <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl border border-line bg-sheet p-5" role="dialog" aria-labelledby="titulo-tramite">
        <div className="flex items-start justify-between gap-3">
          <h2 id="titulo-tramite" className="font-display text-2xl text-ink">Programar trâmite</h2>
          <button type="button" onClick={onFechar} className="grid size-10 place-items-center rounded-lg text-muted" aria-label="Fechar">
            <X className="size-4" />
          </button>
        </div>
        <p className="mt-1 text-sm text-muted">No dia e na hora marcados, o processo passa sozinho para o status escolhido.</p>
        <div className="mt-4 flex flex-col gap-3">
          <label className="flex flex-col gap-1 text-sm font-medium text-ink">
            Processo
            <select value={processoId} onChange={(evento) => setProcessoId(evento.target.value)} className={campo}>
              <option value="">Selecione</option>
              {processos.map((item) => (
                <option key={item.id} value={item.id}>
                  {rotuloNumero(item.numero, item.numeroAno)} · {rotuloTipo(item.tipo, item.tipoNumero, item.tipoAno)}
                  {item.contratado ? ` · ${item.contratado}` : ""}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium text-ink">
            Novo status
            <select value={status} onChange={(evento) => setStatus(evento.target.value)} className={campo}>
              <option value="">Selecione</option>
              {listaCodigos("administrativo").map((codigo) => (
                <option key={codigo} value={codigo}>{statusAdminLabel(codigo)}</option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium text-ink">
            Dia e hora
            <input type="datetime-local" value={quando} onChange={(evento) => setQuando(evento.target.value)} className={campo} />
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium text-ink">
            {status === "encerrado" ? "Data de encerramento" : "Prazo do novo status"}
            <input type="date" value={prazo} onChange={(evento) => setPrazo(evento.target.value)} className={campo} required={pede} />
          </label>
          {erro ? <p className="text-sm text-seal">{erro}</p> : null}
          {aviso ? <p className="text-sm text-pine">{aviso}</p> : null}
          <button type="button" onClick={() => void salvar()} disabled={ocupado} className="inline-flex h-11 items-center justify-center rounded-xl bg-pine text-sm font-medium text-sheet disabled:opacity-50">
            Programar
          </button>
        </div>
        {programados.length > 0 ? (
          <ul className="mt-4 flex flex-col gap-2 text-sm">
            {programados.map((item) => (
              <li key={item.id} className="rounded-xl border border-line px-3 py-2">
                <p className="text-ink">{rotuloNumero(item.numero, item.numeroAno)} · {statusAdminLabel(item.status)}</p>
                <p className="text-xs text-muted">{horaLocal(item.quando)}{item.prazo ? ` · prazo ${item.prazo.split("-").reverse().join("/")}` : ""}</p>
                <button
                  type="button"
                  onClick={() => {
                    void cancelarTramiteProgramado({ data: item.id }).then(() => carregar());
                  }}
                  className="mt-1 text-xs font-medium text-seal"
                >
                  Cancelar
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </div>,
    document.body,
  );
}
