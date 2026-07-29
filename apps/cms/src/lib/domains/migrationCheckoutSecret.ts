import "server-only"

import { createHash } from "node:crypto"
import type { Payload } from "payload"
import {
  openCheckoutMigrationInput,
  type OpenedCheckoutMigrationInput,
} from "@/lib/domains/migrationSecrets"
import type { MigrationCheckoutSecret } from "@/payload-types"
import { relationshipId } from "@/lib/relationshipId"

type SecretRecord = MigrationCheckoutSecret

const activeLifetimeMs = (
  input: Pick<OpenedCheckoutMigrationInput, "schemaVersion">,
): number => input.schemaVersion === 2
  ? 24 * 60 * 60_000
  : 30 * 24 * 60 * 60_000

const numericId = (value: string | number, label: string): number => {
  const numeric = Number(value)
  if (!Number.isSafeInteger(numeric) || numeric <= 0) {
    throw new Error(`${label} requires a numeric relationship id.`)
  }
  return numeric
}

export const migrationCheckoutSecretKey = (
  generationRunId: string | number,
  domain: string,
  sourceZoneHash: string,
): string => {
  const authority = [
    "migration-checkout-secret-v1",
    String(generationRunId),
    domain.trim().toLowerCase(),
    sourceZoneHash,
  ].join(":")
  return `migration-secret:${createHash("sha256").update(authority).digest("hex")}`
}

const findSecret = async (
  payload: Payload,
  secretKey: string,
): Promise<SecretRecord | null> => {
  const result = await payload.find({
    collection: "migration-checkout-secrets",
    where: { secretKey: { equals: secretKey } },
    limit: 2,
    depth: 0,
    overrideAccess: true,
  })
  if (result.docs.length > 1) {
    throw new Error("Duplicate migration checkout secret authority.")
  }
  return (result.docs[0] as SecretRecord | undefined) ?? null
}

const updateSecretClaim = async (
  payload: Payload,
  secret: SecretRecord,
  data: Partial<SecretRecord>,
): Promise<SecretRecord | null> => {
  if (!secret.updatedAt) {
    throw new Error("Migration checkout secret is missing its concurrency version.")
  }
  const result = await payload.update({
    collection: "migration-checkout-secrets",
    where: {
      and: [
        { id: { equals: secret.id } },
        { state: { equals: secret.state } },
        { updatedAt: { equals: secret.updatedAt } },
      ],
    },
    data,
    depth: 0,
    overrideAccess: true,
    context: { migrationCheckoutSecretLifecycle: true },
  })
  return Array.isArray(result.docs)
    ? (result.docs[0] as SecretRecord | undefined) ?? null
    : null
}

const validateAuthority = (
  secret: SecretRecord,
  input: {
    generationRunId: string | number
    domain: string
    sourceZoneHash: string
  },
) => {
  if (
    secret.secretKey !== migrationCheckoutSecretKey(
      input.generationRunId,
      input.domain,
      input.sourceZoneHash,
    ) ||
    relationshipId(secret.generationRun) !== String(input.generationRunId) ||
    secret.domainNameAscii !== input.domain.trim().toLowerCase() ||
    secret.sourceZoneHash !== input.sourceZoneHash
  ) {
    throw new Error("Migration checkout secret belongs to another authority.")
  }
}

const sameOpenedInput = (
  left: OpenedCheckoutMigrationInput,
  right: OpenedCheckoutMigrationInput,
): boolean =>
  left.schemaVersion === right.schemaVersion &&
  left.generationRunId === right.generationRunId &&
  left.domain === right.domain &&
  left.classification === right.classification &&
  left.sourceMechanism === right.sourceMechanism &&
  left.sourceZoneHash === right.sourceZoneHash &&
  JSON.stringify(
    "sourceRefreshCredential" in left
      ? left.sourceRefreshCredential
      : null,
  ) === JSON.stringify(
    "sourceRefreshCredential" in right
      ? right.sourceRefreshCredential
      : null,
  ) &&
  left.transferCode === right.transferCode &&
  left.transferAuthorizationAccepted === right.transferAuthorizationAccepted &&
  JSON.stringify(left.normalizedSourceZone) ===
    JSON.stringify(right.normalizedSourceZone)

