import { makeSignature } from "better-auth/crypto"
import { Pool } from "pg"
import { getPayload } from "payload"
import { PREVIEW_SESSION_EXPIRES_IN_SECONDS } from "@/lib/auth/sessionDurations"
import { upsertBuilderRegistration } from "@/lib/builder/sessionStore"
import { previewAuth } from "@/lib/preview/betterAuth"
import config from "@/payload.config"

export const LOCAL_BUILDER_EMAIL = "builder@local.test"
export const LOCAL_BUILDER_NAME = "Local Builder"

export type LocalPreviewSessionCookie = {
  name: string
  value: string
  httpOnly: true
  path: "/"
  sameSite: "lax"
  secure: boolean
  maxAge: number
}

const LOCAL_LEGAL = {
  businessUseAccepted: true,
  termsAccepted: true,
  marketingOptIn: false,
} as const

async function assertPreviewAuthSchema(): Promise<void> {
  const connectionString = process.env.DATABASE_URI
  if (!connectionString) throw new Error("DATABASE_URI is required")
  const pool = new Pool({ connectionString, max: 1 })
  try {
    const result = await pool.query<{ ready: boolean }>(`SELECT
      to_regclass('public.customer_accounts') IS NOT NULL AND
      EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public'
        AND table_name='preview_auth_users' AND column_name='firstVerifiedAt') AND
      EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public'
        AND table_name='preview_auth_users' AND column_name='verificationHistoryUnknown') AND
      EXISTS (SELECT 1 FROM pg_trigger WHERE tgrelid=to_regclass('public.preview_auth_users')
        AND tgname='siab_first_verification' AND NOT tgisinternal AND tgenabled='O') AS ready`)
    if (result.rows[0]?.ready !== true) throw new Error("Apply the committed CMS migrations before local preview login.")
  } finally {
    await pool.end()
  }
}

export async function createLocalPreviewSessionCookie(): Promise<LocalPreviewSessionCookie> {
  await assertPreviewAuthSchema()
  const payload = await getPayload({ config })
  await upsertBuilderRegistration(payload, {
    email: LOCAL_BUILDER_EMAIL,
    displayName: LOCAL_BUILDER_NAME,
    legal: LOCAL_LEGAL,
  })

  const ctx = await previewAuth.$context
  const existing = await ctx.internalAdapter.findUserByEmail(LOCAL_BUILDER_EMAIL)
  const user = existing?.user ?? await ctx.internalAdapter.createUser({
    email: LOCAL_BUILDER_EMAIL,
    name: LOCAL_BUILDER_NAME,
    emailVerified: true,
  }, { method: "admin" })
  const session = await ctx.internalAdapter.createSession(user.id, false)
  const token = session.token
  if (!token) {
    throw new Error("local_preview_session_missing_token")
  }

  const secret = typeof ctx.secret === "string" ? ctx.secret : ""
  if (!secret) {
    throw new Error("local_preview_session_missing_secret")
  }

  const cookieName = ctx.authCookies.sessionToken.name
  const attributes = ctx.authCookies.sessionToken.attributes
  return {
    name: cookieName,
    value: `${token}.${await makeSignature(token, secret)}`,
    httpOnly: true,
    path: "/",
    sameSite: "lax",
    secure: attributes.secure === true,
    maxAge: PREVIEW_SESSION_EXPIRES_IN_SECONDS,
  }
}
