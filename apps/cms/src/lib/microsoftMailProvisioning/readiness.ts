import "server-only"
import { inspectMailConfiguration } from "../email/configuration.ts"
import { exchangeWorkerEndpointAllowed } from "./exchangeWorker.ts"

export type MicrosoftMailReadinessItem = {
  key: string
  ready: boolean
  requiredSettings: string[]
  note?: string
}

export type MicrosoftMailReadiness = {
  readyForLiveProvisioning: boolean
  items: MicrosoftMailReadinessItem[]
  missingSettings: string[]
}

const present = (env: NodeJS.ProcessEnv, name: string) => Boolean(env[name]?.trim())
const encryptionKeyPresent = (env: NodeJS.ProcessEnv, name: string) => {
  const value = env[name]?.trim() ?? ""
  return /^[a-f0-9]{64}$/i.test(value) || /^[a-zA-Z0-9+/]+={0,2}$/.test(value) && Buffer.from(value, "base64").length === 32
}
const publicOriginPresent = (env: NodeJS.ProcessEnv) => {
  try { const url = new URL(env.SITE_URL?.trim() || env.NEXT_PUBLIC_SIAB_SITE_URL?.trim() || ""); return url.protocol === "https:" || env.NODE_ENV !== "production" && ["localhost", "127.0.0.1"].includes(url.hostname) }
  catch { return false }
}

/** Presence check only: this never authenticates or contacts a provider. */
export function inspectMicrosoftMailReadiness(env: NodeJS.ProcessEnv = process.env): MicrosoftMailReadiness {
  const mail = inspectMailConfiguration(env)
  const items: MicrosoftMailReadinessItem[] = [
    {
      key: "pax8",
      ready: ["PAX8_CLIENT_ID", "PAX8_CLIENT_SECRET", "PAX8_ORDER_EMAIL", "PAX8_MPN_ID"].every(name => present(env, name)),
      requiredSettings: ["PAX8_CLIENT_ID", "PAX8_CLIENT_SECRET", "PAX8_ORDER_EMAIL", "PAX8_MPN_ID"],
    },
    {
      key: "microsoftPartnerApp",
      ready: ["MICROSOFT_PARTNER_TENANT_ID", "MICROSOFT_PARTNER_APP_CLIENT_ID", "MICROSOFT_PARTNER_APP_CLIENT_SECRET", "MICROSOFT_PARTNER_APP_REDIRECT_URI", "MICROSOFT_GDAP_ROLE_DEFINITION_IDS", "MICROSOFT_PARTNER_SECURITY_GROUP_ID"]
        .every((name) => present(env, name)) && env.MICROSOFT_PARTNER_APP_REDIRECT_URI?.startsWith("https://") === true,
      requiredSettings: ["MICROSOFT_PARTNER_TENANT_ID", "MICROSOFT_PARTNER_APP_CLIENT_ID", "MICROSOFT_PARTNER_APP_CLIENT_SECRET", "MICROSOFT_PARTNER_APP_REDIRECT_URI (HTTPS)", "MICROSOFT_GDAP_ROLE_DEFINITION_IDS", "MICROSOFT_PARTNER_SECURITY_GROUP_ID"],
      note: "The app needs Partner GDAP relationship permissions and customer tenant consent for Graph organization/domain/user/license operations. Presence does not validate permissions.",
    },
    {
      key: "microsoftCustomerAppModel",
      ready: encryptionKeyPresent(env, "MICROSOFT_PARTNER_TOKEN_ENCRYPTION_KEY"),
      requiredSettings: ["MICROSOFT_PARTNER_TOKEN_ENCRYPTION_KEY"],
      note: "The partner integration user must also complete MFA sign-in under Operations. This presence check does not verify the persisted connection or GDAP roles.",
    },
    {
      key: "cloudflareDns",
      ready: present(env, "CLOUDFLARE_API_TOKEN") && present(env, "CLOUDFLARE_ACCOUNT_ID"),
      requiredSettings: ["CLOUDFLARE_API_TOKEN", "CLOUDFLARE_ACCOUNT_ID"],
      note: "The token needs Zone DNS edit/read and Email Routing rules read for the existing info@ destination check.",
    },
    {
      key: "exchangeWorker",
      ready: present(env, "EXCHANGE_WORKER_URL") && present(env, "EXCHANGE_WORKER_SHARED_SECRET") &&
        exchangeWorkerEndpointAllowed(env.EXCHANGE_WORKER_URL ?? "") && (env.EXCHANGE_WORKER_SHARED_SECRET?.length ?? 0) >= 32,
      requiredSettings: ["EXCHANGE_WORKER_URL", "EXCHANGE_WORKER_SHARED_SECRET"],
      note: "Exchange uses the connected partner identity under GDAP. Only the CMS and worker share its unexposed Compose network; remote endpoints require HTTPS.",
    },
    { key: "emailPricing", ready: env["MICROSOFT_MAIL_CURRENCY"] === "EUR" && Number.isSafeInteger(Number(env.MICROSOFT_MAIL_ANNUAL_SEAT_NET_MINOR)) && Number(env.MICROSOFT_MAIL_ANNUAL_SEAT_NET_MINOR) > 0,
      requiredSettings: ["MICROSOFT_MAIL_CURRENCY=EUR", "MICROSOFT_MAIL_ANNUAL_SEAT_NET_MINOR"] },
    {
      key: "setupEmail",
      ready: mail.status === "configured",
      requiredSettings: ["CLOUDFLARE_EMAIL_API_TOKEN or CLOUDFLARE_EMAIL_SMTP_TOKEN", "CLOUDFLARE_ACCOUNT_ID", "EMAIL_FROM"],
      note: mail.status === "configured" ? `Configured transport: ${mail.provider}` : "No email is sent by this readiness check.",
    },
    {
      key: "setupCredentialEncryption",
      ready: encryptionKeyPresent(env, "MICROSOFT_MAIL_SETUP_ENCRYPTION_KEY"),
      requiredSettings: ["MICROSOFT_MAIL_SETUP_ENCRYPTION_KEY"],
      note: "Used to encrypt temporary mailbox credentials and one-time setup tokens at rest.",
    },
    {
      key: "setupLinkOrigin",
      ready: publicOriginPresent(env),
      requiredSettings: ["SITE_URL or NEXT_PUBLIC_SIAB_SITE_URL"],
      note: "Production setup links must resolve to the Siteinabox CMS host over HTTPS.",
    },
  ]
  const missingSettings = items.flatMap((item) => item.ready ? [] : item.requiredSettings)
  return { readyForLiveProvisioning: missingSettings.length === 0, items, missingSettings }
}
