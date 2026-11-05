/**
 * Marcador legível de sessão do gate. Sair não adianta: o próximo request
 * recria via `x-grok-identity`, então o `UserButton` esconde o sair.
 * Prefixo `__Host-`: o browser recusa `Domain`, e um app irmão `*.grok.me`
 * não planta cookie no pai. Sem imports de servidor.
 */
export const GATE_SESSION_MARKER_COOKIE = "__Host-grok_gate_session";

export function hasGateSessionMarker(): boolean {
  if (typeof document === "undefined") return false;
  return document.cookie
    .split(";")
    .some((pair) => pair.trim().startsWith(`${GATE_SESSION_MARKER_COOKIE}=`));
}
