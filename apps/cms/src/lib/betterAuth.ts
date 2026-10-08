import { betterAuth } from "better-auth"
import { Pool } from "pg"
import { nextCookies } from "better-auth/next-js"
import { magicLink } from "better-auth/plugins"
import { getBetterAuthInfraPlugins } from "@/lib/betterAuthInfra"
import { paidHandoffPlugin } from "@/lib/auth/paidHandoff"
import { passwordlessBefore } from "@/lib/auth/passwordlessPolicy"
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

export const auth = betterAuth({
  appName: "SiteInABox",
  baseURL: getBetterAuthBaseURL(),
  secret: authSecret,
  database: pool,
  trustedOrigins: getTrustedSocialAuthOrigins,
  telemetry: { enabled: false },
  advanced: {
    useSecureCookies: process.env.NODE_ENV !== "development",
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
  emailAndPassword: { enabled: false },
  // Recipient/global durable claims govern mail dispatch across shared IPs.
  rateLimit: { customRules: { "/sign-in/magic-link": false } },
  hooks: { before: passwordlessBefore },
  databaseHooks: {
    session: {
      delete: {
        before: async (session) => {
          const { revokeBetterAuthBinding } = await import("@/lib/auth/customerSessionBridge")
          await revokeBetterAuthBinding(session.id)
        },
      },
    },
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
    paidHandoffPlugin(),
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

export const enabledSocialAuthProviders = []
