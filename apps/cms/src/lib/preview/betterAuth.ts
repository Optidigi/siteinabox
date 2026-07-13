import { betterAuth } from "better-auth"
import { APIError } from "better-auth/api"
import { Pool } from "pg"
import { magicLink } from "better-auth/plugins"
import { getMagicLinkRateLimit } from "@/lib/auth/magicLinkRateLimit"
import { hasActivePreviewGrant } from "@/lib/preview/previewAccess"
import { sendEmail } from "@/lib/email/sendEmail"
import { magicLinkTemplate } from "@/lib/email/templates/magicLink"
import { siteReadyPreviewTemplate } from "@/lib/email/templates/siteReadyPreview"
import { PREVIEW_SESSION_EXPIRES_IN_SECONDS, SESSION_UPDATE_AGE_SECONDS } from "@/lib/auth/sessionDurations"
import { isPrivilegedPreviewSiteReadyMetadata } from "@/lib/preview/trustedSiteReadyIntent"

async function getMailPayload() {
  const [{ getPayload }, configModule] = await Promise.all([
    import("payload"),
    import("@/payload.config"),
  ])
  return getPayload({ config: configModule.default })
}

const DATABASE_URI = process.env.DATABASE_URI
if (!DATABASE_URI) {
  throw new Error("DATABASE_URI is required for Preview Better Auth")
}

const authSecret = process.env.BETTER_AUTH_PREVIEW_SECRET || process.env.BETTER_AUTH_SECRET || process.env.PAYLOAD_SECRET
if (!authSecret) {
  throw new Error("BETTER_AUTH_PREVIEW_SECRET, BETTER_AUTH_SECRET, or PAYLOAD_SECRET is required for Preview Better Auth")
}

declare global {
  // eslint-disable-next-line no-var
  var __siabPreviewBetterAuthPool: Pool | undefined
}

const pool = globalThis.__siabPreviewBetterAuthPool ?? new Pool({
  connectionString: DATABASE_URI,
  ...(process.env.PG_POOL_MAX ? { max: parseInt(process.env.PG_POOL_MAX, 10) } : {}),
  ...(process.env.PG_CONN_TIMEOUT_MS
    ? { connectionTimeoutMillis: parseInt(process.env.PG_CONN_TIMEOUT_MS, 10) }
    : {}),
})

if (process.env.NODE_ENV !== "production") {
  globalThis.__siabPreviewBetterAuthPool = pool
}

export const PREVIEW_ORIGIN = "https://preview.siteinabox.nl"
const DEV_PREVIEW_HOST_PATTERNS = [
  "localhost:*",
  "127.0.0.1:*",
  "*.localhost:*",
  "*.lvh.me:*",
  "*.localtest.me:*",
]

const DEV_PREVIEW_ORIGIN_PATTERNS = DEV_PREVIEW_HOST_PATTERNS.flatMap((host) => [
  `http://${host}`,
  `https://${host}`,
])

export function getPreviewBetterAuthBaseURL() {
  const allowedHosts = ["preview.siteinabox.nl"]
  if (process.env.NODE_ENV === "development") {
    allowedHosts.push(...DEV_PREVIEW_HOST_PATTERNS)
  }

  return {
    allowedHosts,
    protocol: (process.env.NODE_ENV === "development" ? "http" : "https") as "http" | "https",
    fallback: PREVIEW_ORIGIN,
  } as const
}

export function getPreviewTrustedOrigins() {
  const origins = [PREVIEW_ORIGIN]
  if (process.env.NODE_ENV === "development") {
    origins.push(...DEV_PREVIEW_ORIGIN_PATTERNS)
  }
  return origins
}

export const previewAuth = betterAuth({
  appName: "SiteInABox Preview",
  baseURL: getPreviewBetterAuthBaseURL(),
  basePath: "/api/preview-auth",
  secret: authSecret,
  database: pool,
  trustedOrigins: getPreviewTrustedOrigins(),
  telemetry: { enabled: false },
  advanced: {
    cookiePrefix: "siab-preview-auth",
    trustedProxyHeaders: true,
  },
  user: {
    modelName: "preview_auth_users",
  },
  session: {
    modelName: "preview_auth_sessions",
    expiresIn: PREVIEW_SESSION_EXPIRES_IN_SECONDS,
    updateAge: SESSION_UPDATE_AGE_SECONDS,
    cookieCache: { enabled: false },
  },
  account: {
    modelName: "preview_auth_accounts",
  },
  verification: {
    modelName: "preview_auth_verifications",
  },
  plugins: [
    magicLink({
      expiresIn: 300,
      rateLimit: getMagicLinkRateLimit(),
      sendMagicLink: async ({ email, url, metadata }) => {
        const clientSlug = typeof metadata?.previewClientSlug === "string" ? metadata.previewClientSlug : ""
        if (!clientSlug || !(await hasActivePreviewGrant(email, clientSlug))) {
          throw new APIError("UNAUTHORIZED", {
            message: "No active preview access grant matches this email.",
          })
        }
        const siteReady = isPrivilegedPreviewSiteReadyMetadata({ email, clientSlug, metadata })
        const message = siteReady
          ? siteReadyPreviewTemplate({ loginUrl: url })
          : magicLinkTemplate({ loginUrl: url })
        const payload = await getMailPayload()
        await sendEmail({
          to: email,
          subject: message.subject,
          html: message.html,
          text: message.text,
          intent: siteReady ? "preview.site_ready" : "preview.magic_link",
          payload: payload as any,
        })
      },
    }),
  ],
})
