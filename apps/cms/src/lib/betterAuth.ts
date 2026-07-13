import { betterAuth } from "better-auth"
import { Pool } from "pg"
import { nextCookies } from "better-auth/next-js"
import { magicLink } from "better-auth/plugins"
import { getBetterAuthInfraPlugins } from "@/lib/betterAuthInfra"
import { getEnabledSocialAuthProviders } from "@/lib/socialAuth/providers"
import { resolvePayloadUserForSocialSignup } from "@/lib/socialAuth/payloadUser"
import { getBetterAuthBaseURL, getTrustedSocialAuthOrigins } from "@/lib/socialAuth/hosts"
import { getMagicLinkRateLimit } from "@/lib/auth/magicLinkRateLimit"
import { sendCmsMagicLinkEmail } from "@/lib/auth/sendCmsMagicLinkEmail"
import { CMS_SESSION_EXPIRES_IN_SECONDS, SESSION_UPDATE_AGE_SECONDS } from "@/lib/auth/sessionDurations"

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
        await sendCmsMagicLinkEmail({ email, url, metadata })
      },
    }),
    nextCookies(),
  ],
})

export const enabledSocialAuthProviders = getEnabledSocialAuthProviders()
