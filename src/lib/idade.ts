export function idadeEm(nascimento: string, agora = new Date()) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(nascimento)) return null;
  const [ano, mes, dia] = nascimento.split("-").map(Number);
  const data = new Date(Date.UTC(ano, mes - 1, dia));
  if (data.getUTCFullYear() !== ano || data.getUTCMonth() !== mes - 1 || data.getUTCDate() !== dia) return null;
  const hoje = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(agora);
  const [anoHoje, mesHoje, diaHoje] = hoje.split("-").map(Number);
  if (ano > anoHoje || (ano === anoHoje && (mes > mesHoje || (mes === mesHoje && dia > diaHoje)))) return null;
  let idade = anoHoje - ano;
  if (mesHoje < mes || (mesHoje === mes && diaHoje < dia)) idade -= 1;
  return idade;
}

export function limitesNascimento(agora = new Date()) {
  const hoje = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(agora);
  const [ano, mes, dia] = hoje.split("-").map(Number);
  const max = hoje;
  const min = `${String(ano - 120).padStart(4, "0")}-${String(mes).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
  return { min, max };
}
