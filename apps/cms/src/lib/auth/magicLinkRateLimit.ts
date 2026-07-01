const DEFAULT_MAGIC_LINK_RATE_LIMIT_WINDOW_SECONDS = 60
const DEFAULT_MAGIC_LINK_RATE_LIMIT_MAX = 10

const boundedInt = (value: string | undefined, fallback: number, min: number, max: number) => {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return fallback
  return Math.max(min, Math.min(Math.floor(parsed), max))
}

export function getMagicLinkRateLimit(env: NodeJS.ProcessEnv = process.env) {
  return {
    window: boundedInt(
      env.SIAB_MAGIC_LINK_RATE_LIMIT_WINDOW_SECONDS,
      DEFAULT_MAGIC_LINK_RATE_LIMIT_WINDOW_SECONDS,
      10,
      3_600,
    ),
    max: boundedInt(
      env.SIAB_MAGIC_LINK_RATE_LIMIT_MAX,
      DEFAULT_MAGIC_LINK_RATE_LIMIT_MAX,
      1,
      100,
    ),
  }
}
