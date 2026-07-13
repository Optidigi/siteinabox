import { betterAuth } from "better-auth"
import { Pool } from "pg"
import { nextCookies } from "better-auth/next-js"
import { magicLink } from "better-auth/plugins"
import { getBetterAuthInfraPlugins } from "@/lib/betterAuthInfra"
import { getEnabledSocialAuthProviders } from "@/lib/socialAuth/providers"
import { resolvePayloadUserForMagicLink, resolvePayloadUserForSocialSignup } from "@/lib/socialAuth/payloadUser"
import { getBetterAuthBaseURL, getTrustedSocialAuthOrigins } from "@/lib/socialAuth/hosts"
import { getMagicLinkRateLimit } from "@/lib/auth/magicLinkRateLimit"
import { getPlatformMailSender, sendEmail } from "@/lib/email/sendEmail"
import { magicLinkTemplate } from "@/lib/email/templates/magicLink"
import { inviteTemplate } from "@/lib/email/templates/invite"
import { siteLiveNoticeTemplate } from "@/lib/email/templates/siteLiveNotice"
import { CMS_SESSION_EXPIRES_IN_SECONDS, SESSION_UPDATE_AGE_SECONDS } from "@/lib/auth/sessionDurations"

async function getMailPayload() {
  const [{ getPayload }, configModule] = await Promise.all([
    import("payload"),
    import("@/payload.config"),
  ])
  return getPayload({ config: configModule.default })
}

const DATABASE_URI = process.env.DATABASE_URI
if (!DATABASE_URI) {
  throw new Error("DATABASE_URI is required for Better Auth")
}

const authSecret = process.env.BETTER_AUTH_SECRET || process.env.PAYLOAD_SECRET
if (!authSecret) {
  throw new Error("BETTER_AUTH_SECRET or PAYLOAD_SECRET is required for Better Auth")
}

declare global {
  // eslint-disable-next-line no-var
  var __siabBetterAuthPool: Pool | undefined
}

const pool = globalThis.__siabBetterAuthPool ?? new Pool({
  connectionString: DATABASE_URI,
  ...(process.env.PG_POOL_MAX ? { max: parseInt(process.env.PG_POOL_MAX, 10) } : {}),
  ...(process.env.PG_CONN_TIMEOUT_MS
    ? { connectionTimeoutMillis: parseInt(process.env.PG_CONN_TIMEOUT_MS, 10) }
    : {}),
})

if (process.env.NODE_ENV !== "production") {
  globalThis.__siabBetterAuthPool = pool
}

const providerConfig = {
  ...(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
    ? {
        google: {
          clientId: process.env.GOOGLE_CLIENT_ID,
          clientSecret: process.env.GOOGLE_CLIENT_SECRET,
          disableImplicitSignUp: true,
          scope: ["openid", "email", "profile"],
          prompt: "select_account" as const,
        },
      }
    : {}),
  ...(process.env.MICROSOFT_CLIENT_ID && process.env.MICROSOFT_CLIENT_SECRET
    ? {
        microsoft: {
          clientId: process.env.MICROSOFT_CLIENT_ID,
          clientSecret: process.env.MICROSOFT_CLIENT_SECRET,
          tenantId: process.env.MICROSOFT_TENANT_ID || "common",
          disableImplicitSignUp: true,
          scope: ["openid", "email", "profile"],
          prompt: "select_account" as const,
        },
      }
    : {}),
  ...(process.env.APPLE_CLIENT_ID && process.env.APPLE_CLIENT_SECRET
    ? {
        apple: {
          clientId: process.env.APPLE_CLIENT_ID,
          clientSecret: process.env.APPLE_CLIENT_SECRET,
          disableImplicitSignUp: true,
          scope: ["name", "email"],
        },
      }
    : {}),
}

const metadataText = (metadata: unknown, key: string): string | null => {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return null
  const value = (metadata as Record<string, unknown>)[key]
  return typeof value === "string" && value.trim() ? value.trim() : null
}

