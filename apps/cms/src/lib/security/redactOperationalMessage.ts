const REDACTION_PATTERNS: Array<[RegExp, string]> = [
  [/Bearer\s+[A-Za-z0-9._~+/=-]+/gi, "Bearer [redacted]"],
  [/(APPLE_CLIENT_SECRET|BETTER_AUTH_PREVIEW_SECRET|BETTER_AUTH_SECRET|BOOTSTRAP_TOKEN|CLOUDFLARE_API_TOKEN|CLOUDFLARE_EMAIL_API_TOKEN|CLOUDFLARE_EMAIL_SMTP_TOKEN|CLOUDFLARE_SOURCE_OAUTH_CLIENT_SECRET|DOMAIN_MIGRATION_ENCRYPTION_KEY|GOOGLE_CLIENT_SECRET|KVK_API_KEY|MICROSOFT_CLIENT_SECRET|MOLLIE_API_KEY|OPENAI_API_KEY|OPENPROVIDER_PASSWORD|PAYLOAD_SECRET|POSTHOG_API_KEY|POSTHOG_PERSONAL_API_KEY|POSTHOG_PROJECT_TOKEN|SIAB_EMAIL_PREFERENCE_SECRET|SIAB_OPERATIONAL_HASH_KEY|SIAB_RENDERER_API_TOKEN|STATUS_MONITOR_INVENTORY_TOKEN)=([^,\s;]+)/gi, "$1=[redacted]"],
  [/(^|[^A-Z0-9_])api[_-]?token[=:]\s*[^,\s;]+/gi, "$1api_token=[redacted]"],
  [/(auth|epp|transfer)[_-]?code[=:]\s*[^,\s;]+/gi, "transfer_code=[redacted]"],
  [/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[redacted-email]"],
]

export function redactOperationalMessage(value: unknown): string {
  const message = value instanceof Error ? value.message : typeof value === "string" ? value : "Unknown operational error"
  return REDACTION_PATTERNS.reduce((current, [pattern, replacement]) => current.replace(pattern, replacement), message)
}
