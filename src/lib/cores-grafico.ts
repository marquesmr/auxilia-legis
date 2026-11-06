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