const winnerMatchesInput = (
  winner: SecretRecord,
  input: {
    generationRunId: string | number
    domain: string
    sourceZoneHash: string
  },
  opened: OpenedCheckoutMigrationInput,
): boolean => {
  validateAuthority(winner, input)
  if (!winner.encryptedInput) return false
  const winnerInput = openCheckoutMigrationInput(
    winner.encryptedInput,
    input.generationRunId,
    input.domain,
  )
  return sameOpenedInput(winnerInput, opened)
}

export async function persistMigrationCheckoutSecret(
  payload: Payload,
  input: {
    generationRunId: string | number
    domain: string
    sourceZoneHash: string
    encryptedInput: string
    now?: Date
  },
): Promise<SecretRecord> {
  const now = input.now ?? new Date()
  const opened = openCheckoutMigrationInput(
    input.encryptedInput,
    input.generationRunId,
    input.domain,
  )
  if (opened.sourceZoneHash !== input.sourceZoneHash) {
    throw new Error("Migration checkout secret differs from the accepted source hash.")
  }
  const secretKey = migrationCheckoutSecretKey(
    input.generationRunId,
    input.domain,
    input.sourceZoneHash,
  )
  const existing = await findSecret(payload, secretKey)
  const expiresAt = new Date(
    now.getTime() + activeLifetimeMs(opened),
  ).toISOString()
  if (existing) {
    validateAuthority(existing, input)
    if (existing.state !== "pending_order") {
      if (existing.encryptedInput === input.encryptedInput) return existing
      throw new Error("Attached migration checkout secret cannot be replaced.")
    }
    const updated = await updateSecretClaim(payload, existing, {
        encryptedInput: input.encryptedInput,
        expiresAt,
        updatedAt: now.toISOString(),
    })
    if (updated) return updated
    const winner = await findSecret(payload, secretKey)
    if (
      winner &&
      winner.state === "pending_order" &&
      winnerMatchesInput(winner, input, opened)
    ) {
      return winner
    }
    throw new Error("Migration checkout secret changed concurrently.")
  }
  try {
    return await payload.create({
      collection: "migration-checkout-secrets",
      data: {
        secretKey,
        generationRun: numericId(input.generationRunId, "Migration checkout secret"),
        domainNameAscii: input.domain.trim().toLowerCase(),
        sourceZoneHash: input.sourceZoneHash,
        encryptedInput: input.encryptedInput,
        state: "pending_order",
        expiresAt,
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
      },
      depth: 0,
      overrideAccess: true,
    }) as SecretRecord
  } catch (error) {
    const winner = await findSecret(payload, secretKey)
    if (
      winner &&
      winner.state === "pending_order" &&
      winnerMatchesInput(winner, input, opened)
    ) {
      return winner
    }
    throw error
  }
}

export async function attachMigrationCheckoutSecret(
  payload: Payload,
  input: {
    secretKey: string
    orderId: string | number
    generationRunId: string | number
    domain: string
    sourceZoneHash: string
    now?: Date
  },
): Promise<SecretRecord> {
  const secret = await findSecret(payload, input.secretKey)
  if (!secret) throw new Error("Migration checkout secret is unavailable.")
  validateAuthority(secret, input)
  if (
    secret.state === "attached" &&
    relationshipId(secret.order) === String(input.orderId)
  ) {
    return secret
  }
  if (secret.state !== "pending_order") {
    throw new Error("Migration checkout secret cannot be attached in its current state.")
  }
  const updated = await updateSecretClaim(payload, secret, {
      order: numericId(input.orderId, "Migration checkout secret attachment"),
      state: "attached",
      updatedAt: (input.now ?? new Date()).toISOString(),
  })
  if (updated) return updated
  const winner = await findSecret(payload, input.secretKey)
  if (
    winner?.state === "attached" &&
    relationshipId(winner.order) === String(input.orderId)
  ) {
    validateAuthority(winner, input)
    return winner
  }
  throw new Error("Migration checkout secret attachment changed concurrently.")
}

