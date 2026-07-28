import "server-only"

import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
} from "node:crypto"
import {
  completeZoneExportSchema,
  normalizeCompleteZone,
  type CompleteZoneExport,
  type NormalizedCompleteZone,
} from "@siteinabox/contracts/domain-migration"
import type { MigrationClassification } from "@siteinabox/contracts/commerce"
import { domainMigrationSourceAuthorityHash } from "@/lib/domains/migrationEvidence"

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

export type CheckoutMigrationInput = {
  schemaVersion: 1
  generationRunId: string
  domain: string
  classification: Exclude<MigrationClassification, "complex">
  sourceMechanism: "customer_authorized_provider_export_v1"
  sourceZoneHash: string
  sourceZone: CompleteZoneExport
  transferCode: string
  transferAuthorizationAccepted: true
}

export type OpenedCheckoutMigrationInput = Omit<
  CheckoutMigrationInput,
  "sourceZone"
> & {
  sourceZone: CompleteZoneExport
  normalizedSourceZone: NormalizedCompleteZone
}

export const checkoutMigrationBinding = (
  generationRunId: string | number,
  domain: string,
): string => `checkout:${generationRunId}:${domain.trim().toLowerCase()}`

export function sealCheckoutMigrationInput(
  input: CheckoutMigrationInput,
  env: NodeJS.ProcessEnv = process.env,
): string {
  const sourceZone = normalizeCompleteZone(input.sourceZone)
  if (
    input.schemaVersion !== 1 ||
    input.generationRunId.trim().length === 0 ||
    sourceZone.domain !== input.domain.trim().toLowerCase() ||
    input.sourceZoneHash !== domainMigrationSourceAuthorityHash(sourceZone) ||
    !["automatic", "assisted_standard"].includes(input.classification) ||
    input.sourceMechanism !== "customer_authorized_provider_export_v1" ||
    input.transferAuthorizationAccepted !== true
  ) {
    throw new Error("Checkout migration input is invalid.")
  }
  return sealMigrationSecret(
    JSON.stringify(input),
    checkoutMigrationBinding(input.generationRunId, input.domain),
    env,
  )
}

export function openCheckoutMigrationInput(
  envelope: string,
  generationRunId: string | number,
  domain: string,
  env: NodeJS.ProcessEnv = process.env,
): OpenedCheckoutMigrationInput {
  const plaintext = openMigrationSecret(
    envelope,
    checkoutMigrationBinding(generationRunId, domain),
    env,
  )
  const input = JSON.parse(plaintext) as Partial<CheckoutMigrationInput>
  const sourceZoneInput = completeZoneExportSchema.parse(input.sourceZone)
  const sourceZone = normalizeCompleteZone(sourceZoneInput)
  const normalizedDomain = domain.trim().toLowerCase()
  if (
    input.schemaVersion !== 1 ||
    input.generationRunId !== String(generationRunId) ||
    input.domain !== normalizedDomain ||
    sourceZone.domain !== normalizedDomain ||
    input.sourceZoneHash !== domainMigrationSourceAuthorityHash(sourceZone) ||
    !["automatic", "assisted_standard"].includes(input.classification ?? "") ||
    input.sourceMechanism !== "customer_authorized_provider_export_v1" ||
    input.transferAuthorizationAccepted !== true ||
    typeof input.transferCode !== "string" ||
    !input.transferCode.trim()
  ) {
    throw new Error("Checkout migration input envelope does not match its authority.")
  }
  return {
    ...input,
    schemaVersion: 1,
    generationRunId: String(generationRunId),
    domain: normalizedDomain,
    classification: input.classification as "automatic" | "assisted_standard",
    sourceMechanism: "customer_authorized_provider_export_v1",
    sourceZoneHash: input.sourceZoneHash,
    sourceZone: sourceZoneInput,
    normalizedSourceZone: sourceZone,
    transferCode: input.transferCode,
    transferAuthorizationAccepted: true,
  }
}
