const CORES_GRAFICO = [
  "#6E92B8",
  "#D4924E",
  "#5E9A84",
  "#C56E80",
  "#C6A25A",
  "#7A78B0",
  "#6E9464",
  "#B56A98",
  "#5E86A6",
  "#D07A62",
  "#4E8F98",
  "#A9845C",
];

export function caminhoPizza(cx: number, cy: number, raio: number, inicio: number, fim: number) {
  const n = (valor: number) => Math.round(valor * 100) / 100;
  const span = fim - inicio;
  if (span >= 359.999) {
    return `M ${n(cx - raio)} ${n(cy)} A ${raio} ${raio} 0 1 1 ${n(cx + raio)} ${n(cy)} A ${raio} ${raio} 0 1 1 ${n(cx - raio)} ${n(cy)} Z`;
  }
  const rad = (grau: number) => (grau * Math.PI) / 180;
  const x1 = n(cx + raio * Math.cos(rad(inicio)));
  const y1 = n(cy + raio * Math.sin(rad(inicio)));
  const x2 = n(cx + raio * Math.cos(rad(fim)));
  const y2 = n(cy + raio * Math.sin(rad(fim)));
  const grande = span > 180 ? 1 : 0;
  return `M ${n(cx)} ${n(cy)} L ${x1} ${y1} A ${raio} ${raio} 0 ${grande} 1 ${x2} ${y2} Z`;
}

export function corGrafico(indice: number) {
  return CORES_GRAFICO[indice % CORES_GRAFICO.length];
}

export function pintarContagem<T extends { n: number }>(itens: T[]) {
  let indice = 0;
  return itens.map((item) => {
    if (item.n <= 0) return { ...item, cor: "#E4DDD2" };
    const cor = corGrafico(indice);
    indice += 1;
    return { ...item, cor };
  });
}
