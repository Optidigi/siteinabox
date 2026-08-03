const TURNSTILE_SITEVERIFY_URL =
  "https://challenges.cloudflare.com/turnstile/v0/siteverify"
const TURNSTILE_ACTION = "platform-contact"
const MAX_TOKEN_LENGTH = 2048
const DEFAULT_HOSTNAMES = ["siteinabox.nl", "www.siteinabox.nl"]

type TurnstileResponse = {
  success?: unknown
  hostname?: unknown
  action?: unknown
  "error-codes"?: unknown
}

export type TurnstileVerification =
  | { ok: true }
  | {
      ok: false
      code: "turnstile_invalid" | "turnstile_unavailable"
      status: 400 | 503
    }

type VerifyTurnstileOptions = {
  token: unknown
  remoteIp?: string
  secret?: string
  expectedHostnames?: readonly string[]
  fetchImpl?: typeof fetch
  idempotencyKey?: string
}

const configuredHostnames = (): string[] => {
  const configured = process.env.TURNSTILE_EXPECTED_HOSTNAMES
    ?.split(",")
    .map((hostname) => hostname.trim().toLowerCase())
    .filter(Boolean)
  return configured?.length ? configured : DEFAULT_HOSTNAMES
}

const isTurnstileResponse = (value: unknown): value is TurnstileResponse =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value)

const TOKEN_ERROR_CODES = new Set([
  "missing-input-response",
  "invalid-input-response",
  "timeout-or-duplicate",
])

export async function verifyTurnstile({
  token,
  remoteIp,
  secret = process.env.TURNSTILE_SECRET_KEY,
  expectedHostnames = configuredHostnames(),
  fetchImpl = fetch,
  idempotencyKey = crypto.randomUUID(),
}: VerifyTurnstileOptions): Promise<TurnstileVerification> {
  if (typeof token !== "string" || !token.trim() || token.length > MAX_TOKEN_LENGTH) {
    return { ok: false, code: "turnstile_invalid", status: 400 }
  }
  if (!secret?.trim()) {
    return { ok: false, code: "turnstile_unavailable", status: 503 }
  }

  const body = new URLSearchParams({
    secret,
    response: token,
    idempotency_key: idempotencyKey,
  })
  if (remoteIp?.trim()) body.set("remoteip", remoteIp.trim())

  let response: Response
  try {
    response = await fetchImpl(TURNSTILE_SITEVERIFY_URL, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body,
      signal: AbortSignal.timeout(5_000),
    })
  } catch {
    return { ok: false, code: "turnstile_unavailable", status: 503 }
  }
  if (!response.ok) {
    return { ok: false, code: "turnstile_unavailable", status: 503 }
  }

  let result: unknown
  try {
    result = await response.json()
  } catch {
    return { ok: false, code: "turnstile_unavailable", status: 503 }
  }
  if (!isTurnstileResponse(result)) {
    return { ok: false, code: "turnstile_unavailable", status: 503 }
  }

  if (result.success !== true) {
    const errorCodes = Array.isArray(result["error-codes"])
      ? result["error-codes"].filter((code): code is string => typeof code === "string")
      : []
    return errorCodes.length > 0 && errorCodes.every((code) => TOKEN_ERROR_CODES.has(code))
      ? { ok: false, code: "turnstile_invalid", status: 400 }
      : { ok: false, code: "turnstile_unavailable", status: 503 }
  }

  const hostname = typeof result.hostname === "string"
    ? result.hostname.toLowerCase()
    : ""
  if (
    result.action !== TURNSTILE_ACTION
    || !expectedHostnames.includes(hostname)
  ) {
    return { ok: false, code: "turnstile_invalid", status: 400 }
  }

  return { ok: true }
}
