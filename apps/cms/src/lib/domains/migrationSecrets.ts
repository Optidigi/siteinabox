import "server-only"

import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
} from "node:crypto"
import {
  completeZoneExportSchema,
  migrationSourceMechanismSchema,
  normalizeCompleteZone,
  type CompleteZoneExport,
  type MigrationSourceMechanism,
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

type LegacyCheckoutMigrationInput = {
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

export type AutomaticSourceRefreshCredential =
  | {
      kind: "cloudflare_api_token"
      token: string
      zoneId: string
    }
  | {
      kind: "authorized_axfr"
      nameserver: string
      tsigName: string | null
      tsigSecret: string | null
    }
  | {
      kind: "provider_export"
      sourceSoaSerial: number
    }

export type AutomaticCheckoutMigrationInput = {
  schemaVersion: 2
  generationRunId: string
  domain: string
  classification: "automatic"
  sourceMechanism: Exclude<
    MigrationSourceMechanism,
    "customer_authorized_provider_export_v1"
  >
  sourceZoneHash: string
  sourceZone: CompleteZoneExport
  sourceRefreshCredential: AutomaticSourceRefreshCredential
  transferCode: string
  transferAuthorizationAccepted: true
}

export type CheckoutMigrationInput =
  | LegacyCheckoutMigrationInput
  | AutomaticCheckoutMigrationInput

const automaticRefreshCredentialValid = (
  sourceMechanism: AutomaticCheckoutMigrationInput["sourceMechanism"],
  value: unknown,
): value is AutomaticSourceRefreshCredential => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false
  const credential = value as Record<string, unknown>
  if (sourceMechanism === "cloudflare_api_v1") {
    return credential.kind === "cloudflare_api_token" &&
      typeof credential.token === "string" &&
      credential.token.trim().length >= 20 &&
      credential.token.length <= 512 &&
      typeof credential.zoneId === "string" &&
      /^[a-f0-9]{32}$/i.test(credential.zoneId)
  }
  if (sourceMechanism === "authorized_axfr_v1") {
    const tsigName = credential.tsigName
    const tsigSecret = credential.tsigSecret
    const tsigAbsent = tsigName === null && tsigSecret === null
    const tsigPresent =
      typeof tsigName === "string" &&
      /^[A-Za-z0-9._-]{1,255}$/.test(tsigName) &&
      typeof tsigSecret === "string" &&
      /^[A-Za-z0-9+/=_-]{16,512}$/.test(tsigSecret)
    return credential.kind === "authorized_axfr" &&
      typeof credential.nameserver === "string" &&
      credential.nameserver.trim().length > 0 &&
      credential.nameserver.length <= 255 &&
      (tsigAbsent || tsigPresent)
  }
  return credential.kind === "provider_export" &&
    Number.isSafeInteger(credential.sourceSoaSerial) &&
    Number(credential.sourceSoaSerial) >= 0 &&
    Number(credential.sourceSoaSerial) <= 4_294_967_295
}

const automaticSourceAuthorityMatches = (
  sourceMechanism: AutomaticCheckoutMigrationInput["sourceMechanism"],
  sourceZone: NormalizedCompleteZone,
): boolean => ({
  cloudflare_api_v1: "cloudflare_api",
  authorized_axfr_v1: "authorized_axfr",
  validated_provider_export_v1: "validated_provider_export",
})[sourceMechanism] === sourceZone.authority.mechanism

type SerializedCheckoutMigrationInput = {
  schemaVersion?: 1 | 2
  generationRunId?: string
  domain?: string
  classification?: "automatic" | "assisted_standard"
  sourceMechanism?: MigrationSourceMechanism
  sourceZoneHash?: string
  sourceZone?: unknown
  sourceRefreshCredential?: AutomaticSourceRefreshCredential
  transferCode?: string
  transferAuthorizationAccepted?: true
}

export type OpenedCheckoutMigrationInput =
  CheckoutMigrationInput extends infer Input
    ? Input extends CheckoutMigrationInput
      ? Omit<Input, "sourceZone"> & {
          sourceZone: CompleteZoneExport
          normalizedSourceZone: NormalizedCompleteZone
        }
      : never
    : never

export const checkoutMigrationBinding = (
  generationRunId: string | number,
  domain: string,
): string => `checkout:${generationRunId}:${domain.trim().toLowerCase()}`

export function sealCheckoutMigrationInput(
  input: CheckoutMigrationInput,
  env: NodeJS.ProcessEnv = process.env,
): string {
  const sourceZone = normalizeCompleteZone(input.sourceZone)
  const automaticInputValid =
    input.schemaVersion === 2 &&
    input.classification === "automatic" &&
    migrationSourceMechanismSchema.safeParse(input.sourceMechanism).success &&
    automaticRefreshCredentialValid(
      input.sourceMechanism,
      input.sourceRefreshCredential,
    ) &&
    automaticSourceAuthorityMatches(input.sourceMechanism, sourceZone)
  const legacyInputValid =
    input.schemaVersion === 1 &&
    ["automatic", "assisted_standard"].includes(input.classification) &&
    input.sourceMechanism === "customer_authorized_provider_export_v1"
  if (
    (!legacyInputValid && !automaticInputValid) ||
    input.generationRunId.trim().length === 0 ||
    sourceZone.domain !== input.domain.trim().toLowerCase() ||
    input.sourceZoneHash !== domainMigrationSourceAuthorityHash(sourceZone) ||
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
  const input = JSON.parse(plaintext) as SerializedCheckoutMigrationInput
  const sourceZoneInput = completeZoneExportSchema.parse(input.sourceZone)
  const sourceZone = normalizeCompleteZone(sourceZoneInput)
  const normalizedDomain = domain.trim().toLowerCase()
  const sourceMechanism = migrationSourceMechanismSchema.safeParse(
    input.sourceMechanism,
  )
  const legacyInputValid =
    input.schemaVersion === 1 &&
    input.sourceMechanism === "customer_authorized_provider_export_v1" &&
    ["automatic", "assisted_standard"].includes(input.classification ?? "")
  const automaticInputValid =
    input.schemaVersion === 2 &&
    input.classification === "automatic" &&
    sourceMechanism.success &&
    sourceMechanism.data !== "customer_authorized_provider_export_v1" &&
    automaticRefreshCredentialValid(
      sourceMechanism.data,
      input.sourceRefreshCredential,
    ) &&
    automaticSourceAuthorityMatches(sourceMechanism.data, sourceZone)
  if (
    (!legacyInputValid && !automaticInputValid) ||
    input.generationRunId !== String(generationRunId) ||
    input.domain !== normalizedDomain ||
    sourceZone.domain !== normalizedDomain ||
    input.sourceZoneHash !== domainMigrationSourceAuthorityHash(sourceZone) ||
    input.transferAuthorizationAccepted !== true ||
    typeof input.transferCode !== "string" ||
    !input.transferCode.trim()
  ) {
    throw new Error("Checkout migration input envelope does not match its authority.")
  }
  return {
    ...input,
    schemaVersion: input.schemaVersion,
    generationRunId: String(generationRunId),
    domain: normalizedDomain,
    classification: input.classification as "automatic" | "assisted_standard",
    sourceMechanism: sourceMechanism.success
      ? sourceMechanism.data
      : "customer_authorized_provider_export_v1",
    sourceZoneHash: input.sourceZoneHash,
    sourceZone: sourceZoneInput,
    normalizedSourceZone: sourceZone,
    transferCode: input.transferCode,
    transferAuthorizationAccepted: true,
  } as OpenedCheckoutMigrationInput
}
