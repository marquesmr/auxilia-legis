import { useMemo, useState, type FormEvent, type MouseEvent } from "react";
import textoLei from "@/lib/lei-14133.html?raw";

const OFICIAIS = [
  { rotulo: "Mensagem de veto", href: "https://www.planalto.gov.br/ccivil_03/_ato2019-2022/2021/Msg/VEP/VEP-118.htm" },
  { rotulo: "Partes vetadas promulgadas", href: "#promulgacao" },
  { rotulo: "Decreto 10.929/2022", href: "https://www.planalto.gov.br/ccivil_03/_ato2019-2022/2022/Decreto/D10929.htm" },
  { rotulo: "Decreto 11.430/2023", href: "https://www.planalto.gov.br/ccivil_03/_Ato2023-2026/2023/Decreto/D11430.htm" },
  { rotulo: "Decreto 12.174/2024", href: "https://www.planalto.gov.br/ccivil_03/_Ato2023-2026/2024/Decreto/D12174.htm" },
  { rotulo: "Decreto 12.343/2024", href: "https://www.planalto.gov.br/ccivil_03/_Ato2023-2026/2024/Decreto/D12343.htm" },
  { rotulo: "Decreto 12.807/2025", href: "https://www.planalto.gov.br/ccivil_03/_Ato2023-2026/2025/Decreto/D12807.htm" },
];

function titulosDaLei(html: string) {
  const itens: { id: string; nome: string }[] = [];
  const re = /<h2 class="lei-titulo" id="([^"]+)">([^<]+)<\/h2>\s*<p class="lei-p">([^<]*)<\/p>/g;
  for (const item of html.matchAll(re)) {
    const nome = item[3].trim();
    itens.push({ id: item[1], nome: nome ? `${item[2]} — ${nome}` : item[2] });
  }
  return itens;
}

function irPara(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
}

export function LeiLicitacoes() {
  const titulos = useMemo(() => titulosDaLei(textoLei), []);
  const [artigo, setArtigo] = useState("");
  const [aviso, setAviso] = useState("");

  function buscarArtigo(event: FormEvent) {
    event.preventDefault();
    const numero = artigo.replace(/\D/g, "");
    if (!numero) return;
    const alvo = document.getElementById(`art${numero}`);
    if (!alvo) {
      setAviso("Não há esse artigo na Lei 14.133.");
      return;
    }
    setAviso("");
    alvo.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function aoClicar(event: MouseEvent<HTMLElement>) {
    const link = (event.target as HTMLElement).closest("a");
    if (!link) return;
    const href = link.getAttribute("href") ?? "";
    if (!href.startsWith("#")) return;
    event.preventDefault();
    irPara(href.slice(1));
  }

  return (
    <div id="topo-lei" className="rounded-2xl border border-line bg-sheet p-4 sm:p-6">
      <h2 className="font-display text-2xl text-ink sm:text-3xl">Lei de Licitações</h2>
      <p className="mt-1 text-sm text-muted">
        Lei nº 14.133, de 1º de abril de 2021, no texto compilado. O artigo citado nesta lei abre aqui. Lei, decreto e vigência citados abrem a página oficial.
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        {OFICIAIS.map((item) =>
          item.href.startsWith("#") ? (
            <button key={item.rotulo} type="button" onClick={() => irPara(item.href.slice(1))} className="rounded-full border border-line bg-paper px-3 py-1 text-xs font-medium text-ink">
              {item.rotulo}
            </button>
          ) : (
            <a key={item.rotulo} href={item.href} target="_blank" rel="noopener noreferrer" className="rounded-full border border-line bg-paper px-3 py-1 text-xs font-medium text-ink">
              {item.rotulo}
            </a>
          ),
        )}
      </div>
      <form onSubmit={buscarArtigo} className="mt-4 flex flex-wrap items-end gap-2">
        <label className="flex flex-col gap-1 text-sm font-medium text-ink">
          Ir para o artigo
          <input
            value={artigo}
            onChange={(event) => setArtigo(event.target.value)}
            inputMode="numeric"
            placeholder="Ex.: 75"
            className="h-11 w-36 rounded-xl border border-line bg-paper px-3 text-ink"
          />
        </label>
        <button type="submit" className="h-11 rounded-xl bg-pine px-4 text-sm font-medium text-sheet">
          Abrir
        </button>
        {aviso && <p className="text-sm text-seal">{aviso}</p>}
      </form>
      <div className="mt-4 flex flex-wrap gap-2">
        {titulos.map((item) => (
          <button key={item.id} type="button" onClick={() => irPara(item.id)} className="rounded-full bg-pine-soft px-3 py-1 text-left text-xs font-medium text-pine">
            {item.nome}
          </button>
        ))}
      </div>
      <article className="lei-texto mt-6" onClick={aoClicar} dangerouslySetInnerHTML={{ __html: textoLei }} />
      <div className="sticky bottom-4 z-30 mt-4 flex justify-start">
        <button
          type="button"
          onClick={() => irPara("topo-lei")}
          className="rounded-full border border-line bg-sheet px-4 py-2 text-sm font-medium text-ink shadow-md"
        >
          Voltar ao topo
        </button>
      </div>
      <style>{`
        .lei-texto { color: var(--color-ink); font-size: 0.95rem; line-height: 1.65; }
        .lei-texto .lei-notas, .lei-texto .lei-titulo, .lei-texto .lei-capitulo, .lei-texto .lei-secao { text-align: center; }
        .lei-texto .lei-titulo { margin: 2rem 0 0.25rem; font-family: var(--font-display); font-size: 1.35rem; font-weight: 600; scroll-margin-top: 5rem; }
        .lei-texto .lei-capitulo, .lei-texto .lei-secao { margin: 1.25rem 0 0.2rem; font-size: 0.95rem; font-weight: 700; letter-spacing: 0.02em; }
        .lei-texto p { margin: 0.55rem 0; text-align: justify; }
        .lei-texto .lei-art, .lei-texto .lei-inciso, .lei-texto .lei-alinea, .lei-texto .lei-par, #topo-lei { scroll-margin-top: 5rem; }
        .lei-texto .lei-citacao {
          margin: 0.2rem 0 0.2rem 0.35rem;
          padding: 0.15rem 0 0.15rem 0.9rem;
          border-left: 3px solid color-mix(in srgb, var(--color-pine) 45%, transparent);
          text-align: justify;
        }
        .lei-texto .lei-omissao {
          margin: 0.35rem 0.5rem 0.35rem 0.35rem;
          height: 0.85rem;
          border-left: 3px solid color-mix(in srgb, var(--color-pine) 45%, transparent);
          border-bottom: 1px dotted var(--color-muted);
        }
        .lei-texto a { color: var(--color-pine); text-decoration: underline; text-underline-offset: 2px; }
        .lei-texto del { color: var(--color-muted); text-decoration: line-through; }
      `}</style>
    </div>
  );
}
