const REDACTION_PATTERNS: Array<[RegExp, string]> = [
  [/Bearer\s+[A-Za-z0-9._~+/=-]+/gi, "Bearer [redacted]"],
  [/api[_-]?token[=:]\s*[^,\s;]+/gi, "api_token=[redacted]"],
  [/(CLOUDFLARE_EMAIL_SMTP_TOKEN|CLOUDFLARE_API_TOKEN|MOLLIE_API_KEY|OPENAI_API_KEY|PAYLOAD_SECRET|BETTER_AUTH_SECRET)=([^,\s;]+)/gi, "$1=[redacted]"],
  [/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[redacted-email]"],
]

export function redactOperationalMessage(value: unknown): string {
  const message = value instanceof Error ? value.message : typeof value === "string" ? value : "Unknown operational error"
  return REDACTION_PATTERNS.reduce((current, [pattern, replacement]) => current.replace(pattern, replacement), message)
}
