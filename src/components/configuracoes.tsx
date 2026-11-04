import { useEffect, useState, type ReactNode } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Settings, X } from "lucide-react";
import { gravarPreferencias, lerPreferencias, type Cor, type Preferencias, type Tema } from "@/lib/preferencias";

export function BotaoConfiguracoes({ userId }: { userId: string }) {
  const [aberto, setAberto] = useState(false);
  const [prefs, setPrefs] = useState<Preferencias>(() => lerPreferencias(userId));
  const [aviso, setAviso] = useState("");

  useEffect(() => {
    if (!aberto) return;
    setPrefs(lerPreferencias(userId));
    setAviso("");
  }, [aberto, userId]);

  function salvar() {
    gravarPreferencias(prefs, userId);
    setAviso("Guardado. O tema já foi aplicado.");
  }

  return (
    <Dialog.Root open={aberto} onOpenChange={setAberto}>
      <Dialog.Trigger asChild>
        <button
          type="button"
          aria-label="Configurações"
          className="inline-flex size-11 shrink-0 items-center justify-center rounded-xl border border-line bg-sheet text-ink"
        >
          <Settings className="size-4" />
        </button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-ink/40" />
        <Dialog.Content className="fixed inset-x-3 top-4 bottom-4 z-40 flex flex-col overflow-hidden rounded-2xl border border-line bg-sheet md:inset-auto md:top-1/2 md:left-1/2 md:max-h-[90vh] md:w-full md:max-w-lg md:-translate-x-1/2 md:-translate-y-1/2">
          <div className="flex items-start justify-between gap-3 border-b border-line px-5 py-4">
            <div>
              <Dialog.Title className="font-display text-2xl text-ink">Configurações</Dialog.Title>
            </div>
            <Dialog.Close className="grid size-9 place-items-center rounded-full text-muted hover:bg-paper">
              <X className="size-4" />
            </Dialog.Close>
          </div>
          <div className="flex flex-col gap-5 overflow-y-auto px-5 py-4">
            <fieldset className="flex flex-col gap-2">
              <legend className="text-sm font-medium text-ink">Aparência</legend>
              <Opcao nome="tema" valor="claro" atual={prefs.tema} onChange={(tema) => setPrefs({ ...prefs, tema: tema as Tema })}>
                Modo claro
              </Opcao>
              <Opcao nome="tema" valor="escuro" atual={prefs.tema} onChange={(tema) => setPrefs({ ...prefs, tema: tema as Tema })}>
                Modo escuro
              </Opcao>
              <Opcao nome="tema" valor="auto" atual={prefs.tema} onChange={(tema) => setPrefs({ ...prefs, tema: tema as Tema })}>
                Automático, segue o dispositivo
              </Opcao>
            </fieldset>
            <fieldset className="flex flex-col gap-2">
              <legend className="text-sm font-medium text-ink">Cor</legend>
              {CORES.map((item) => (
                <Opcao
                  key={item.id}
                  nome="cor"
                  valor={item.id}
                  atual={prefs.cor}
                  onChange={(cor) => setPrefs({ ...prefs, cor: cor as Cor })}
                >
                  <span className="size-4 shrink-0 rounded-full border border-line" style={{ background: item.amostra }} />
                  {item.nome}
                </Opcao>
              ))}
            </fieldset>
            {aviso && <p className="text-sm text-ink">{aviso}</p>}
          </div>
          <div className="border-t border-line px-5 py-4">
            <button type="button" onClick={salvar} className="inline-flex h-11 w-full items-center justify-center rounded-xl bg-pine text-sm font-medium text-sheet">
              Salvar
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function Opcao({
  nome,
  valor,
  atual,
  onChange,
  children,
}: {
  nome: string;
  valor: string;
  atual: string;
  onChange: (valor: string) => void;
  children: ReactNode;
}) {
  return (
    <label className="flex items-center gap-2 rounded-xl border border-line bg-paper px-3 py-2 text-sm text-ink">
      <input type="radio" name={nome} value={valor} checked={atual === valor} onChange={() => onChange(valor)} />
      {children}
    </label>
  );
}

const CORES: { id: Cor; nome: string; amostra: string }[] = [
  { id: "padrao", nome: "Padrão — verde no claro, azul claro no escuro", amostra: "linear-gradient(135deg,#1c4738 50%,#8ec8f2 50%)" },
  { id: "verde", nome: "Verde", amostra: "#1c4738" },
  { id: "vinho", nome: "Vinho", amostra: "#6e1f3d" },
  { id: "azul", nome: "Azul", amostra: "#1a4e86" },
  { id: "laranja", nome: "Laranja", amostra: "#8f3d0c" },
  { id: "roxo", nome: "Roxo", amostra: "#5c2d82" },
];
