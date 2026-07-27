import "server-only"

import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
} from "node:crypto"

const ENVELOPE_VERSION = "v1"

const encryptionKey = (env: NodeJS.ProcessEnv): Buffer => {
  const encoded = env.DOMAIN_MIGRATION_ENCRYPTION_KEY?.trim()
  if (!encoded) throw new Error("DOMAIN_MIGRATION_ENCRYPTION_KEY is required.")
  const key = Buffer.from(encoded, "base64")
  if (key.length !== 32) {
    throw new Error("DOMAIN_MIGRATION_ENCRYPTION_KEY must decode to exactly 32 bytes.")
  }
  return key
}

const migrationAad = (binding: string): Buffer => {
  const normalized = binding.trim()
  if (!normalized) throw new Error("Migration secret binding is required.")
  return Buffer.from(`siteinabox:domain-migration:${normalized}`, "utf8")
}

export function sealMigrationSecret(
  plaintext: string,
  binding: string,
  env: NodeJS.ProcessEnv = process.env,
): string {
  if (!plaintext.trim()) throw new Error("A non-empty migration secret is required.")
  const iv = randomBytes(12)
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(env), iv)
  cipher.setAAD(migrationAad(binding))
  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ])
  return [
    ENVELOPE_VERSION,
    iv.toString("base64url"),
    cipher.getAuthTag().toString("base64url"),
    encrypted.toString("base64url"),
  ].join(".")
}

export function openMigrationSecret(
  envelope: string,
  binding: string,
  env: NodeJS.ProcessEnv = process.env,
): string {
  const [version, ivValue, tagValue, ciphertextValue, ...extra] = envelope.split(".")
  if (
    version !== ENVELOPE_VERSION ||
    !ivValue ||
    !tagValue ||
    !ciphertextValue ||
    extra.length > 0
  ) {
    throw new Error("Migration secret envelope is invalid.")
  }
  const decipher = createDecipheriv(
    "aes-256-gcm",
    encryptionKey(env),
    Buffer.from(ivValue, "base64url"),
  )
  decipher.setAAD(migrationAad(binding))
  decipher.setAuthTag(Buffer.from(tagValue, "base64url"))
  return Buffer.concat([
    decipher.update(Buffer.from(ciphertextValue, "base64url")),
    decipher.final(),
  ]).toString("utf8")
}
