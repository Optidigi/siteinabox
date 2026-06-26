export function legacyPreviewTokensEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  if (env.NODE_ENV !== "production") return true
  return env.ENABLE_LEGACY_PREVIEW_TOKEN_ROUTE === "1"
}
