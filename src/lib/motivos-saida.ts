export const MOTIVOS_SAIDA = [
  { id: "nao-uso", titulo: "Não uso mais" },
  { id: "outra-conta", titulo: "Criei outra conta" },
  { id: "privacidade", titulo: "Privacidade dos dados" },
  { id: "dificuldade", titulo: "Dificuldade para usar" },
  { id: "outros", titulo: "Outros" },
] as const;

export function motivoSaida(id: string) {
  return MOTIVOS_SAIDA.find((item) => item.id === id) ?? null;
}
