import "server-only"

import crypto from "node:crypto"

const AUTHORIZATION_TTL_MS = 5 * 60_000
const SIGNATURE_VERSION = "preview-site-ready-v1"

type PreviewSiteReadySubject = {
  email: string
  clientSlug: string
}

export type PreviewSiteReadyAuthorization = {
  expiresAt: string
  signature: string
}

function signingSecret(env: NodeJS.ProcessEnv = process.env): string {
  const secret = env.BETTER_AUTH_PREVIEW_SECRET || env.BETTER_AUTH_SECRET || env.PAYLOAD_SECRET
  if (!secret) {
    throw new Error("A Better Auth or Payload secret is required to authorize preview site-ready mail.")
  }
  return secret
}

function normalizedSubject(subject: PreviewSiteReadySubject) {
  return {
    email: subject.email.trim().toLowerCase(),
    clientSlug: subject.clientSlug.trim().toLowerCase(),
  }
}

function signatureInput(subject: PreviewSiteReadySubject, expiresAt: string): string {
  const normalized = normalizedSubject(subject)
  return JSON.stringify([
    SIGNATURE_VERSION,
    normalized.email,
    normalized.clientSlug,
    expiresAt,
  ])
}

function sign(subject: PreviewSiteReadySubject, expiresAt: string, env: NodeJS.ProcessEnv): string {
  return crypto
    .createHmac("sha256", signingSecret(env))
    .update(signatureInput(subject, expiresAt))
    .digest("hex")
}

export function createPreviewSiteReadyAuthorization(
  subject: PreviewSiteReadySubject,
  options: { now?: Date; env?: NodeJS.ProcessEnv } = {},
): PreviewSiteReadyAuthorization {
  const now = options.now ?? new Date()
  const env = options.env ?? process.env
  const expiresAt = new Date(now.getTime() + AUTHORIZATION_TTL_MS).toISOString()
  return { expiresAt, signature: sign(subject, expiresAt, env) }
}

export function isAuthorizedPreviewSiteReady(
  subject: PreviewSiteReadySubject,
  authorization: unknown,
  options: { now?: Date; env?: NodeJS.ProcessEnv } = {},
): boolean {
  if (!authorization || typeof authorization !== "object" || Array.isArray(authorization)) return false
  const record = authorization as Record<string, unknown>
  if (typeof record.expiresAt !== "string" || typeof record.signature !== "string") return false
  if (!/^[a-f0-9]{64}$/.test(record.signature)) return false

  const now = options.now ?? new Date()
  const expiresAtMs = Date.parse(record.expiresAt)
  if (!Number.isFinite(expiresAtMs) || expiresAtMs < now.getTime()) return false
  if (expiresAtMs > now.getTime() + AUTHORIZATION_TTL_MS) return false

  let expected: string
  try {
    expected = sign(subject, record.expiresAt, options.env ?? process.env)
  } catch {
    return false
  }
  return crypto.timingSafeEqual(Buffer.from(record.signature, "hex"), Buffer.from(expected, "hex"))
}

export function isPrivilegedPreviewSiteReadyMetadata(input: {
  email: string
  clientSlug: string
  metadata: unknown
  now?: Date
  env?: NodeJS.ProcessEnv
}): boolean {
  if (!input.metadata || typeof input.metadata !== "object" || Array.isArray(input.metadata)) return false
  const metadata = input.metadata as Record<string, unknown>
  return metadata.previewSiteReady === true && isAuthorizedPreviewSiteReady(
    { email: input.email, clientSlug: input.clientSlug },
    metadata.previewSiteReadyAuthorization,
    { now: input.now, env: input.env },
  )
}