const metadataTenant = (metadata: unknown): string | number | null => {
  const value = metadataText(metadata, "tenantId")
  if (!value) return null
  const numeric = Number(value)
  return Number.isSafeInteger(numeric) && String(numeric) === value ? numeric : value
}

export const auth = betterAuth({
  appName: "SiteInABox",
  baseURL: getBetterAuthBaseURL(),
  secret: authSecret,
  database: pool,
  trustedOrigins: getTrustedSocialAuthOrigins,
  telemetry: { enabled: false },
  advanced: {
    trustedProxyHeaders: true,
  },
  user: {
    modelName: "better_auth_users",
    additionalFields: {
      payloadUserId: {
        type: "string",
        required: true,
        input: false,
        unique: true,
      },
    },
  },
  session: {
    modelName: "better_auth_sessions",
    expiresIn: CMS_SESSION_EXPIRES_IN_SECONDS,
    updateAge: SESSION_UPDATE_AGE_SECONDS,
    cookieCache: { enabled: false },
  },
  account: {
    modelName: "better_auth_accounts",
    accountLinking: {
      enabled: true,
      allowDifferentEmails: false,
      allowUnlinkingAll: false,
    },
  },
  verification: {
    modelName: "better_auth_verifications",
  },
  socialProviders: providerConfig,
  databaseHooks: {
    user: {
      create: {
        before: async (user) => {
          const payloadUser = await resolvePayloadUserForSocialSignup(user)
          return {
            data: {
              ...user,
              payloadUserId: String(payloadUser.id),
            },
          }
        },
      },
    },
  },
  plugins: [
    ...getBetterAuthInfraPlugins(),
    magicLink({
      expiresIn: 300,
      rateLimit: getMagicLinkRateLimit(),
      sendMagicLink: async ({ email, url, metadata }) => {
        await resolvePayloadUserForMagicLink(email)
        const payload = await getMailPayload()
        const intent = metadataText(metadata, "intent")
        if (intent === "user_invite") {
          const tenantId = metadataTenant(metadata)
          const tenantName = metadataText(metadata, "tenantName")
          const recipientName = metadataText(metadata, "recipientName")
          const role = metadataText(metadata, "role")
          if (tenantId == null || !tenantName || !recipientName || !role || !["owner", "editor", "viewer"].includes(role)) {
            throw new Error("Invitation magic-link metadata is incomplete or invalid.")
          }
          const message = inviteTemplate({
            tenantName,
            recipientName,
            role: role as "owner" | "editor" | "viewer",
            inviteUrl: url,
          })
          await sendEmail({
            to: email,
            subject: message.subject,
            html: message.html,
            text: message.text,
            intent: "auth.magic_link",
            tenant: tenantId,
            payload: payload as any,
          })
          return
        }
        if (intent === "site_live_handoff") {
          const siteUrl = metadataText(metadata, "siteUrl")
          const adminUrl = metadataText(metadata, "adminUrl")
          if (!siteUrl || !adminUrl) {
            throw new Error("Live handoff magic-link metadata is missing siteUrl or adminUrl.")
          }
          const message = siteLiveNoticeTemplate({ siteUrl, adminUrl, magicLoginUrl: url })
          await sendEmail({
            to: email,
            from: getPlatformMailSender(),
            subject: message.subject,
            html: message.html,
            text: message.text,
            intent: "site.live_notice",
            tenant: metadataTenant(metadata),
            payload: payload as any,
          })
          return
        }
        const message = magicLinkTemplate({ loginUrl: url })
        await sendEmail({
          to: email,
          subject: message.subject,
          html: message.html,
          text: message.text,
          intent: "auth.magic_link",
          payload: payload as any,
        })
      },
    }),
    nextCookies(),
  ],
})

export const enabledSocialAuthProviders = getEnabledSocialAuthProviders()
