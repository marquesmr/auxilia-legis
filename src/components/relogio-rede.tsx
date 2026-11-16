import { useEffect, useState } from "react";
import { horaDaRede } from "@/lib/relogio.functions";

const FUSO = "America/Sao_Paulo";

function formatar(agora: Date) {
  const dia = new Intl.DateTimeFormat("pt-BR", { timeZone: FUSO, weekday: "short", day: "2-digit", month: "short" }).format(agora);
  const hora = new Intl.DateTimeFormat("pt-BR", { timeZone: FUSO, hour: "2-digit", minute: "2-digit", second: "2-digit" }).format(agora);
  return { dia: dia.replace(".", ""), hora };
}

export function RelogioRede() {
  const [agora, setAgora] = useState<Date | null>(null);

  useEffect(() => {
    let offset = 0;
    let sincronizado = false;
    let vivo = true;

    const sincronizar = () => {
      const enviado = Date.now();
      void horaDaRede()
        .then((resposta) => {
          if (!vivo) return;
          const recebido = Date.now();
          const ida = Math.max(0, recebido - enviado) / 2;
          offset = resposta.epoch + ida - recebido;
          sincronizado = true;
          setAgora(new Date(recebido + offset));
        })
        .catch(() => undefined);
    };

    sincronizar();
    const rede = window.setInterval(sincronizar, 5 * 60 * 1000);
    const pulso = window.setInterval(() => {
      if (sincronizado) setAgora(new Date(Date.now() + offset));
    }, 1000);

    return () => {
      vivo = false;
      window.clearInterval(rede);
      window.clearInterval(pulso);
    };
  }, []);

  const texto = agora ? formatar(agora) : null;

  return (
    <div
      className="inline-flex h-11 items-center gap-2 self-start rounded-xl border border-line bg-sheet px-3 text-sm text-ink"
      title="Horário de Brasília, sincronizado com a rede"
      aria-label={texto ? `Horário de Brasília ${texto.hora}` : "Sincronizando o horário da rede"}
    >
      {texto ? (
        <>
          <span className="capitalize text-muted">{texto.dia}</span>
          <span className="font-medium tabular-nums">{texto.hora}</span>
        </>
      ) : (
        <span className="text-muted">Sincronizando…</span>
      )}
    </div>
  );
}
