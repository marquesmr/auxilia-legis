import { useEffect, useState, type FormEvent } from "react";

const CHAVE = "auxilia.spotify";
const TIPOS = ["track", "playlist", "album", "episode", "show", "artist"];

function embedSpotify(entrada: string) {
  const texto = entrada.trim();
  if (!texto) return "";
  const uri = texto.match(/^spotify:(track|playlist|album|episode|show|artist):([A-Za-z0-9]+)$/);
  if (uri) return `https://open.spotify.com/embed/${uri[1]}/${uri[2]}?utm_source=generator&theme=0`;
  try {
    const url = new URL(texto);
    if (!url.hostname.endsWith("spotify.com")) return "";
    const partes = url.pathname.split("/").filter(Boolean);
    const tipo = partes.find((parte) => TIPOS.includes(parte));
    const indice = tipo ? partes.indexOf(tipo) : -1;
    const id = indice >= 0 ? partes[indice + 1] ?? "" : "";
    if (!tipo || !/^[A-Za-z0-9]+$/.test(id)) return "";
    return `https://open.spotify.com/embed/${tipo}/${id}?utm_source=generator&theme=0`;
  } catch {
    return "";
  }
}

export function SpotifyAdmin() {
  const [link, setLink] = useState("");
  const [rascunho, setRascunho] = useState("");
  const [editando, setEditando] = useState(true);
  const [erro, setErro] = useState("");
  const embed = embedSpotify(link);

  useEffect(() => {
    const guardado = localStorage.getItem(CHAVE) ?? "";
    setLink(guardado);
    setRascunho(guardado);
    setEditando(!embedSpotify(guardado));
  }, []);

  function salvar(evento: FormEvent) {
    evento.preventDefault();
    const proximo = embedSpotify(rascunho);
    if (!proximo) {
      setErro("Cole um link do Spotify: música, álbum, artista ou playlist.");
      return;
    }
    localStorage.setItem(CHAVE, rascunho.trim());
    setLink(rascunho.trim());
    setErro("");
    setEditando(false);
  }

  return (
    <section className="mt-3 rounded-2xl border border-line bg-sheet p-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-display text-lg leading-none text-ink">Spotify</h2>
        {embed && !editando ? (
          <button type="button" onClick={() => setEditando(true)} className="text-sm font-medium text-pine">
            Trocar
          </button>
        ) : null}
      </div>
      {embed && !editando ? (
        <iframe
          title="Spotify"
          src={embed}
          className="mt-3 w-full rounded-xl"
          style={{ height: 152, border: 0 }}
          allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
          loading="lazy"
        />
      ) : (
        <form onSubmit={salvar} className="mt-3 flex flex-col gap-2">
          <input
            value={rascunho}
            onChange={(evento) => {
              setRascunho(evento.target.value);
              setErro("");
            }}
            placeholder="https://open.spotify.com/..."
            className="h-11 w-full rounded-xl border border-line bg-paper px-3 text-sm text-ink"
            spellCheck={false}
          />
          {erro ? <p className="text-xs text-seal">{erro}</p> : <p className="text-xs text-muted">Só quem administra vê este player.</p>}
          <div className="flex gap-2">
            <button type="submit" className="inline-flex h-10 flex-1 items-center justify-center rounded-xl bg-pine text-sm font-medium text-sheet">
              Ouvir
            </button>
            {embed ? (
              <button type="button" onClick={() => { setEditando(false); setErro(""); setRascunho(link); }} className="inline-flex h-10 items-center justify-center rounded-xl border border-line px-3 text-sm font-medium text-ink">
                Cancelar
              </button>
            ) : null}
          </div>
        </form>
      )}
    </section>
  );
}
