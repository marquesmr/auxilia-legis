export type FaixaCampanha = {
  nome: string;
  tema: string;
  cor: string;
};

export type CampanhaMes = {
  mes: number;
  nome: string;
  faixas: FaixaCampanha[];
};

const CAMPANHAS: CampanhaMes[] = [
  {
    mes: 1,
    nome: "Janeiro",
    faixas: [
      { nome: "Branco", tema: "Saúde mental e emocional", cor: "#f4f1ea" },
      { nome: "Roxo", tema: "Combate e prevenção à hanseníase", cor: "#6d28a8" },
    ],
  },
  {
    mes: 2,
    nome: "Fevereiro",
    faixas: [
      { nome: "Roxo", tema: "Lúpus, fibromialgia e mal de Alzheimer", cor: "#6b21a8" },
      { nome: "Laranja", tema: "Conscientização e combate à leucemia", cor: "#f97316" },
    ],
  },
  {
    mes: 3,
    nome: "Março",
    faixas: [
      { nome: "Azul-Marinho", tema: "Prevenção ao câncer colorretal", cor: "#0b2a4a" },
      { nome: "Lilás", tema: "Prevenção ao câncer do colo do útero e HPV", cor: "#c9a6dc" },
    ],
  },
  {
    mes: 4,
    nome: "Abril",
    faixas: [
      { nome: "Verde", tema: "Segurança e saúde no trabalho", cor: "#1f8a4c" },
      { nome: "Azul", tema: "Conscientização sobre o autismo", cor: "#1d6fd6" },
    ],
  },
  {
    mes: 5,
    nome: "Maio",
    faixas: [
      { nome: "Amarelo", tema: "Segurança no trânsito", cor: "#f5c400" },
      { nome: "Lilás", tema: "Combate às doenças inflamatórias intestinais", cor: "#7c3aed" },
    ],
  },
  {
    mes: 6,
    nome: "Junho",
    faixas: [
      { nome: "Vermelho", tema: "Incentivo à doação de sangue", cor: "#d0122d" },
      { nome: "Laranja", tema: "Conscientização sobre anemia e leucemia", cor: "#f97316" },
    ],
  },
  {
    mes: 7,
    nome: "Julho",
    faixas: [
      { nome: "Amarelo", tema: "Combate às hepatites virais", cor: "#f0c000" },
      { nome: "Verde", tema: "Prevenção ao câncer de cabeça e pescoço", cor: "#1f8a4c" },
    ],
  },
  {
    mes: 8,
    nome: "Agosto",
    faixas: [
      { nome: "Dourado", tema: "Incentivo ao aleitamento materno", cor: "#d4a017" },
      { nome: "Lilás", tema: "Combate à violência contra a mulher", cor: "#a855b8" },
    ],
  },
  {
    mes: 9,
    nome: "Setembro",
    faixas: [
      { nome: "Amarelo", tema: "Prevenção ao suicídio", cor: "#f5c400" },
      { nome: "Verde", tema: "Doação de órgãos e tecidos", cor: "#1f8a4c" },
      { nome: "Vermelho", tema: "Doenças cardiovasculares", cor: "#d0122d" },
    ],
  },
  {
    mes: 10,
    nome: "Outubro",
    faixas: [{ nome: "Rosa", tema: "Prevenção e diagnóstico precoce do câncer de mama", cor: "#e4538a" }],
  },
  {
    mes: 11,
    nome: "Novembro",
    faixas: [
      { nome: "Azul", tema: "Prevenção ao câncer de próstata e saúde do homem", cor: "#1d4f91" },
      { nome: "Dourado", tema: "Câncer infantojuvenil", cor: "#d4a017" },
    ],
  },
  {
    mes: 12,
    nome: "Dezembro",
    faixas: [
      { nome: "Vermelho", tema: "Prevenção ao HIV/AIDS e outras ISTs", cor: "#d0122d" },
      { nome: "Laranja", tema: "Combate e prevenção ao câncer de pele", cor: "#f97316" },
    ],
  },
];

function canais(hex: string) {
  const n = hex.replace("#", "");
  return [0, 2, 4].map((inicio) => {
    const canal = parseInt(n.slice(inicio, inicio + 2), 16) / 255;
    return canal <= 0.03928 ? canal / 12.92 : ((canal + 0.055) / 1.055) ** 2.4;
  });
}

export function corClara(hex: string) {
  const [r, g, b] = canais(hex);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.42;
}

export function corTexto(hex: string) {
  return corClara(hex) ? "#1c1915" : "#f6f1e6";
}

export function misturar(origem: string, destino: string, peso: number) {
  const a = origem.replace("#", "");
  const b = destino.replace("#", "");
  const hex = [0, 2, 4]
    .map((inicio) => {
      const de = parseInt(a.slice(inicio, inicio + 2), 16);
      const para = parseInt(b.slice(inicio, inicio + 2), 16);
      return Math.round(de + (para - de) * peso)
        .toString(16)
        .padStart(2, "0");
    })
    .join("");
  return `#${hex}`;
}

export function corNoDegrade(faixas: FaixaCampanha[], ponto: number) {
  if (faixas.length === 1) return faixas[0].cor;
  const limitado = Math.min(1, Math.max(0, ponto));
  const posicao = limitado * (faixas.length - 1);
  const indice = Math.min(faixas.length - 2, Math.floor(posicao));
  return misturar(faixas[indice].cor, faixas[indice + 1].cor, posicao - indice);
}

export function degradeCampanha(faixas: FaixaCampanha[]) {
  if (faixas.length === 1) return faixas[0].cor;
  return `linear-gradient(to bottom, ${faixas.map((faixa) => faixa.cor).join(", ")})`;
}

export function campanhaDoMes(data = new Date()): CampanhaMes {
  const mes = Number(new Intl.DateTimeFormat("en-US", { timeZone: "America/Sao_Paulo", month: "numeric" }).format(data));
  return CAMPANHAS.find((item) => item.mes === mes) ?? CAMPANHAS[0];
}
