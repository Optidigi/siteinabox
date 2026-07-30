const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"])
type HeaderReader = Pick<Headers, "get">

const parseAuthority = (
  value: string | null,
): { host: string; hostname: string } | null => {
  const raw = value?.trim()
  if (!raw || raw.includes(",") || /[/?#@\\\s]/.test(raw)) return null
  try {
    const parsed = new URL(`https://${raw}`)
    if (
      parsed.username ||
      parsed.password ||
      parsed.pathname !== "/" ||
      parsed.search ||
      parsed.hash
    ) return null
    return {
      host: parsed.host.toLowerCase(),
      hostname: parsed.hostname.toLowerCase(),
    }
  } catch {
    return null
  }
}

export type CanonicalRequestAuthority = {
  host: string
  hostname: string
  origin: string
  developmentLoopback: boolean
}

export function canonicalRequestAuthority(
  headers: HeaderReader,
  env: NodeJS.ProcessEnv = process.env,
): CanonicalRequestAuthority | null {
  const direct = parseAuthority(headers.get("host"))
  const forwardedRaw = headers.get("x-forwarded-host")
  const forwarded = forwardedRaw == null ? null : parseAuthority(forwardedRaw)
  if (!direct || (forwardedRaw != null && !forwarded)) return null
  if (forwarded && forwarded.host !== direct.host) return null
  const authority = forwarded ?? direct
  const developmentLoopback =
    env.NODE_ENV === "development" && LOOPBACK_HOSTS.has(authority.hostname)
  const protocol = developmentLoopback ? "http" : "https"
  return {
    ...authority,
    origin: `${protocol}://${authority.host}`,
    developmentLoopback,
  }
}

export function browserOriginMatchesAuthority(
  headers: HeaderReader,
  options: {
    env?: NodeJS.ProcessEnv
    originRequired?: boolean
  } = {},
): boolean {
  const authority = canonicalRequestAuthority(headers, options.env)
  if (!authority) return false
  const origin = headers.get("origin")
  if (!origin) return options.originRequired !== true
  try {
    return new URL(origin).origin === authority.origin
  } catch {
    return false
  }
}

export function isPreviewRequestAuthority(
  headers: HeaderReader,
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  const authority = canonicalRequestAuthority(headers, env)
  if (!authority) return false
  return authority.hostname === "preview.siteinabox.nl" ||
    authority.developmentLoopback
}
