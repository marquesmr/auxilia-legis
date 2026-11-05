export function env(key: string): string | undefined {
  const v = process.env[key]?.trim();
  return v || undefined;
}

/** Prévia do sandbox não tem GROK_PROJECT_ID; a publicação tem. É o critério de público do gate e do token. */
export function isWorkspacePreview(): boolean {
  return !env("GROK_PROJECT_ID");
}
