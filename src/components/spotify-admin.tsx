import { useEffect, useState, type FormEvent } from "react";
import {
  estadoSpotifyConta,
  listarPlaylistsSpotify,
  sairSpotify,
  salvarClientIdSpotify,
  vincularSpotify,
} from "@/lib/spotify.functions";

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
  const [editando, setEditando] = useState(false);
  const [erro, setErro] = useState("");
  const [aviso, setAviso] = useState("");
  const [clientId, setClientId] = useState("");
  const [configurado, setConfigurado] = useState(false);
  const [retorno, setRetorno] = useState("https://www.auxilialegis.online/api/spotify/callback");
  const [nome, setNome] = useState("");
  const [tocando, setTocando] = useState("");
  const [playlists, setPlaylists] = useState<{ id: string; nome: string; url: string }[]>([]);
  const [ocupado, setOcupado] = useState(false);
  const embed = embedSpotify(link);

  async function carregar() {
    const estado = await estadoSpotifyConta();
    setConfigurado(estado.configurado);
    setRetorno(estado.retorno);
    setNome(estado.vinculado ? estado.nome : "");
    setTocando(estado.tocando);
    if (estado.vinculado) {
      const lista = await listarPlaylistsSpotify().catch(() => []);
      setPlaylists(lista);
    } else {
      setPlaylists([]);
    }
  }

  useEffect(() => {
    const guardado = localStorage.getItem(CHAVE) ?? "";
    setLink(guardado);
    setRascunho(guardado);
    const params = new URLSearchParams(window.location.search);
    const marca = params.get("spotify");
    if (marca) {
      params.delete("spotify");
      const resto = params.toString();
      window.history.replaceState({}, "", resto ? `/?${resto}` : "/");
      setAviso(marca === "vinculada" ? "Conta vinculada." : "Não foi possível vincular a conta.");
    }
    void carregar().catch((err: unknown) => setErro(err instanceof Error ? err.message : "Não foi possível abrir o Spotify."));
  }, []);

  function usarLink(valor: string) {
    const proximo = embedSpotify(valor);
    if (!proximo) {
      setErro("Esse link do Spotify não serve.");
      return;
    }
    localStorage.setItem(CHAVE, valor.trim());
    setLink(valor.trim());
    setRascunho(valor.trim());
    setEditando(false);
    setErro("");
  }

  function salvarLink(evento: FormEvent) {
    evento.preventDefault();
    usarLink(rascunho);
  }

  return (
    <section className="mt-3 rounded-2xl border border-line bg-sheet p-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-display text-lg leading-none text-ink">Spotify</h2>
        {nome ? (
          <button
            type="button"
            disabled={ocupado}
            onClick={() => {
              setOcupado(true);
              void sairSpotify()
                .then(() => {
                  setNome("");
                  setTocando("");
                  setPlaylists([]);
                  setAviso("Conta desvinculada.");
                })
                .catch((err: unknown) => setErro(err instanceof Error ? err.message : "Não foi possível desvincular."))
                .finally(() => setOcupado(false));
            }}
            className="text-sm font-medium text-pine"
          >
            Desvincular
          </button>
        ) : null}
      </div>
      {nome ? <p className="mt-2 text-sm text-ink">{nome}</p> : null}
      {tocando ? <p className="mt-1 text-xs text-muted">Tocando: {tocando}</p> : null}
      {aviso ? <p className="mt-2 text-xs text-pine">{aviso}</p> : null}
      {erro ? <p className="mt-2 text-xs text-seal">{erro}</p> : null}

      {!configurado ? (
        <form
          className="mt-3 flex flex-col gap-2"
          onSubmit={(evento) => {
            evento.preventDefault();
            setOcupado(true);
            setErro("");
            void salvarClientIdSpotify({ data: { clientId } })
              .then(() => {
                setConfigurado(true);
                setAviso("Aplicativo salvo. Agora vincule a conta.");
              })
              .catch((err: unknown) => setErro(err instanceof Error ? err.message : "Não foi possível salvar o Client ID."))
              .finally(() => setOcupado(false));
          }}
        >
          <p className="text-xs text-muted">No painel do Spotify, cadastre este retorno e cole o Client ID.</p>
          <p className="break-all text-xs text-ink">{retorno}</p>
          <input
            value={clientId}
            onChange={(evento) => setClientId(evento.target.value.trim())}
            placeholder="Client ID"
            className="h-11 w-full rounded-xl border border-line bg-paper px-3 text-sm text-ink"
            spellCheck={false}
          />
          <button type="submit" disabled={ocupado} className="inline-flex h-10 items-center justify-center rounded-xl bg-pine text-sm font-medium text-sheet disabled:opacity-60">
            Salvar aplicativo
          </button>
        </form>
      ) : null}

      {configurado && !nome ? (
        <button
          type="button"
          disabled={ocupado}
          onClick={() => {
            setOcupado(true);
            setErro("");
            void vincularSpotify()
              .then((resultado) => {
                window.location.assign(resultado.url);
              })
              .catch((err: unknown) => {
                setErro(err instanceof Error ? err.message : "Não foi possível abrir o Spotify.");
                setOcupado(false);
              });
          }}
          className="mt-3 inline-flex h-10 w-full items-center justify-center rounded-xl bg-pine text-sm font-medium text-sheet disabled:opacity-60"
        >
          Vincular conta
        </button>
      ) : null}

      {playlists.length > 0 ? (
        <label className="mt-3 block text-xs text-muted">
          Playlist da conta
          <select
            className="mt-1 h-11 w-full rounded-xl border border-line bg-paper px-3 text-sm text-ink"
            defaultValue=""
            onChange={(evento) => {
              if (evento.target.value) usarLink(evento.target.value);
            }}
          >
            <option value="">Escolha</option>
            {playlists.map((item) => (
              <option key={item.id} value={item.url}>
                {item.nome}
              </option>
            ))}
          </select>
        </label>
      ) : null}

      {embed && !editando ? (
        <>
          <iframe
            title="Spotify"
            src={embed}
            className="mt-3 w-full rounded-xl"
            style={{ height: 152, border: 0 }}
            allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
            loading="lazy"
          />
          <button type="button" onClick={() => setEditando(true)} className="mt-2 text-sm font-medium text-pine">
            Trocar link
          </button>
        </>
      ) : (
        <form onSubmit={salvarLink} className="mt-3 flex flex-col gap-2">
          <input
            value={rascunho}
            onChange={(evento) => {
              setRascunho(evento.target.value);
              setErro("");
            }}
            placeholder="Ou cole um link do Spotify"
            className="h-11 w-full rounded-xl border border-line bg-paper px-3 text-sm text-ink"
            spellCheck={false}
          />
          <div className="flex gap-2">
            <button type="submit" className="inline-flex h-10 flex-1 items-center justify-center rounded-xl border border-line text-sm font-medium text-ink">
              Ouvir link
            </button>
            {embed ? (
              <button type="button" onClick={() => { setEditando(false); setRascunho(link); }} className="inline-flex h-10 items-center justify-center rounded-xl border border-line px-3 text-sm font-medium text-ink">
                Cancelar
              </button>
            ) : null}
          </div>
        </form>
      )}
    </section>
  );
}
