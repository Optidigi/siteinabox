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

const PREVIEW_AUTH_TABLES_SQL = `
CREATE TABLE IF NOT EXISTS preview_auth_users (
  id text PRIMARY KEY NOT NULL,
  name text NOT NULL,
  email text NOT NULL UNIQUE,
  "emailVerified" boolean NOT NULL,
  image text,
  "createdAt" timestamptz NOT NULL,
  "updatedAt" timestamptz NOT NULL
);
CREATE TABLE IF NOT EXISTS preview_auth_sessions (
  id text PRIMARY KEY NOT NULL,
  "expiresAt" timestamptz NOT NULL,
  token text NOT NULL UNIQUE,
  "createdAt" timestamptz NOT NULL,
  "updatedAt" timestamptz NOT NULL,
  "ipAddress" text,
  "userAgent" text,
  "userId" text NOT NULL REFERENCES preview_auth_users(id) ON DELETE cascade
);
CREATE TABLE IF NOT EXISTS preview_auth_accounts (
  id text PRIMARY KEY NOT NULL,
  "accountId" text NOT NULL,
  "providerId" text NOT NULL,
  "userId" text NOT NULL REFERENCES preview_auth_users(id) ON DELETE cascade,
  "accessToken" text,
  "refreshToken" text,
  "idToken" text,
  "accessTokenExpiresAt" timestamptz,
  "refreshTokenExpiresAt" timestamptz,
  scope text,
  password text,
  "createdAt" timestamptz NOT NULL,
  "updatedAt" timestamptz NOT NULL
);
CREATE TABLE IF NOT EXISTS preview_auth_verifications (
  id text PRIMARY KEY NOT NULL,
  identifier text NOT NULL,
  value text NOT NULL,
  "expiresAt" timestamptz NOT NULL,
  "createdAt" timestamptz NOT NULL,
  "updatedAt" timestamptz NOT NULL
);
CREATE INDEX IF NOT EXISTS preview_auth_sessions_userId_idx ON preview_auth_sessions ("userId");
CREATE INDEX IF NOT EXISTS preview_auth_accounts_userId_idx ON preview_auth_accounts ("userId");
CREATE INDEX IF NOT EXISTS preview_auth_verifications_identifier_idx ON preview_auth_verifications (identifier);
`

async function ensurePreviewAuthTables(): Promise<void> {
  const connectionString = process.env.DATABASE_URI
  if (!connectionString) throw new Error("DATABASE_URI is required")
  const pool = new Pool({ connectionString, max: 1 })
  try {
    await pool.query(PREVIEW_AUTH_TABLES_SQL)
  } finally {
    await pool.end()
  }
}

export async function createLocalPreviewSessionCookie(): Promise<LocalPreviewSessionCookie> {
  await ensurePreviewAuthTables()
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
  })
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
