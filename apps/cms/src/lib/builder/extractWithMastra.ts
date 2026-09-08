type EnvLookup = Record<string, string | undefined>

export const shouldUseMastraExtraction = (env: EnvLookup = process.env): boolean => {
  const provider = env.SITE_GENERATION_PROVIDER
  return provider === "mastra" || provider === "openai"
}

export const canUseMastraSiteEditor = (env: EnvLookup = process.env): boolean =>
  shouldUseMastraExtraction(env) && Boolean(env.OPENAI_API_KEY?.trim())