export async function openAttachedMigrationCheckoutSecret(
  payload: Payload,
  input: {
    secretKey: string
    orderId: string | number
    generationRunId: string | number
    domain: string
    sourceZoneHash: string
    now?: Date
  },
): Promise<OpenedCheckoutMigrationInput> {
  const secret = await findSecret(payload, input.secretKey)
  if (!secret) throw new Error("Migration checkout secret is unavailable.")
  validateAuthority(secret, input)
  const now = input.now ?? new Date()
  if (
    secret.state !== "attached" ||
    relationshipId(secret.order) !== String(input.orderId) ||
    !secret.encryptedInput ||
    Date.parse(secret.expiresAt) <= now.getTime()
  ) {
    throw new Error("Migration checkout secret is not active for this order.")
  }
  return openCheckoutMigrationInput(
    secret.encryptedInput,
    input.generationRunId,
    input.domain,
  )
}

export async function consumeMigrationCheckoutSecret(
  payload: Payload,
  input: {
    secretKey: string
    orderId: string | number
    now?: Date
  },
): Promise<void> {
  const secret = await findSecret(payload, input.secretKey)
  if (!secret) return
  if (
    secret.state === "consumed" &&
    !secret.encryptedInput
  ) {
    return
  }
  if (
    secret.state !== "attached" ||
    relationshipId(secret.order) !== String(input.orderId)
  ) {
    throw new Error("Migration checkout secret cannot be consumed by this order.")
  }
  const now = input.now ?? new Date()
  const updated = await updateSecretClaim(payload, secret, {
      encryptedInput: null,
      state: "consumed",
      consumedAt: now.toISOString(),
      updatedAt: now.toISOString(),
  })
  if (updated) return
  const winner = await findSecret(payload, input.secretKey)
  if (winner?.state === "consumed" && !winner.encryptedInput) return
  throw new Error("Migration checkout secret consumption changed concurrently.")
}

export async function invalidateAttachedMigrationCheckoutSecret(
  payload: Payload,
  input: {
    secretKey: string
    orderId: string | number
    now?: Date
  },
): Promise<void> {
  const secret = await findSecret(payload, input.secretKey)
  if (!secret) throw new Error("Migration checkout secret is unavailable.")
  if (
    secret.state === "expired" &&
    relationshipId(secret.order) === String(input.orderId) &&
    !secret.encryptedInput
  ) {
    return
  }
  if (
    secret.state !== "attached" ||
    relationshipId(secret.order) !== String(input.orderId)
  ) {
    throw new Error("Migration checkout secret is not active for this order.")
  }
  const now = input.now ?? new Date()
  const updated = await updateSecretClaim(payload, secret, {
    encryptedInput: null,
    state: "expired",
    updatedAt: now.toISOString(),
  })
  if (updated) return
  const winner = await findSecret(payload, input.secretKey)
  if (
    winner?.state === "expired" &&
    relationshipId(winner.order) === String(input.orderId) &&
    !winner.encryptedInput
  ) {
    return
  }
  throw new Error("Migration checkout secret invalidation changed concurrently.")
}

export async function replaceExpiredAttachedMigrationCheckoutSecret(
  payload: Payload,
  input: {
    secretKey: string
    orderId: string | number
    generationRunId: string | number
    domain: string
    sourceZoneHash: string
    encryptedInput: string
    now?: Date
  },
): Promise<SecretRecord> {
  const secret = await findSecret(payload, input.secretKey)
  if (!secret) throw new Error("Expired migration checkout secret is unavailable.")
  validateAuthority(secret, input)
  if (
    secret.state !== "expired" ||
    relationshipId(secret.order) !== String(input.orderId)
  ) {
    throw new Error("Only the expired secret for this accepted order can be recollected.")
  }
  const opened = openCheckoutMigrationInput(
    input.encryptedInput,
    input.generationRunId,
    input.domain,
  )
  if (opened.sourceZoneHash !== input.sourceZoneHash) {
    throw new Error("Recollected migration evidence differs from the accepted source hash.")
  }
  const now = input.now ?? new Date()
  const updated = await updateSecretClaim(payload, secret, {
      encryptedInput: input.encryptedInput,
      state: "attached",
      expiresAt: new Date(
        now.getTime() + activeLifetimeMs(opened),
      ).toISOString(),
      updatedAt: now.toISOString(),
  })
  if (updated) return updated
  const winner = await findSecret(payload, input.secretKey)
  if (
    winner?.state === "attached" &&
    relationshipId(winner.order) === String(input.orderId) &&
    winner.encryptedInput === input.encryptedInput
  ) {
    validateAuthority(winner, input)
    return winner
  }
  throw new Error("Migration checkout secret recollection changed concurrently.")
}
