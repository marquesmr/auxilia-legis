export function chaveCidade(valor: string) {
  return valor
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR")
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export async function cidadeDaPosicao(latitude: number, longitude: number) {
  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) throw new Error("Localização inválida.");
  const url = `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=jsonv2&addressdetails=1&zoom=10&accept-language=pt-BR`;
  const res = await fetch(url, {
    headers: { "User-Agent": "AuxiliaLegis/1.0 (auxilialegis@marquestecnologies.com)", Accept: "application/json" },
    signal: AbortSignal.timeout(12000),
  });
  if (!res.ok) throw new Error("Não foi possível identificar a cidade.");
  const body = (await res.json()) as { address?: Record<string, string> };
  const endereco = body.address ?? {};
  const cidade = (endereco.city || endereco.town || endereco.municipality || endereco.village || "").trim();
  if (cidade.length < 2) throw new Error("Não foi possível identificar a cidade.");
  const iso = endereco["ISO3166-2-lvl4"] || "";
  const uf = iso.includes("-") ? iso.split("-").pop()?.slice(0, 2).toUpperCase() ?? "" : "";
  return { cidade: cidade.slice(0, 80), uf };
}
