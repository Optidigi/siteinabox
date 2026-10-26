import { createHash } from "node:crypto"
import type { CloudflareEmailRoutingRule } from "./cloudflare.ts"

export function inspectExistingMailRouting(domain: string, mailboxAddresses: string[], rules: CloudflareEmailRoutingRule[]) {
  const active = rules.filter(rule => rule.enabled)
  const known = new Set([`info@${domain}`, ...mailboxAddresses].map(value => value.toLowerCase()))
  for (const rule of active) {
    if (rule.matchers.length !== 1 || rule.actions.length !== 1 || rule.matchers.some(matcher => matcher.type === "all" || matcher.field !== "to" || !matcher.value || !known.has(matcher.value.toLowerCase())) ||
      rule.actions.some(action => action.type !== "forward")) {
      throw new Error("Existing email routes require review before moving this domain.")
    }
  }
  const info = active.filter(rule => rule.matchers.some(matcher => matcher.value?.toLowerCase() === `info@${domain}`))
  const destinations = [...new Set(info.flatMap(rule => rule.actions.flatMap(action => action.value ?? [])).map(value => value.toLowerCase()))]
  if (destinations.length > 1) throw new Error("The existing info@ route has multiple destinations and requires review.")
  const canonical = active.map(rule => JSON.stringify(rule)).sort()
  return { legacyInfoForwardTo: destinations[0] ?? null, routingHash: createHash("sha256").update(JSON.stringify(canonical)).digest("hex") }
}
