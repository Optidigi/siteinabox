import { betterAuth } from "better-auth"
import { APIError } from "better-auth/api"
import { Pool } from "pg"
import { magicLink } from "better-auth/plugins"
import { hasActivePreviewGrant } from "@/lib/preview/previewAccess"
import { sendEmail } from "@/lib/email/sendEmail"
import { magicLinkTemplate } from "@/lib/email/templates/magicLink"
import { siteReadyPreviewTemplate } from "@/lib/email/templates/siteReadyPreview"

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

const previewBaseURL = {
  allowedHosts: ["preview.siteinabox.nl", "localhost:*", "127.0.0.1:*"],
  protocol: (process.env.NODE_ENV === "development" ? "http" : "https") as "http" | "https",
}

export const previewAuth = betterAuth({
  appName: "SiteInABox Preview",
  baseURL: previewBaseURL,
  basePath: "/api/preview-auth",
  secret: authSecret,
  database: pool,
  trustedOrigins: ["https://preview.siteinabox.nl", "http://localhost:*", "http://127.0.0.1:*"],
  telemetry: { enabled: false },
  advanced: {
    cookiePrefix: "siab-preview-auth",
  },
  user: {
    modelName: "preview_auth_users",
  },
  session: {
    modelName: "preview_auth_sessions",
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
      rateLimit: { window: 60, max: 3 },
      sendMagicLink: async ({ email, url, metadata }) => {
        const clientSlug = typeof metadata?.previewClientSlug === "string" ? metadata.previewClientSlug : ""
        if (!clientSlug || !(await hasActivePreviewGrant(email, clientSlug))) {
          throw new APIError("UNAUTHORIZED", {
            message: "No active preview access grant matches this email.",
          })
        }
        const message = metadata?.previewSiteReady === true
          ? siteReadyPreviewTemplate({ loginUrl: url })
          : magicLinkTemplate({ loginUrl: url })
        await sendEmail({
          to: email,
          subject: message.subject,
          html: message.html,
        })
      },
    }),
  ],
})
