import type { SocialProvider } from "better-auth/social-providers"

export const SOCIAL_AUTH_PROVIDERS = ["google", "microsoft", "apple"] as const

export type SocialAuthProvider = Extract<SocialProvider, (typeof SOCIAL_AUTH_PROVIDERS)[number]>

export const SOCIAL_AUTH_PROVIDER_LABELS: Record<SocialAuthProvider, string> = {
  google: "Google",
  microsoft: "Microsoft",
  apple: "Apple",
}

const hasEnvPair = (
  env: NodeJS.ProcessEnv,
  id: string,
  secret: string,
): boolean => Boolean(env[id]?.trim() && env[secret]?.trim())

export const getEnabledSocialAuthProviders = (
  env: NodeJS.ProcessEnv = process.env,
): SocialAuthProvider[] =>
  SOCIAL_AUTH_PROVIDERS.filter((provider) => {
    if (provider === "google") return hasEnvPair(env, "GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET")
    if (provider === "microsoft") return hasEnvPair(env, "MICROSOFT_CLIENT_ID", "MICROSOFT_CLIENT_SECRET")
    return hasEnvPair(env, "APPLE_CLIENT_ID", "APPLE_CLIENT_SECRET")
  })

const normalizeHost = (value: string | null | undefined): string => {
  const candidate = (value ?? "").split(",")[0]?.trim().toLowerCase() ?? ""
  if (!candidate) return ""
  try {
    return new URL(
      candidate.includes("://") ? candidate : `https://${candidate}`,
    ).hostname.toLowerCase()
  } catch {
    return ""
  }
}

const callbackHostEnvKey: Record<SocialAuthProvider, string> = {
  google: "SIAB_GOOGLE_OAUTH_CALLBACK_HOSTS",
  microsoft: "SIAB_MICROSOFT_OAUTH_CALLBACK_HOSTS",
  apple: "SIAB_APPLE_OAUTH_CALLBACK_HOSTS",
}

const configuredCallbackHosts = (
  provider: SocialAuthProvider,
  env: NodeJS.ProcessEnv = process.env,
): Set<string> => {
  const hosts = new Set<string>()
  for (const value of (env[callbackHostEnvKey[provider]] ?? "").split(",")) {
    const host = normalizeHost(value)
    if (host) hosts.add(host)
  }
  return hosts
}

export const socialAuthCallbackRegisteredForHost = (
  provider: SocialAuthProvider,
  host: string | null | undefined,
  env: NodeJS.ProcessEnv = process.env,
): boolean => {
  const normalized = normalizeHost(host)
  if (!normalized) return false
  if (
    env.NODE_ENV === "development" &&
    (normalized === "localhost" || normalized.endsWith(".localhost") ||
      normalized.startsWith("127."))
  ) {
    return true
  }
  return configuredCallbackHosts(provider, env).has(normalized)
}

export const getEnabledSocialAuthProvidersForHost = (
  host: string | null | undefined,
  env: NodeJS.ProcessEnv = process.env,
): SocialAuthProvider[] =>
  getEnabledSocialAuthProviders(env).filter((provider) =>
    socialAuthCallbackRegisteredForHost(provider, host, env))

export const isSocialAuthProvider = (
  value: unknown,
): value is SocialAuthProvider =>
  typeof value === "string" &&
  SOCIAL_AUTH_PROVIDERS.includes(value as SocialAuthProvider)
