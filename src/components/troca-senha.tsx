import { useState, type FormEvent } from "react";
import { CampoSenha } from "@/components/campo-senha";
import { authClient } from "@/lib/auth/client";

const campo = "h-11 w-full rounded-xl border border-line bg-paper px-3 text-sm font-normal text-ink";

export function TrocaSenhaPerfil() {
  const [atual, setAtual] = useState("");
  const [nova, setNova] = useState("");
  const [repete, setRepete] = useState("");
  const [erro, setErro] = useState("");
  const [aviso, setAviso] = useState("");
  const [enviando, setEnviando] = useState(false);

  async function salvar(event: FormEvent) {
    event.preventDefault();
    setErro("");
    setAviso("");
    if (nova.length < 8) {
      setErro("A nova senha precisa ter pelo menos 8 caracteres.");
      return;
    }
    if (nova !== repete) {
      setErro("A repetição não é igual à nova senha.");
      return;
    }
    setEnviando(true);
    try {
      const resposta = await authClient.changePassword({
        currentPassword: atual,
        newPassword: nova,
        revokeOtherSessions: true,
      });
      if (resposta.error) {
        const texto = (resposta.error.message ?? "").toLowerCase();
        if (texto.includes("invalid") || texto.includes("incorrect") || texto.includes("credential")) {
          setErro("Senha atual incorreta. Se não lembrar, saia e use Esqueci minha senha.");
        } else {
          setErro("Não foi possível trocar a senha.");
        }
        return;
      }
      setAtual("");
      setNova("");
      setRepete("");
      setAviso("Senha atualizada.");
    } catch {
      setErro("Não foi possível trocar a senha.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <form className="mt-5 flex flex-col gap-3 border-t border-line pt-4" onSubmit={(event) => void salvar(event)}>
      <h3 className="font-display text-xl text-ink">Senha</h3>
      <p className="text-sm text-muted">Informe a senha atual, a nova e a repetição.</p>
      {aviso && <p className="rounded-xl bg-pine-soft px-3 py-2 text-sm text-pine">{aviso}</p>}
      {erro && <p className="rounded-xl bg-seal-soft px-3 py-2 text-sm text-seal">{erro}</p>}
      <label className="flex flex-col gap-1 text-sm font-medium text-ink">
        Senha atual
        <CampoSenha value={atual} onChange={(e) => setAtual(e.target.value)} className={campo} autoComplete="current-password" required />
      </label>
      <label className="flex flex-col gap-1 text-sm font-medium text-ink">
        Nova senha
        <CampoSenha value={nova} onChange={(e) => setNova(e.target.value)} className={campo} autoComplete="new-password" minLength={8} required />
      </label>
      <label className="flex flex-col gap-1 text-sm font-medium text-ink">
        Repetir nova senha
        <CampoSenha value={repete} onChange={(e) => setRepete(e.target.value)} className={campo} autoComplete="new-password" minLength={8} required />
      </label>
      <button type="submit" disabled={enviando} className="inline-flex h-11 items-center justify-center rounded-xl bg-pine text-sm font-medium text-sheet disabled:opacity-60">
        {enviando ? "Salvando…" : "Trocar senha"}
      </button>
    </form>
  );
}
