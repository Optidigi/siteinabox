import "server-only"

import {
  createHash,
  randomBytes,
} from "node:crypto"
import type { Payload } from "payload"
import type {
  AutomaticSourceRefreshCredential,
} from "@/lib/domains/migrationSecrets"
import {
  openMigrationSecret,
  sealMigrationSecret,
} from "@/lib/domains/migrationSecrets"
import {
  inspectExistingDomainPublicEvidence,
} from "@/lib/domains/migrationCheckout"
import { acquireCloudflareSource } from "@/lib/domains/migrationSources/cloudflare"
import {
  MigrationSourceAuthorizationError,
  MigrationSourceRefreshRetryableError,
  type AcquiredMigrationSource,
} from "@/lib/domains/migrationSources/types"
import {
  relationshipId,
  sameRelationshipId,
  type RelationshipIdRef,
} from "@/lib/relationshipId"

const AUTHORIZATION_ENDPOINT = "https://dash.cloudflare.com/oauth2/auth"
const TOKEN_ENDPOINT = "https://dash.cloudflare.com/oauth2/token"
const REVOCATION_ENDPOINT = "https://dash.cloudflare.com/oauth2/revoke"
const REQUIRED_SCOPES = Object.freeze([
  "zone.read",
  "dns.read",
  "offline_access",
] as const)
const AUTHORIZATION_LIFETIME_MS = 10 * 60_000
const AUTHORIZED_SOURCE_LIFETIME_MS = 24 * 60 * 60_000
const ATTACHED_SOURCE_LIFETIME_MS = 35 * 24 * 60 * 60_000
const TERMINAL_RETENTION_MS = 7 * 24 * 60 * 60_000
const TOKEN_REFRESH_SKEW_MS = 5 * 60_000
const TOKEN_REFRESH_CLAIM_LEASE_MS = 60_000

type OAuthConfig = {
  clientId: string
  clientSecret: string
  redirectUri: string
}

export type CloudflareSourceAuthorizationRecord = {
  id: string | number
  authorizationKey: string
  stateDigest: string
  browserBindingDigest: string
  generationRun: RelationshipIdRef
  tenant: RelationshipIdRef
  clientSlug: string
  customerEmailDigest: string
  domainNameAscii: string
  encryptedAuthority: string | null
  state:
    | "pending"
    | "authorized"
    | "attached"
    | "refreshing"
    | "revocation_pending"
    | "revoked"
    | "expired"
  expiresAt: string
  updatedAt: string
}

type PendingAuthority = {
  schemaVersion: 1
  kind: "cloudflare_oauth_pending"
  codeVerifier: string
}

type AuthorizedAuthority = {
  schemaVersion: 1
  kind: "cloudflare_oauth_authorized"
  source: AcquiredMigrationSource
  credential: CloudflareOAuthCredentialAuthority
}

type RevocationPendingAuthority = {
  schemaVersion: 1
  kind: "cloudflare_oauth_revocation_pending"
  credential: CloudflareOAuthCredentialAuthority
}

type RefreshingAuthority = {
  schemaVersion: 1
  kind: "cloudflare_oauth_refreshing"
  source: AcquiredMigrationSource
  credential: CloudflareOAuthCredentialAuthority
  resumeState: "authorized" | "attached"
}

export type CloudflareOAuthCredentialAuthority = {
  accessToken: string
  refreshToken: string
  accessTokenExpiresAt: string
  scopes: string[]
  zoneId: string | null
}

type OAuthTokenResponse = {
  accessToken: string
  refreshToken: string
  expiresInSeconds: number
  scopes: string[]
}

class OAuthGrantRejectedError extends Error {
  constructor() {
    super("Cloudflare OAuth grant is no longer usable.")
    this.name = "OAuthGrantRejectedError"
  }
}

const hasRequiredScopes = (scopes: readonly string[]): boolean =>
  REQUIRED_SCOPES.every((scope) => scopes.includes(scope))

const digest = (value: string): string =>
  createHash("sha256").update(value).digest("hex")

const emailDigest = (value: string): string =>
  digest(value.trim().toLowerCase())

const randomOpaque = (bytes = 32): string =>
  randomBytes(bytes).toString("base64url")

const authorizationBinding = (stateDigest: string): string =>
  `cloudflare-source-oauth:${stateDigest}`

const oauthConfig = (
  env: NodeJS.ProcessEnv = process.env,
): OAuthConfig => {
  const clientId = env.CLOUDFLARE_SOURCE_OAUTH_CLIENT_ID?.trim()
  const clientSecret = env.CLOUDFLARE_SOURCE_OAUTH_CLIENT_SECRET?.trim()
  const redirectUri = env.CLOUDFLARE_SOURCE_OAUTH_REDIRECT_URI?.trim()
  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error("Cloudflare source OAuth configuration is incomplete.")
  }
  const parsed = new URL(redirectUri)
  if (
    parsed.protocol !== "https:" ||
    parsed.hostname !== "preview.siteinabox.nl" ||
    parsed.port ||
    parsed.username ||
    parsed.password ||
    parsed.pathname !== "/api/domain-migration-source/cloudflare/callback" ||
    parsed.search ||
    parsed.hash
  ) {
    throw new Error("Cloudflare source OAuth redirect URI is invalid.")
  }
  return { clientId, clientSecret, redirectUri: parsed.toString() }
}

