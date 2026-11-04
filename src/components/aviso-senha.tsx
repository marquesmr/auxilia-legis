import { useState, type CSSProperties, type FormEvent } from "react";
import { authClient } from "@/lib/auth/client";
import { atualizarSenhaLembrada, confirmarSenhaDigitada } from "@/lib/lembrar-acesso";
import { Eye, EyeOff } from "lucide-react";

export function AvisoSenha({ email, onPronto }: { email: string; onPronto: () => void }) {
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [visivel, setVisivel] = useState(false);
  const [nomeCampo] = useState(() => `lembrete-${Math.random().toString(36).slice(2)}`);

  async function confirmar(event: FormEvent) {
    event.preventDefault();
    setErro("");
    setEnviando(true);
    try {
      const resultado = await authClient.signIn.email({
        email,
        password: senha,
        rememberMe: true,
        callbackURL: "/",
      });
      if (resultado.error) {
        setErro("Não foi essa. Digite a senha de novo para não esquecer.");
        return;
      }
      atualizarSenhaLembrada(senha);
      confirmarSenhaDigitada();
      onPronto();
    } catch {
      setErro("Não foi possível confirmar agora. Tente de novo.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-ink/50 p-4 sm:items-center">
      <form autoComplete="off" onSubmit={(event) => void confirmar(event)} className="w-full max-w-lg rounded-2xl border border-line bg-sheet p-5 shadow-xl">
        <h2 className="font-display text-2xl text-ink">Digite sua senha para não esquecer</h2>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          A cada 5 acessos a senha precisa ser digitada. Quem deixa só o navegador lembrar, acaba esquecendo.
        </p>
        <div className="mt-4 grid grid-cols-2 gap-3">
          <figure className="flex flex-col items-center rounded-xl bg-paper px-2 py-3">
            <img src="/esquece.png" alt="" className="silhueta h-32 w-full object-contain" />
            <figcaption className="mt-1 text-center text-xs font-medium text-seal">Não digita e esquece</figcaption>
          </figure>
          <figure className="flex flex-col items-center rounded-xl bg-paper px-2 py-3">
            <img src="/lembra.png" alt="" className="silhueta h-32 w-full object-contain" />
            <figcaption className="mt-1 text-center text-xs font-medium text-pine">Digita e lembra</figcaption>
          </figure>
        </div>
        {erro && <p className="mt-3 rounded-xl bg-seal-soft px-3 py-2 text-sm text-seal">{erro}</p>}
        <label className="mt-4 flex flex-col gap-1 text-sm font-medium text-ink">
          Senha de {email}
          <span className="relative block">
            <input
              type="text"
              name={nomeCampo}
              value={senha}
              onChange={(evento) => setSenha(evento.target.value)}
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck={false}
              data-1p-ignore="true"
              data-lpignore="true"
              data-form-type="other"
              inputMode="text"
              className="h-11 w-full rounded-xl border border-line bg-paper px-3 pr-11 text-sm font-normal text-ink"
              style={{ WebkitTextSecurity: visivel ? "none" : "disc" } as CSSProperties}
              required
            />
            <button
              type="button"
              aria-label={visivel ? "Ocultar senha" : "Mostrar senha"}
              onClick={() => setVisivel((atual) => !atual)}
              className="absolute inset-y-0 right-0 grid w-11 place-items-center text-muted"
            >
              {visivel ? <EyeOff className="size-4" aria-hidden /> : <Eye className="size-4" aria-hidden />}
            </button>
          </span>
        </label>
        <button type="submit" disabled={enviando || senha.length < 8} className="mt-3 inline-flex h-12 w-full items-center justify-center rounded-xl bg-pine text-sm font-medium text-sheet disabled:opacity-60">
          {enviando ? "Conferindo…" : "Confirmar senha"}
        </button>
      </form>
    </div>
  );
}