export const cloudflareSourceOAuthEnabled = (
  env: NodeJS.ProcessEnv = process.env,
): boolean => {
  if (
    env.COMMERCE_MIGRATION_SOURCE_CLOUDFLARE_OAUTH_ENABLED?.trim() !== "1"
  ) {
    return false
  }
  try {
    oauthConfig(env)
    return true
  } catch {
    return false
  }
}

const tokenResponse = async (
  form: URLSearchParams,
  input: {
    config: OAuthConfig
    fetchImpl?: typeof fetch
  },
): Promise<OAuthTokenResponse> => {
  const response = await (input.fetchImpl ?? globalThis.fetch)(TOKEN_ENDPOINT, {
    method: "POST",
    headers: {
      Accept: "application/json",
      Authorization: `Basic ${Buffer.from(
        `${input.config.clientId}:${input.config.clientSecret}`,
      ).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: form,
    cache: "no-store",
    signal: AbortSignal.timeout(10_000),
  })
  if (!response.ok) {
    if (response.status === 400) {
      try {
        const error: unknown = await response.json()
        if (
          error &&
          typeof error === "object" &&
          !Array.isArray(error) &&
          (error as Record<string, unknown>).error === "invalid_grant"
        ) {
          throw new OAuthGrantRejectedError()
        }
      } catch (error) {
        if (error instanceof OAuthGrantRejectedError) throw error
      }
    }
    throw new Error("Cloudflare OAuth token exchange failed.")
  }
  const raw: unknown = await response.json()
  const value = raw && typeof raw === "object" && !Array.isArray(raw)
    ? raw as Record<string, unknown>
    : {}
  const accessToken = typeof value.access_token === "string"
    ? value.access_token.trim()
    : ""
  const refreshToken = typeof value.refresh_token === "string"
    ? value.refresh_token.trim()
    : ""
  const expiresInSeconds = Number(value.expires_in)
  const scopes = typeof value.scope === "string"
    ? value.scope.split(/\s+/).map((scope) => scope.trim()).filter(Boolean)
    : []
  if (
    accessToken.length < 20 ||
    refreshToken.length < 20 ||
    !Number.isSafeInteger(expiresInSeconds) ||
    expiresInSeconds <= 0 ||
    expiresInSeconds > 31 * 24 * 60 * 60 ||
    (typeof value.token_type === "string" &&
      value.token_type.toLowerCase() !== "bearer")
  ) {
    throw new Error("Cloudflare OAuth returned incomplete authority.")
  }
  return { accessToken, refreshToken, expiresInSeconds, scopes }
}

const findByStateDigest = async (
  payload: Payload,
  stateDigest: string,
): Promise<CloudflareSourceAuthorizationRecord | null> => {
  const result = await payload.find({
    collection: "migration-source-authorizations",
    where: { stateDigest: { equals: stateDigest } },
    limit: 2,
    depth: 0,
    overrideAccess: true,
  })
  if (result.docs.length > 1) {
    throw new Error("Duplicate Cloudflare OAuth state authority.")
  }
  return (result.docs[0] as CloudflareSourceAuthorizationRecord | undefined) ?? null
}

const findByAuthorizationKey = async (
  payload: Payload,
  authorizationKey: string,
): Promise<CloudflareSourceAuthorizationRecord | null> => {
  const result = await payload.find({
    collection: "migration-source-authorizations",
    where: { authorizationKey: { equals: authorizationKey } },
    limit: 2,
    depth: 0,
    overrideAccess: true,
  })
  if (result.docs.length > 1) {
    throw new Error("Duplicate Cloudflare source authorization.")
  }
  return (result.docs[0] as CloudflareSourceAuthorizationRecord | undefined) ?? null
}

const createDetachedRevocationRecord = async (
  payload: Payload,
  owner: CloudflareSourceAuthorizationRecord,
  credential: CloudflareOAuthCredentialAuthority,
  input: {
    env?: NodeJS.ProcessEnv
    now: Date
  },
): Promise<void> => {
  const authorizationKey = randomOpaque()
  const stateDigest = digest(randomOpaque())
  const generationRunId = relationshipId(owner.generationRun)
  const tenantId = relationshipId(owner.tenant)
  if (!generationRunId || !tenantId) {
    throw new Error(
      "Detached Cloudflare OAuth revocation authority has no checkout owner.",
    )
  }
  await payload.create({
    collection: "migration-source-authorizations",
    data: {
      authorizationKey,
      stateDigest,
      browserBindingDigest: digest(randomOpaque()),
      generationRun: Number(generationRunId),
      tenant: Number(tenantId),
      clientSlug: owner.clientSlug,
      customerEmailDigest: owner.customerEmailDigest,
      domainNameAscii: owner.domainNameAscii,
      encryptedAuthority: sealMigrationSecret(
        JSON.stringify({
          schemaVersion: 1,
          kind: "cloudflare_oauth_revocation_pending",
          credential,
        } satisfies RevocationPendingAuthority),
        authorizationBinding(stateDigest),
        input.env,
      ),
      state: "revocation_pending",
      expiresAt: input.now.toISOString(),
      updatedAt: input.now.toISOString(),
    },
    depth: 0,
    overrideAccess: true,
  })
}

const retainOrRevokeDetachedCredential = async (
  payload: Payload,
  owner: CloudflareSourceAuthorizationRecord,
  credential: CloudflareOAuthCredentialAuthority,
  input: {
    env?: NodeJS.ProcessEnv
    now: Date
    fetchImpl?: typeof fetch
  },
): Promise<void> => {
  try {
    await createDetachedRevocationRecord(payload, owner, credential, input)
    return
  } catch (persistenceError) {
    try {
      await revokeCloudflareOAuthCredential(credential, input)
      return
    } catch {
      throw new Error(
        "Cloudflare OAuth authority could not be durably retained or revoked.",
        { cause: persistenceError },
      )
    }
  }
}

const persistIssuedCredentialForRevocation = async (
  payload: Payload,
  initialRecord: CloudflareSourceAuthorizationRecord,
  credential: CloudflareOAuthCredentialAuthority,
  input: {
    env?: NodeJS.ProcessEnv
    now: Date
    fetchImpl?: typeof fetch
  },
): Promise<CloudflareSourceAuthorizationRecord> => {
  const encryptedAuthority = sealMigrationSecret(
    JSON.stringify({
      schemaVersion: 1,
      kind: "cloudflare_oauth_revocation_pending",
      credential,
    } satisfies RevocationPendingAuthority),
    authorizationBinding(initialRecord.stateDigest),
    input.env,
  )
  let candidate = initialRecord
  for (let attempt = 0; attempt < 3; attempt += 1) {
    if (candidate.state === "revocation_pending" && candidate.encryptedAuthority) {
      const retained = JSON.parse(openMigrationSecret(
        candidate.encryptedAuthority,
        authorizationBinding(candidate.stateDigest),
        input.env,
      )) as RevocationPendingAuthority
      if (
        retained.kind === "cloudflare_oauth_revocation_pending" &&
        retained.credential.refreshToken === credential.refreshToken
      ) {
        return candidate
      }
      await createDetachedRevocationRecord(
        payload,
        initialRecord,
        credential,
        input,
      )
      throw new Error("Cloudflare OAuth state was already consumed.")
    }
    if (candidate.state !== "pending") break
    try {
      const claimed = await payload.update({
        collection: "migration-source-authorizations",
        where: {
          and: [
            { id: { equals: candidate.id } },
            { state: { equals: "pending" } },
            { updatedAt: { equals: candidate.updatedAt } },
          ],
        },
        data: {
          encryptedAuthority,
          state: "revocation_pending",
          updatedAt: input.now.toISOString(),
        },
        depth: 0,
        overrideAccess: true,
        context: { migrationSourceAuthorizationLifecycle: true },
      })
      if (Array.isArray(claimed.docs) && claimed.docs.length === 1) {
        return claimed.docs[0] as CloudflareSourceAuthorizationRecord
      }
    } catch {
      // Resolve an unknown database outcome before deciding whether the grant
      // still needs a durable owner.
    }
    const current = await findByAuthorizationKey(
      payload,
      initialRecord.authorizationKey,
    )
    if (!current) break
    candidate = current
  }
  try {
    await revokeCloudflareOAuthCredential(credential, input)
  } catch {
    if (candidate.state === "pending") {
      const retained = await payload.update({
        collection: "migration-source-authorizations",
        where: {
          and: [
            { id: { equals: candidate.id } },
            { state: { equals: "pending" } },
            { updatedAt: { equals: candidate.updatedAt } },
          ],
        },
        data: {
          encryptedAuthority,
          state: "revocation_pending",
          updatedAt: input.now.toISOString(),
        },
        depth: 0,
        overrideAccess: true,
        context: { migrationSourceAuthorizationLifecycle: true },
      })
      if (Array.isArray(retained.docs) && retained.docs.length === 1) {
        return retained.docs[0] as CloudflareSourceAuthorizationRecord
      }
    }
    await createDetachedRevocationRecord(
      payload,
      initialRecord,
      credential,
      input,
    )
    throw new Error("Cloudflare OAuth state was already consumed.")
  }
  throw new Error("Cloudflare OAuth state was already consumed.")
}

export async function createCloudflareSourceAuthorization(
  payload: Payload,
  input: {
    generationRunId: string | number
    tenantId: string | number
    clientSlug: string
    customerEmail: string
    domain: string
    env?: NodeJS.ProcessEnv
    now?: Date
  },
): Promise<{
  authorizationUrl: string
  browserBinding: string
  cookieName: string
}> {
  const config = oauthConfig(input.env)
  const now = input.now ?? new Date()
  const state = randomOpaque()
  const stateDigest = digest(state)
  const browserBinding = randomOpaque()
  const codeVerifier = randomOpaque(48)
  const codeChallenge = createHash("sha256")
    .update(codeVerifier)
    .digest("base64url")
  const authorizationKey = randomOpaque()
  const pending: PendingAuthority = {
    schemaVersion: 1,
    kind: "cloudflare_oauth_pending",
    codeVerifier,
  }
  await payload.create({
    collection: "migration-source-authorizations",
    data: {
      authorizationKey,
      stateDigest,
      browserBindingDigest: digest(browserBinding),
      generationRun: Number(input.generationRunId),
      tenant: Number(input.tenantId),
      clientSlug: input.clientSlug,
      customerEmailDigest: emailDigest(input.customerEmail),
      domainNameAscii: input.domain.trim().toLowerCase(),
      encryptedAuthority: sealMigrationSecret(
        JSON.stringify(pending),
        authorizationBinding(stateDigest),
        input.env,
      ),
      state: "pending",
      expiresAt: new Date(
        now.getTime() + AUTHORIZATION_LIFETIME_MS,
      ).toISOString(),
      updatedAt: now.toISOString(),
    },
    depth: 0,
    overrideAccess: true,
  })
  const authorizationUrl = new URL(AUTHORIZATION_ENDPOINT)
  authorizationUrl.searchParams.set("response_type", "code")
  authorizationUrl.searchParams.set("client_id", config.clientId)
  authorizationUrl.searchParams.set("redirect_uri", config.redirectUri)
  authorizationUrl.searchParams.set("scope", REQUIRED_SCOPES.join(" "))
  authorizationUrl.searchParams.set("state", state)
  authorizationUrl.searchParams.set("code_challenge", codeChallenge)
  authorizationUrl.searchParams.set("code_challenge_method", "S256")
  return {
    authorizationUrl: authorizationUrl.toString(),
    browserBinding,
    cookieName: `siab_cf_source_${state.slice(0, 12)}`,
  }
}

export async function completeCloudflareSourceAuthorization(
  payload: Payload,
  input: {
    state: string
    code: string
    browserBinding: string
    context: {
      generationRunId: string | number
      tenantId: string | number
      clientSlug: string
      customerEmail: string
    }
    env?: NodeJS.ProcessEnv
    now?: Date
  },
  dependencies: {
    fetchImpl?: typeof fetch
    inspectPublicEvidence?: typeof inspectExistingDomainPublicEvidence
    acquireSource?: typeof acquireCloudflareSource
  } = {},
): Promise<{
  authorizationKey: string
  clientSlug: string
  domain: string
}> {
  const now = input.now ?? new Date()
  const stateDigest = digest(input.state)
  const record = await findByStateDigest(payload, stateDigest)
  if (
    !record ||
    record.state !== "pending" ||
    record.browserBindingDigest !== digest(input.browserBinding) ||
    Date.parse(record.expiresAt) <= now.getTime() ||
    !sameRelationshipId(record.generationRun, input.context.generationRunId) ||
    !sameRelationshipId(record.tenant, input.context.tenantId) ||
    record.clientSlug !== input.context.clientSlug ||
    record.customerEmailDigest !== emailDigest(input.context.customerEmail) ||
    !record.encryptedAuthority
  ) {
    throw new Error("Cloudflare OAuth state is invalid or expired.")
  }
  const pending = JSON.parse(openMigrationSecret(
    record.encryptedAuthority,
    authorizationBinding(stateDigest),
    input.env,
  )) as PendingAuthority
  if (
    pending.schemaVersion !== 1 ||
    pending.kind !== "cloudflare_oauth_pending" ||
    !/^[A-Za-z0-9_-]{43,128}$/.test(pending.codeVerifier)
  ) {
    throw new Error("Cloudflare OAuth PKCE authority is invalid.")
  }
  const config = oauthConfig(input.env)
  const tokens = await tokenResponse(new URLSearchParams({
    grant_type: "authorization_code",
    code: input.code,
    redirect_uri: config.redirectUri,
    code_verifier: pending.codeVerifier,
  }), {
    config,
    fetchImpl: dependencies.fetchImpl,
  })
  const credential: CloudflareOAuthCredentialAuthority = {
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
    accessTokenExpiresAt: new Date(
      now.getTime() + tokens.expiresInSeconds * 1_000,
    ).toISOString(),
    scopes: tokens.scopes.length > 0
      ? tokens.scopes
      : [...REQUIRED_SCOPES],
    zoneId: null,
  }
  const claimedRecord = await persistIssuedCredentialForRevocation(
    payload,
    record,
    credential,
    {
      env: input.env,
      now,
      fetchImpl: dependencies.fetchImpl,
    },
  )
  if (tokens.scopes.length > 0 && !hasRequiredScopes(tokens.scopes)) {
    throw new Error("Cloudflare OAuth returned incomplete authority.")
  }
  const publicEvidence = await (
    dependencies.inspectPublicEvidence ?? inspectExistingDomainPublicEvidence
  )(record.domainNameAscii)
  const acquired = await (
    dependencies.acquireSource ?? acquireCloudflareSource
  )({
    domain: record.domainNameAscii,
    token: tokens.accessToken,
    publicEvidence,
  })
  if (acquired.refreshCredential.kind !== "cloudflare_api_token") {
    throw new Error("Cloudflare OAuth source returned invalid zone authority.")
  }
  const sourceCredential: AutomaticSourceRefreshCredential = {
    kind: "cloudflare_oauth",
    authorizationKey: record.authorizationKey,
    zoneId: acquired.refreshCredential.zoneId,
  }
  const authorized: AuthorizedAuthority = {
    schemaVersion: 1,
    kind: "cloudflare_oauth_authorized",
    source: {
      ...acquired,
      refreshCredential: sourceCredential,
    },
    credential: {
      ...credential,
      zoneId: acquired.refreshCredential.zoneId,
    },
  }
  const result = await payload.update({
    collection: "migration-source-authorizations",
    where: {
      and: [
        { id: { equals: record.id } },
        { state: { equals: "revocation_pending" } },
        { updatedAt: { equals: claimedRecord.updatedAt } },
      ],
    },
    data: {
      encryptedAuthority: sealMigrationSecret(
        JSON.stringify(authorized),
        authorizationBinding(stateDigest),
        input.env,
      ),
      state: "authorized",
      authorizedAt: now.toISOString(),
      expiresAt: new Date(
        now.getTime() + AUTHORIZED_SOURCE_LIFETIME_MS,
      ).toISOString(),
      updatedAt: now.toISOString(),
    },
    depth: 0,
    overrideAccess: true,
    context: { migrationSourceAuthorizationLifecycle: true },
  })
  if (!Array.isArray(result.docs) || result.docs.length !== 1) {
    throw new Error("Cloudflare OAuth source authority changed concurrently.")
  }
  return {
    authorizationKey: record.authorizationKey,
    clientSlug: record.clientSlug,
    domain: record.domainNameAscii,
  }
}

export async function loadCloudflareSourceAuthorization(
  payload: Payload,
  input: {
    authorizationKey: string
    generationRunId: string | number
    tenantId: string | number
    clientSlug: string
    customerEmail: string
    domain: string
    env?: NodeJS.ProcessEnv
    now?: Date
  },
): Promise<{
  record: CloudflareSourceAuthorizationRecord
  source: AcquiredMigrationSource
}> {
  const now = input.now ?? new Date()
  const record = await findByAuthorizationKey(
    payload,
    input.authorizationKey.trim(),
  )
  if (
    !record ||
    !["authorized", "attached"].includes(record.state) ||
    !record.encryptedAuthority ||
    Date.parse(record.expiresAt) <= now.getTime() ||
    !sameRelationshipId(record.generationRun, input.generationRunId) ||
    !sameRelationshipId(record.tenant, input.tenantId) ||
    record.clientSlug !== input.clientSlug ||
    record.customerEmailDigest !== emailDigest(input.customerEmail) ||
    record.domainNameAscii !== input.domain.trim().toLowerCase()
  ) {
    throw new Error("Cloudflare source authorization is unavailable.")
  }
  const authorized = JSON.parse(openMigrationSecret(
    record.encryptedAuthority,
    authorizationBinding(record.stateDigest),
    input.env,
  )) as AuthorizedAuthority
  if (
    authorized.schemaVersion !== 1 ||
    authorized.kind !== "cloudflare_oauth_authorized" ||
    authorized.source.mechanism !== "cloudflare_api_v1" ||
    authorized.source.refreshCredential.kind !== "cloudflare_oauth" ||
    authorized.source.refreshCredential.authorizationKey !==
      record.authorizationKey ||
    authorized.credential.zoneId !==
      authorized.source.refreshCredential.zoneId
  ) {
    throw new Error("Cloudflare source authorization is invalid.")
  }
  return { record, source: authorized.source }
}

export async function loadCloudflareSourceAuthorizationMetadata(
  payload: Payload,
  input: {
    authorizationKey: string
    generationRunId: string | number
    tenantId: string | number
    clientSlug: string
    customerEmail: string
    env?: NodeJS.ProcessEnv
    now?: Date
  },
): Promise<{ authorizationKey: string; domain: string } | null> {
  const record = await findByAuthorizationKey(
    payload,
    input.authorizationKey.trim(),
  )
  if (
    !record ||
    !["authorized", "attached"].includes(record.state) ||
    !record.encryptedAuthority ||
    Date.parse(record.expiresAt) <= (input.now ?? new Date()).getTime() ||
    !sameRelationshipId(record.generationRun, input.generationRunId) ||
    !sameRelationshipId(record.tenant, input.tenantId) ||
    record.clientSlug !== input.clientSlug ||
    record.customerEmailDigest !== emailDigest(input.customerEmail)
  ) {
    return null
  }
  return {
    authorizationKey: record.authorizationKey,
    domain: record.domainNameAscii,
  }
}

export async function attachCloudflareSourceAuthorization(
  payload: Payload,
  record: CloudflareSourceAuthorizationRecord,
  now = new Date(),
): Promise<void> {
  if (record.state === "attached") {
    const current = await findByAuthorizationKey(
      payload,
      record.authorizationKey,
    )
    if (
      current?.state === "attached" &&
      current.encryptedAuthority &&
      Date.parse(current.expiresAt) > now.getTime()
    ) {
      return
    }
    throw new Error("Cloudflare source authorization changed concurrently.")
  }
  const result = await payload.update({
    collection: "migration-source-authorizations",
    where: {
      and: [
        { id: { equals: record.id } },
        { state: { equals: "authorized" } },
        { updatedAt: { equals: record.updatedAt } },
      ],
    },
    data: {
      state: "attached",
      expiresAt: new Date(
        now.getTime() + ATTACHED_SOURCE_LIFETIME_MS,
      ).toISOString(),
      updatedAt: now.toISOString(),
    },
    depth: 0,
    overrideAccess: true,
    context: { migrationSourceAuthorizationLifecycle: true },
  })
  if (!Array.isArray(result.docs) || result.docs.length !== 1) {
    throw new Error("Cloudflare source authorization changed concurrently.")
  }
}

export async function resolveCloudflareOAuthCredential(
  payload: Payload,
  reference: Extract<
    AutomaticSourceRefreshCredential,
    { kind: "cloudflare_oauth" }
  >,
  input: {
    env?: NodeJS.ProcessEnv
    now?: Date
    fetchImpl?: typeof fetch
  } = {},
): Promise<CloudflareOAuthCredentialAuthority> {
  const now = input.now ?? new Date()
  let record = await findByAuthorizationKey(
    payload,
    reference.authorizationKey,
  )
  if (
    !record ||
    !["authorized", "attached", "refreshing"].includes(record.state) ||
    !record.encryptedAuthority ||
    Date.parse(record.expiresAt) <= now.getTime()
  ) {
    throw new MigrationSourceAuthorizationError()
  }
  const stored = JSON.parse(openMigrationSecret(
    record.encryptedAuthority,
    authorizationBinding(record.stateDigest),
    input.env,
  )) as AuthorizedAuthority | RefreshingAuthority
  const refreshing = stored.kind === "cloudflare_oauth_refreshing"
  const authorized: AuthorizedAuthority = refreshing
    ? {
        schemaVersion: 1,
        kind: "cloudflare_oauth_authorized",
        source: stored.source,
        credential: stored.credential,
      }
    : stored
  const resumeState = refreshing
    ? stored.resumeState
    : record.state as "authorized" | "attached"
  if (
    refreshing !== (record.state === "refreshing") ||
    (refreshing &&
      !["authorized", "attached"].includes(stored.resumeState)) ||
    authorized.schemaVersion !== 1 ||
    authorized.kind !== "cloudflare_oauth_authorized" ||
    authorized.source.refreshCredential.kind !== "cloudflare_oauth" ||
    authorized.source.refreshCredential.authorizationKey !==
      reference.authorizationKey ||
    authorized.credential.zoneId !== reference.zoneId
  ) {
    throw new MigrationSourceAuthorizationError()
  }
  const credential = authorized.credential
  if (!refreshing &&
    Date.parse(credential.accessTokenExpiresAt) >
    now.getTime() + TOKEN_REFRESH_SKEW_MS
  ) {
    return credential
  }
  if (refreshing) {
    const claimAge = now.getTime() - Date.parse(record.updatedAt)
    if (
      !Number.isFinite(claimAge) ||
      claimAge < TOKEN_REFRESH_CLAIM_LEASE_MS
    ) {
      throw new MigrationSourceRefreshRetryableError(
        "Cloudflare OAuth refresh is already in progress.",
      )
    }
    const reclaimed = await payload.update({
      collection: "migration-source-authorizations",
      where: {
        and: [
          { id: { equals: record.id } },
          { state: { equals: "refreshing" } },
          { updatedAt: { equals: record.updatedAt } },
        ],
      },
      data: {
        updatedAt: now.toISOString(),
      },
      depth: 0,
      overrideAccess: true,
      context: { migrationSourceAuthorizationLifecycle: true },
    })
    if (!Array.isArray(reclaimed.docs) || reclaimed.docs.length !== 1) {
      throw new MigrationSourceRefreshRetryableError(
        "Cloudflare OAuth refresh is already in progress.",
      )
    }
    record = reclaimed.docs[0] as CloudflareSourceAuthorizationRecord
  } else {
    const refreshingAuthority: RefreshingAuthority = {
      schemaVersion: 1,
      kind: "cloudflare_oauth_refreshing",
      source: authorized.source,
      credential,
      resumeState,
    }
    const claimed = await payload.update({
      collection: "migration-source-authorizations",
      where: {
        and: [
          { id: { equals: record.id } },
          { state: { equals: record.state } },
          { updatedAt: { equals: record.updatedAt } },
        ],
      },
      data: {
        encryptedAuthority: sealMigrationSecret(
          JSON.stringify(refreshingAuthority),
          authorizationBinding(record.stateDigest),
          input.env,
        ),
        state: "refreshing",
        updatedAt: now.toISOString(),
      },
      depth: 0,
      overrideAccess: true,
      context: { migrationSourceAuthorizationLifecycle: true },
    })
    if (!Array.isArray(claimed.docs) || claimed.docs.length !== 1) {
      throw new MigrationSourceRefreshRetryableError(
        "Cloudflare OAuth refresh is already in progress.",
      )
    }
    record = claimed.docs[0] as CloudflareSourceAuthorizationRecord
  }
  const config = oauthConfig(input.env)
  let tokens: OAuthTokenResponse
  try {
    tokens = await tokenResponse(new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: credential.refreshToken,
    }), {
      config,
      fetchImpl: input.fetchImpl,
    })
  } catch (error) {
    if (error instanceof OAuthGrantRejectedError) {
      await revokeCloudflareSourceAuthorization(
        payload,
        reference,
        input,
      )
      throw new MigrationSourceAuthorizationError()
    }
    throw new MigrationSourceRefreshRetryableError()
  }
  const refreshed: CloudflareOAuthCredentialAuthority = {
    ...credential,
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
    accessTokenExpiresAt: new Date(
      now.getTime() + tokens.expiresInSeconds * 1_000,
    ).toISOString(),
    scopes: tokens.scopes.length > 0 ? tokens.scopes : credential.scopes,
  }
  if (tokens.scopes.length > 0 && !hasRequiredScopes(tokens.scopes)) {
    const revocationPending: RevocationPendingAuthority = {
      schemaVersion: 1,
      kind: "cloudflare_oauth_revocation_pending",
      credential: refreshed,
    }
    const quarantined = await payload.update({
      collection: "migration-source-authorizations",
      where: {
        and: [
          { id: { equals: record.id } },
          { state: { equals: "refreshing" } },
          { updatedAt: { equals: record.updatedAt } },
        ],
      },
      data: {
        encryptedAuthority: sealMigrationSecret(
          JSON.stringify(revocationPending),
          authorizationBinding(record.stateDigest),
          input.env,
        ),
        state: "revocation_pending",
        expiresAt: now.toISOString(),
        updatedAt: now.toISOString(),
      },
      depth: 0,
      overrideAccess: true,
      context: { migrationSourceAuthorizationLifecycle: true },
    })
    if (!Array.isArray(quarantined.docs) || quarantined.docs.length !== 1) {
      await retainOrRevokeDetachedCredential(
        payload,
        record,
        refreshed,
        { ...input, now },
      )
      throw new Error("Cloudflare OAuth refresh changed concurrently.")
    }
    throw new MigrationSourceAuthorizationError()
  }
  const updatedAuthority: AuthorizedAuthority = {
    ...authorized,
    credential: refreshed,
  }
  const persistedData = {
    encryptedAuthority: sealMigrationSecret(
      JSON.stringify(updatedAuthority),
      authorizationBinding(record.stateDigest),
      input.env,
    ),
    state: resumeState,
    updatedAt: now.toISOString(),
  }
  let candidate = record
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const update = await payload.update({
        collection: "migration-source-authorizations",
        where: {
          and: [
            { id: { equals: candidate.id } },
            { state: { equals: "refreshing" } },
            { updatedAt: { equals: candidate.updatedAt } },
          ],
        },
        data: persistedData,
        depth: 0,
        overrideAccess: true,
        context: { migrationSourceAuthorizationLifecycle: true },
      })
      if (Array.isArray(update.docs) && update.docs.length === 1) {
        return refreshed
      }
    } catch {
      // Reload below to distinguish a committed write from a failed write.
    }
    const winner = await findByAuthorizationKey(
      payload,
      reference.authorizationKey,
    )
    if (!winner) break
    if (
      ["authorized", "attached"].includes(winner.state) &&
      winner.encryptedAuthority
    ) {
      const value = JSON.parse(openMigrationSecret(
        winner.encryptedAuthority,
        authorizationBinding(winner.stateDigest),
        input.env,
      )) as AuthorizedAuthority
      if (
        value.kind === "cloudflare_oauth_authorized" &&
        value.credential.refreshToken === refreshed.refreshToken
      ) {
        return value.credential
      }
      await retainOrRevokeDetachedCredential(payload, record, refreshed, {
        env: input.env,
        now,
        fetchImpl: input.fetchImpl,
      })
      if (
        value.kind === "cloudflare_oauth_authorized" &&
        value.credential.zoneId === reference.zoneId
      ) {
        return value.credential
      }
      throw new MigrationSourceAuthorizationError()
    }
    if (
      winner.state !== "refreshing" ||
      !winner.encryptedAuthority
    ) {
      await retainOrRevokeDetachedCredential(payload, record, refreshed, {
        env: input.env,
        now,
        fetchImpl: input.fetchImpl,
      })
      throw new MigrationSourceAuthorizationError()
    }
    candidate = winner
  }
  await retainOrRevokeDetachedCredential(payload, record, refreshed, {
    env: input.env,
    now,
    fetchImpl: input.fetchImpl,
  })
  throw new MigrationSourceAuthorizationError()
}

export async function revokeCloudflareOAuthCredential(
  credential: CloudflareOAuthCredentialAuthority,
  input: {
    env?: NodeJS.ProcessEnv
    fetchImpl?: typeof fetch
  } = {},
): Promise<void> {
  const config = oauthConfig(input.env)
  const response = await (input.fetchImpl ?? globalThis.fetch)(
    REVOCATION_ENDPOINT,
    {
      method: "POST",
      headers: {
        Accept: "application/json",
        Authorization: `Basic ${Buffer.from(
          `${config.clientId}:${config.clientSecret}`,
        ).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        token: credential.refreshToken,
        token_type_hint: "refresh_token",
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    },
  )
  if (!response.ok) {
    throw new Error("Cloudflare OAuth authority revocation failed.")
  }
}

const authorityCredential = (
  record: CloudflareSourceAuthorizationRecord,
  env?: NodeJS.ProcessEnv,
): CloudflareOAuthCredentialAuthority => {
  if (!record.encryptedAuthority) {
    throw new Error("Cloudflare OAuth revocation authority is unavailable.")
  }
  const value = JSON.parse(openMigrationSecret(
    record.encryptedAuthority,
    authorizationBinding(record.stateDigest),
    env,
  )) as
    | AuthorizedAuthority
    | RefreshingAuthority
    | RevocationPendingAuthority
  if (
    value.schemaVersion !== 1 ||
    ![
      "cloudflare_oauth_authorized",
      "cloudflare_oauth_refreshing",
      "cloudflare_oauth_revocation_pending",
    ].includes(value.kind) ||
    !value.credential.refreshToken
  ) {
    throw new Error("Cloudflare OAuth revocation authority is invalid.")
  }
  return value.credential
}

export async function revokeCloudflareSourceAuthorization(
  payload: Payload,
  reference: Pick<
    Extract<AutomaticSourceRefreshCredential, { kind: "cloudflare_oauth" }>,
    "authorizationKey"
  >,
  input: {
    env?: NodeJS.ProcessEnv
    now?: Date
    fetchImpl?: typeof fetch
  } = {},
): Promise<boolean> {
  const now = input.now ?? new Date()
  for (let attempt = 0; attempt < 3; attempt += 1) {
    let record = await findByAuthorizationKey(
      payload,
      reference.authorizationKey,
    )
    if (!record || ["revoked", "expired"].includes(record.state)) return true
    if (
      ![
        "authorized",
        "attached",
        "refreshing",
        "revocation_pending",
      ].includes(record.state)
    ) {
      throw new Error(
        "Cloudflare source authorization is not revocable in its current state.",
      )
    }
    if (record.state !== "revocation_pending") {
      try {
        const claimed = await payload.update({
          collection: "migration-source-authorizations",
          where: {
            and: [
              { id: { equals: record.id } },
              { state: { equals: record.state } },
              { updatedAt: { equals: record.updatedAt } },
            ],
          },
          data: {
            state: "revocation_pending",
            expiresAt: now.toISOString(),
            updatedAt: now.toISOString(),
          },
          depth: 0,
          overrideAccess: true,
          context: { migrationSourceAuthorizationLifecycle: true },
        })
        if (!Array.isArray(claimed.docs) || claimed.docs.length !== 1) {
          continue
        }
        record = claimed.docs[0] as CloudflareSourceAuthorizationRecord
      } catch {
        continue
      }
    }
    try {
      await revokeCloudflareOAuthCredential(
        authorityCredential(record, input.env),
        input,
      )
    } catch {
      return false
    }
    try {
      const revoked = await payload.update({
        collection: "migration-source-authorizations",
        where: {
          and: [
            { id: { equals: record.id } },
            { state: { equals: "revocation_pending" } },
            { updatedAt: { equals: record.updatedAt } },
          ],
        },
        data: {
          state: "revoked",
          encryptedAuthority: null,
          revokedAt: now.toISOString(),
          updatedAt: now.toISOString(),
        },
        depth: 0,
        overrideAccess: true,
        context: { migrationSourceAuthorizationLifecycle: true },
      })
      if (Array.isArray(revoked.docs) && revoked.docs.length === 1) return true
    } catch {
      // The next bounded iteration resolves the actual database outcome.
    }
  }
  const winner = await findByAuthorizationKey(
    payload,
    reference.authorizationKey,
  )
  if (!winner || ["revoked", "expired"].includes(winner.state)) return true
  if (
    winner.state === "revocation_pending" &&
    Date.parse(winner.expiresAt) <= now.getTime()
  ) {
    return false
  }
  throw new Error(
    "Cloudflare source authorization could not be durably scheduled for revocation.",
  )
}

export async function expireCloudflareSourceAuthorizations(
  payload: Payload,
  input: {
    env?: NodeJS.ProcessEnv
    now?: Date
    fetchImpl?: typeof fetch
  } = {},
): Promise<{
  examined: number
  expired: number
  revoked: number
  deleted: number
  failed: number
}> {
  const now = input.now ?? new Date()
  const result = await payload.find({
    collection: "migration-source-authorizations",
    where: {
      and: [
        {
          state: {
            in: [
              "pending",
              "authorized",
              "attached",
              "refreshing",
              "revocation_pending",
            ],
          },
        },
        { expiresAt: { less_than_equal: now.toISOString() } },
      ],
    },
    limit: 100,
    depth: 0,
    overrideAccess: true,
  })
  let expired = 0
  let revoked = 0
  let failed = 0
  for (const raw of result.docs) {
    const record = raw as CloudflareSourceAuthorizationRecord
    try {
      if (record.state !== "pending") {
        const didRevoke = await revokeCloudflareSourceAuthorization(
          payload,
          { authorizationKey: record.authorizationKey },
          input,
        )
        if (didRevoke) revoked += 1
        else failed += 1
        continue
      }
      const updated = await payload.update({
        collection: "migration-source-authorizations",
        where: {
          and: [
            { id: { equals: record.id } },
            { state: { equals: record.state } },
            { updatedAt: { equals: record.updatedAt } },
          ],
        },
        data: {
          state: "expired",
          encryptedAuthority: null,
          updatedAt: now.toISOString(),
        },
        depth: 0,
        overrideAccess: true,
        context: { migrationSourceAuthorizationLifecycle: true },
      })
      if (Array.isArray(updated.docs) && updated.docs.length === 1) {
        expired += 1
      }
    } catch {
      failed += 1
    }
  }
  const terminalBefore = new Date(
    now.getTime() - TERMINAL_RETENTION_MS,
  ).toISOString()
  const terminal = await payload.find({
    collection: "migration-source-authorizations",
    where: {
      and: [
        { state: { in: ["revoked", "expired"] } },
        { updatedAt: { less_than_equal: terminalBefore } },
      ],
    },
    limit: 100,
    depth: 0,
    overrideAccess: true,
  })
  let deleted = 0
  for (const record of terminal.docs) {
    await payload.delete({
      collection: "migration-source-authorizations",
      id: record.id,
      depth: 0,
      overrideAccess: true,
    })
    deleted += 1
  }
  return {
    examined: result.docs.length + terminal.docs.length,
    expired,
    revoked,
    deleted,
    failed,
  }
}

export const cloudflareOAuthCookieName = (state: string): string =>
  `siab_cf_source_${state.slice(0, 12)}`

export async function cloudflareSourceAuthorizationContext(
  payload: Payload,
  state: string,
): Promise<{ clientSlug: string } | null> {
  if (!/^[A-Za-z0-9_-]{40,128}$/.test(state)) return null
  const record = await findByStateDigest(payload, digest(state))
  return record?.state === "pending"
    ? { clientSlug: record.clientSlug }
    : null
}

export const cloudflareSourceAuthorizationRunId = (
  record: CloudflareSourceAuthorizationRecord,
): string | null => relationshipId(record.generationRun)
