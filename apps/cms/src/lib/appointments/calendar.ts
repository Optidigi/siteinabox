import "server-only"

import { createHash, randomBytes } from "node:crypto"
import type { Payload, PayloadRequest } from "payload"
import type { User } from "@/payload-types"
import { browserOriginMatchesAuthority, canonicalRequestAuthority, type CanonicalRequestAuthority } from "@/lib/requestAuthority"
import { redactOperationalMessage } from "@/lib/security/redactOperationalMessage"
import { openAppointmentSecret, sealAppointmentSecret } from "./secrets"
import {
  asAppointmentSystemPayload,
  recordNumber,
  recordText,
  relationId,
  type AppointmentSystemPayload,
  type AppointmentSystemRecord,
} from "./systemPayload"

export type AppointmentCalendarProvider = "google" | "microsoft"

export class AppointmentCalendarError extends Error {
  readonly statusCode: 400 | 403 | 404 | 409 | 503

  constructor(message: string, statusCode: AppointmentCalendarError["statusCode"] = 400) {
    super(message)
    this.name = "AppointmentCalendarError"
    this.statusCode = statusCode
  }
}

class AppointmentCalendarAuthError extends AppointmentCalendarError {
  constructor(message = "The calendar connection needs to be authorised again.") {
    super(message, 409)
    this.name = "AppointmentCalendarAuthError"
  }
}

const CALLBACK_PATHS: Record<AppointmentCalendarProvider, string> = {
  google: "/api/appointments/calendar/google/callback",
  microsoft: "/api/appointments/calendar/microsoft/callback",
}

const CALLBACK_HOST_ENV: Record<AppointmentCalendarProvider, string> = {
  google: "SIAB_GOOGLE_CALENDAR_CALLBACK_HOSTS",
  microsoft: "SIAB_MICROSOFT_CALENDAR_CALLBACK_HOSTS",
}

const OAUTH_HOST_FALLBACK_ENV: Record<AppointmentCalendarProvider, string> = {
  google: "SIAB_GOOGLE_OAUTH_CALLBACK_HOSTS",
  microsoft: "SIAB_MICROSOFT_OAUTH_CALLBACK_HOSTS",
}

const OAUTH_STATE_TTL_MS = 10 * 60_000
const OAUTH_STATE_BYTES = 32
const OAUTH_VERIFIER_BYTES = 32
const REQUEST_TIMEOUT_MS = 10_000
const PERMANENT_RETRY_AT = "9999-12-31T00:00:00.000Z"
const CALENDAR_RETRY_DELAYS_MS = [60_000, 5 * 60_000, 30 * 60_000, 2 * 60 * 60_000, 12 * 60 * 60_000]
const CALENDAR_LEASE_MS = 5 * 60_000
const CALENDAR_MAX_ATTEMPTS = 6

const providerSet = new Set<AppointmentCalendarProvider>(["google", "microsoft"])

export const isAppointmentCalendarProvider = (value: unknown): value is AppointmentCalendarProvider =>
  typeof value === "string" && providerSet.has(value as AppointmentCalendarProvider)

const providerFrom = (value: unknown): AppointmentCalendarProvider => {
  if (!isAppointmentCalendarProvider(value)) throw new AppointmentCalendarError("Unsupported calendar provider.")
  return value
}

const envValue = (env: NodeJS.ProcessEnv, key: string): string | null => {
  const value = env[key]?.trim()
  return value && !(value.startsWith("<") && value.endsWith(">")) ? value : null
}

const configuredHosts = (provider: AppointmentCalendarProvider, env: NodeJS.ProcessEnv): Set<string> => {
  const values = [envValue(env, CALLBACK_HOST_ENV[provider]), envValue(env, OAUTH_HOST_FALLBACK_ENV[provider])]
    .filter((value): value is string => Boolean(value))
    .flatMap((value) => value.split(","))
  const hosts = new Set<string>()
  for (const value of values) {
    try {
      const url = new URL(value.trim().includes("://") ? value.trim() : `https://${value.trim()}`)
      hosts.add(url.hostname.toLowerCase())
    } catch {
      // An invalid allowlist item is ignored; the host remains denied.
    }
  }
  return hosts
}

export const calendarCallbackRegisteredForHost = (
  provider: AppointmentCalendarProvider,
  host: string | null | undefined,
  env: NodeJS.ProcessEnv = process.env,
): boolean => {
  const value = host?.trim().toLowerCase() ?? ""
  if (!value) return false
  let hostname: string
  try {
    hostname = new URL(value.includes("://") ? value : `https://${value}`).hostname.toLowerCase()
  } catch {
    return false
  }
  if (env.NODE_ENV === "development" && (hostname === "localhost" || hostname.endsWith(".localhost") || hostname === "127.0.0.1" || hostname === "[::1]")) return true
  return configuredHosts(provider, env).has(hostname)
}

export const appointmentCalendarCallbackUrl = (provider: AppointmentCalendarProvider, authority: CanonicalRequestAuthority): string =>
  `${authority.origin}${CALLBACK_PATHS[provider]}`

export const safeAppointmentReturnPath = (value: string | null | undefined): string => {
  const path = value?.trim() ?? ""
  if (path === "/appointments") return path
  if (/^\/sites\/[a-z0-9-]+\/appointments$/.test(path)) return path
  return "/appointments"
}

const digest = (value: string): string => createHash("sha256").update(value, "utf8").digest("hex")
const base64url = (value: Uint8Array): string => Buffer.from(value).toString("base64url")

const makePkce = () => {
  const verifier = base64url(randomBytes(OAUTH_VERIFIER_BYTES))
  const challenge = base64url(createHash("sha256").update(verifier, "ascii").digest())
  return { verifier, challenge }
}

const callbackAuthority = (headers: Pick<Headers, "get">, provider: AppointmentCalendarProvider, env = process.env): CanonicalRequestAuthority => {
  const authority = canonicalRequestAuthority(headers, env)
  if (!authority || !calendarCallbackRegisteredForHost(provider, authority.host, env)) {
    throw new AppointmentCalendarError("This calendar callback host is not registered.", 403)
  }
  return authority
}

export function assertCalendarCallbackRequest(
  headers: Pick<Headers, "get">,
  provider: AppointmentCalendarProvider,
  env = process.env,
): CanonicalRequestAuthority {
  return callbackAuthority(headers, provider, env)
}

export function assertCalendarStartRequest(
  headers: Pick<Headers, "get">,
  provider: AppointmentCalendarProvider,
  env = process.env,
): CanonicalRequestAuthority {
  if (!browserOriginMatchesAuthority(headers, { env, originRequired: true })) {
    throw new AppointmentCalendarError("Cross-origin calendar request rejected.", 403)
  }
  return callbackAuthority(headers, provider, env)
}

const credentialsFor = (provider: AppointmentCalendarProvider, env: NodeJS.ProcessEnv = process.env): { clientId: string; clientSecret: string } => {
  const id = envValue(env, provider === "google" ? "GOOGLE_CLIENT_ID" : "MICROSOFT_CLIENT_ID")
  const secret = envValue(env, provider === "google" ? "GOOGLE_CLIENT_SECRET" : "MICROSOFT_CLIENT_SECRET")
  if (!id || !secret) throw new AppointmentCalendarError(`${provider} calendar integration is not configured.`, 503)
  return { clientId: id, clientSecret: secret }
}

export const appointmentCalendarProviderConfigured = (
  provider: AppointmentCalendarProvider,
  env: NodeJS.ProcessEnv = process.env,
): boolean => {
  try {
    credentialsFor(provider, env)
    return true
  } catch {
    return false
  }
}

const microsoftTenant = (env: NodeJS.ProcessEnv): string => envValue(env, "MICROSOFT_CALENDAR_TENANT_ID") ?? envValue(env, "MICROSOFT_TENANT_ID") ?? "common"

const authorizationUrl = (provider: AppointmentCalendarProvider, input: {
  clientId: string
  redirectUri: string
  state: string
  challenge: string
  env: NodeJS.ProcessEnv
}): string => {
  const url = provider === "google"
    ? new URL("https://accounts.google.com/o/oauth2/v2/auth")
    : new URL(`https://login.microsoftonline.com/${encodeURIComponent(microsoftTenant(input.env))}/oauth2/v2.0/authorize`)
  url.searchParams.set("client_id", input.clientId)
  url.searchParams.set("redirect_uri", input.redirectUri)
  url.searchParams.set("response_type", "code")
  url.searchParams.set("state", input.state)
  url.searchParams.set("code_challenge", input.challenge)
  url.searchParams.set("code_challenge_method", "S256")
  if (provider === "google") {
    url.searchParams.set("scope", "https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/calendar.calendarlist.readonly")
    url.searchParams.set("access_type", "offline")
    url.searchParams.set("prompt", "consent")
  } else {
    url.searchParams.set("scope", "offline_access Calendars.ReadWrite User.Read")
    url.searchParams.set("response_mode", "query")
  }
  return url.toString()
}

export async function startCalendarAuthorization(input: {
  payload: Payload
  user: User
  tenantId: number | string
  provider: AppointmentCalendarProvider
  returnPath?: string | null
  headers: Pick<Headers, "get">
  env?: NodeJS.ProcessEnv
}): Promise<{ authorizationUrl: string; returnPath: string }> {
  const env = input.env ?? process.env
  const provider = providerFrom(input.provider)
  const authority = assertCalendarStartRequest(input.headers, provider, env)
  const credentials = credentialsFor(provider, env)
  if (!Number.isSafeInteger(Number(input.tenantId)) || Number(input.tenantId) <= 0) throw new AppointmentCalendarError("The selected tenant is invalid.")
  if (!Number.isSafeInteger(Number(input.user.id)) || Number(input.user.id) <= 0) throw new AppointmentCalendarError("The signed-in user is invalid.", 403)
  const state = base64url(randomBytes(OAUTH_STATE_BYTES))
  const pkce = makePkce()
  const returnPath = safeAppointmentReturnPath(input.returnPath)
  await asAppointmentSystemPayload(input.payload).create({
    collection: "appointment-calendar-oauth-states",
    data: {
      stateDigest: digest(state),
      tenant: Number(input.tenantId),
      user: Number(input.user.id),
      provider,
      encryptedCodeVerifier: sealAppointmentSecret(pkce.verifier, "appointment-calendar-code-verifier", env),
      returnPath,
      expiresAt: new Date(Date.now() + OAUTH_STATE_TTL_MS).toISOString(),
    },
    depth: 0,
    overrideAccess: true,
  })
  return {
    authorizationUrl: authorizationUrl(provider, {
      clientId: credentials.clientId,
      redirectUri: appointmentCalendarCallbackUrl(provider, authority),
      state,
      challenge: pkce.challenge,
      env,
    }),
    returnPath,
  }
}

type JsonObject = Record<string, unknown>

const asJsonObject = (value: unknown): JsonObject | null =>
  value && typeof value === "object" && !Array.isArray(value) ? value as JsonObject : null

const stringValue = (value: unknown): string | null => typeof value === "string" && value.trim() ? value.trim() : null
const numberValue = (value: unknown): number | null => typeof value === "number" && Number.isFinite(value) ? value : null

const fetchJson = async (input: RequestInfo | URL, init: RequestInit): Promise<{ status: number; body: JsonObject | null }> => {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
  try {
    const response = await fetch(input, { ...init, signal: controller.signal })
    const body = asJsonObject(await response.json().catch(() => null))
    return { status: response.status, body }
  } finally {
    clearTimeout(timeout)
  }
}

const oauthToken = async (provider: AppointmentCalendarProvider, input: {
  code?: string
  refreshToken?: string
  verifier?: string
  redirectUri?: string
  env: NodeJS.ProcessEnv
}): Promise<JsonObject> => {
  const credentials = credentialsFor(provider, input.env)
  const body = new URLSearchParams({
    client_id: credentials.clientId,
    client_secret: credentials.clientSecret,
    ...(input.code ? { code: input.code, grant_type: "authorization_code", redirect_uri: input.redirectUri ?? "", code_verifier: input.verifier ?? "" } : { refresh_token: input.refreshToken ?? "", grant_type: "refresh_token" }),
  })
  const endpoint = provider === "google"
    ? "https://oauth2.googleapis.com/token"
    : `https://login.microsoftonline.com/${encodeURIComponent(microsoftTenant(input.env))}/oauth2/v2.0/token`
  const response = await fetchJson(endpoint, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body,
  })
  if (response.status < 200 || response.status >= 300 || !response.body?.access_token) {
    const error = stringValue(response.body?.error_description) ?? stringValue(response.body?.error)
    if (error && /invalid_grant|invalid_token|unauthori[sz]ed/i.test(error)) throw new AppointmentCalendarAuthError()
    throw new AppointmentCalendarError("The calendar provider could not authorise the connection.", response.status >= 500 ? 503 : 400)
  }
  return response.body
}

const accessTokenFrom = (body: JsonObject): string => {
  const token = stringValue(body.access_token)
  if (!token) throw new AppointmentCalendarError("The calendar provider returned no access token.", 503)
  return token
}

const tokenExpiry = (body: JsonObject, now = new Date()): string => {
  const seconds = Math.max(60, Math.floor(numberValue(body.expires_in) ?? 3_600) - 60)
  return new Date(now.getTime() + seconds * 1_000).toISOString()
}

const providerRequest = async (url: string, token: string, init: RequestInit = {}): Promise<JsonObject> => {
  const headers = new Headers(init.headers)
  headers.set("authorization", `Bearer ${token}`)
  const response = await fetchJson(url, {
    ...init,
    headers,
  })
  if (response.status === 401 || response.status === 403) throw new AppointmentCalendarAuthError()
  if (response.status < 200 || response.status >= 300) {
    const statusCode = response.status === 404
      ? 404
      : response.status >= 500
        ? 503
        : 400
    throw new AppointmentCalendarError(`Calendar provider request failed with HTTP ${response.status}.`, statusCode)
  }
  return response.body ?? {}
}

const googleAccount = async (token: string): Promise<{ email: string }> => {
  const profile = await providerRequest("https://www.googleapis.com/oauth2/v3/userinfo", token)
  const email = stringValue(profile.email)
  if (!email) throw new AppointmentCalendarError("Google returned no account email.", 503)
  return { email: email.toLowerCase() }
}

const microsoftAccount = async (token: string): Promise<{ email: string }> => {
  const profile = await providerRequest("https://graph.microsoft.com/v1.0/me?$select=mail,userPrincipalName", token)
  const email = stringValue(profile.mail) ?? stringValue(profile.userPrincipalName)
  if (!email) throw new AppointmentCalendarError("Microsoft returned no account email.", 503)
  return { email: email.toLowerCase() }
}

type CalendarChoice = { id: string; name: string }

const googleCalendar = async (token: string): Promise<CalendarChoice> => {
  const result = await providerRequest("https://www.googleapis.com/calendar/v3/users/me/calendarList?minAccessRole=writer&showDeleted=false&maxResults=250", token)
  const items = Array.isArray(result.items) ? result.items : []
  const candidates = items.filter((item): item is JsonObject => Boolean(item && typeof item === "object" && !Array.isArray(item)))
  const selected = candidates.find((item) => item.primary === true && stringValue(item.id)) ?? candidates.find((item) => stringValue(item.id))
  const id = stringValue(selected?.id)
  if (!id) throw new AppointmentCalendarError("Google returned no writable calendar.", 503)
  return { id, name: stringValue(selected?.summaryOverride) ?? stringValue(selected?.summary) ?? "Google Calendar" }
}

const microsoftCalendar = async (token: string): Promise<CalendarChoice> => {
  const result = await providerRequest("https://graph.microsoft.com/v1.0/me/calendars?$select=id,name,isDefaultCalendar,canEdit&$top=100", token)
  const items = Array.isArray(result.value) ? result.value : []
  const candidates = items.filter((item): item is JsonObject => Boolean(item && typeof item === "object" && !Array.isArray(item) && item.canEdit !== false))
  const selected = candidates.find((item) => item.isDefaultCalendar === true && stringValue(item.id)) ?? candidates.find((item) => stringValue(item.id))
  const id = stringValue(selected?.id)
  if (!id) throw new AppointmentCalendarError("Microsoft returned no writable calendar.", 503)
  return { id, name: stringValue(selected?.name) ?? "Microsoft Calendar" }
}

const consumeOAuthState = async (payload: AppointmentSystemPayload, input: {
  state: string
  provider: AppointmentCalendarProvider
  now: Date
}): Promise<AppointmentSystemRecord> => {
  if (!/^[A-Za-z0-9_-]{32,128}$/.test(input.state)) throw new AppointmentCalendarError("Invalid calendar OAuth state.", 400)
  const result = await payload.find({
    collection: "appointment-calendar-oauth-states",
    where: {
      and: [
        { stateDigest: { equals: digest(input.state) } },
        { provider: { equals: input.provider } },
        { expiresAt: { greater_than: input.now.toISOString() } },
        { usedAt: { equals: null } },
      ],
    },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })
  const candidate = result.docs[0]
  if (!candidate) throw new AppointmentCalendarError("Invalid or expired calendar OAuth state.", 400)
  const claimed = await payload.update({
    collection: "appointment-calendar-oauth-states",
    id: candidate.id,
    where: {
      and: [
        { id: { equals: candidate.id } },
        { usedAt: { equals: null } },
        { expiresAt: { greater_than: input.now.toISOString() } },
      ],
    },
    data: { usedAt: input.now.toISOString() },
    depth: 0,
    overrideAccess: true,
  })
  const docs = claimed && typeof claimed === "object" && !Array.isArray(claimed) && Array.isArray((claimed as unknown as { docs?: unknown }).docs)
    ? (claimed as unknown as { docs: AppointmentSystemRecord[] }).docs
    : []
  if (!docs[0]) throw new AppointmentCalendarError("Calendar OAuth state was already used.", 400)
  return docs[0]
}

export async function getCalendarOAuthReturnPath(
  inputPayload: Payload,
  stateValue: string,
  providerValue: AppointmentCalendarProvider,
): Promise<string> {
  if (!/^[A-Za-z0-9_-]{32,128}$/.test(stateValue)) return "/appointments"
  const payload = asAppointmentSystemPayload(inputPayload)
  const result = await payload.find({
    collection: "appointment-calendar-oauth-states",
    where: {
      and: [
        { stateDigest: { equals: digest(stateValue) } },
        { provider: { equals: providerValue } },
      ],
    },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })
  return safeAppointmentReturnPath(recordText(result.docs[0] ?? { id: "" }, "returnPath"))
}

const calendarEventKey = (appointmentId: string | number, connectionId: string | number): string =>
  `appointment:${appointmentId}:calendar:${connectionId}`

const eventVersionOf = (record: AppointmentSystemRecord | null | undefined): number => {
  const value = recordNumber(record ?? { id: "" }, "eventVersion", 1)
  return Number.isSafeInteger(value) && value >= 1 ? value : 1
}

const createCalendarEventIfMissing = async (
  payload: AppointmentSystemPayload,
  input: { where: { eventKey: { equals: string } }; data: Record<string, unknown> },
): Promise<AppointmentSystemRecord> => {
  const existing = await payload.find({
    collection: "appointment-calendar-events",
    where: input.where,
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })
  if (existing.docs[0]) return existing.docs[0]
  try {
    return await payload.create({
      collection: "appointment-calendar-events",
      data: input.data,
      depth: 0,
      overrideAccess: true,
      context: { appointmentCalendarLifecycleMutation: true },
    })
  } catch (error) {
    const raced = await payload.find({
      collection: "appointment-calendar-events",
      where: input.where,
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })
    if (raced.docs[0]) return raced.docs[0]
    throw error
  }
}

const enqueueConfirmedAppointmentsForConnection = async (
  payload: AppointmentSystemPayload,
  connection: AppointmentSystemRecord,
  now: Date,
): Promise<void> => {
  const tenantId = relationId(connection.tenant)
  if (!tenantId) return
  let page = 1
  while (true) {
    const appointments = await payload.find({
      collection: "appointments",
      where: {
        and: [
          { tenant: { equals: tenantId } },
          { status: { equals: "confirmed" } },
          { endAt: { greater_than_equal: now.toISOString() } },
        ],
      },
      limit: 500,
      page,
      depth: 0,
      overrideAccess: true,
    })
    for (const appointment of appointments.docs) {
      const key = calendarEventKey(appointment.id, connection.id)
      const eventVersion = eventVersionOf(appointment)
      const data = {
        eventKey: key,
        appointment: Number(appointment.id),
        connection: Number(connection.id),
        eventVersion,
        status: "queued",
        operation: "upsert",
        attemptCount: 0,
        nextAttemptAt: now.toISOString(),
        leaseUntil: null,
        lastError: null,
      }
      const existing = await payload.find({
        collection: "appointment-calendar-events",
        where: { eventKey: { equals: key } },
        limit: 1,
        depth: 0,
        overrideAccess: true,
      })
      if (existing.docs[0]) {
        await payload.update({
          collection: "appointment-calendar-events",
          id: existing.docs[0].id,
          data: {
            eventVersion,
            status: "queued",
            operation: "upsert",
            attemptCount: 0,
            nextAttemptAt: now.toISOString(),
            leaseUntil: null,
            lastError: null,
          },
          depth: 0,
          overrideAccess: true,
          context: { appointmentCalendarLifecycleMutation: true },
        })
      } else {
        await createCalendarEventIfMissing(payload, { where: { eventKey: { equals: key } }, data })
      }
    }
    if (appointments.hasNextPage !== true) break
    page += 1
  }
}

const upsertConnection = async (payload: AppointmentSystemPayload, input: {
  provider: AppointmentCalendarProvider
  tenantId: string
  userId: string
  accountEmail: string
  calendar: CalendarChoice
  accessToken: string
  refreshToken: string
  expiresAt: string
  scopes: string[]
  now: Date
  env: NodeJS.ProcessEnv
}) => {
  const connectionKey = `${input.tenantId}:${input.provider}`
  const existingResult = await payload.find({
    collection: "appointment-calendar-connections",
    where: { connectionKey: { equals: connectionKey } },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })
  const existing = existingResult.docs[0]
  const existingEncryptedRefreshToken = recordText(existing ?? { id: "" }, "encryptedRefreshToken")
  if (!input.refreshToken && !existingEncryptedRefreshToken) throw new AppointmentCalendarError("The calendar provider did not return a refresh token. Re-authorise with offline access enabled.", 503)
  const data = {
    connectionKey,
    tenant: Number(input.tenantId),
    provider: input.provider,
    accountEmail: input.accountEmail,
    calendarId: input.calendar.id,
    calendarName: input.calendar.name,
    status: "connected",
    encryptedAccessToken: sealAppointmentSecret(input.accessToken, "appointment-calendar-access-token", input.env),
    encryptedRefreshToken: input.refreshToken
      ? sealAppointmentSecret(input.refreshToken, "appointment-calendar-refresh-token", input.env)
      : existingEncryptedRefreshToken,
    accessTokenExpiresAt: input.expiresAt,
    scopes: input.scopes,
    connectedBy: Number(input.userId),
    lastError: null,
  }
  if (existing) {
    const saved = await payload.update({
      collection: "appointment-calendar-connections",
      id: existing.id,
      data,
      depth: 0,
      overrideAccess: true,
      context: { appointmentCalendarLifecycleMutation: true },
    })
    await enqueueConfirmedAppointmentsForConnection(payload, saved, input.now)
    return saved
  }
  const saved = await payload.create({
    collection: "appointment-calendar-connections",
    data,
    depth: 0,
    overrideAccess: true,
  })
  await enqueueConfirmedAppointmentsForConnection(payload, saved, input.now)
  return saved
}

export async function completeCalendarAuthorization(input: {
  payload: Payload
  provider: AppointmentCalendarProvider
  state: string
  code: string
  headers: Headers
  env?: NodeJS.ProcessEnv
  now?: Date
}): Promise<{ returnPath: string; provider: AppointmentCalendarProvider; accountEmail: string; calendarName: string }> {
  const env = input.env ?? process.env
  const provider = providerFrom(input.provider)
  const authority = callbackAuthority(input.headers, provider, env)
  if (!input.code || input.code.length > 4_096) throw new AppointmentCalendarError("The calendar authorisation code is invalid.")
  const now = input.now ?? new Date()
  const payload = asAppointmentSystemPayload(input.payload)
  const state = await consumeOAuthState(payload, { state: input.state, provider, now })
  const verifierEncrypted = recordText(state, "encryptedCodeVerifier")
  const tenantId = relationId(state.tenant)
  const userId = relationId(state.user)
  const returnPath = safeAppointmentReturnPath(recordText(state, "returnPath"))
  if (!verifierEncrypted || !tenantId || !userId) throw new AppointmentCalendarError("Calendar OAuth state is incomplete.", 400)

  // The OAuth state is intentionally single-use, but it must not become a
  // bearer credential if the initiating CMS session was logged out or its
  // tenant role changed while the provider screen was open.
  const auth = await input.payload.auth({ headers: input.headers })
  const actor = auth.user as User | null
  const actorTenantId = relationId(actor?.tenants?.[0]?.tenant)
  const authorized = Boolean(
    actor &&
      String(actor.id) === userId &&
      (actor.role === "super-admin" || (actor.role === "owner" && actorTenantId === tenantId)),
  )
  if (!authorized) throw new AppointmentCalendarError("Calendar authorisation is no longer valid.", 403)

  const verifier = openAppointmentSecret(verifierEncrypted, "appointment-calendar-code-verifier", env)
  const token = await oauthToken(provider, {
    code: input.code,
    verifier,
    redirectUri: appointmentCalendarCallbackUrl(provider, authority),
    env,
  })
  const accessToken = accessTokenFrom(token)
  const refreshToken = stringValue(token.refresh_token) ?? ""
  const account = provider === "google" ? await googleAccount(accessToken) : await microsoftAccount(accessToken)
  const calendar = provider === "google" ? await googleCalendar(accessToken) : await microsoftCalendar(accessToken)
  const scopes = (stringValue(token.scope) ?? (provider === "google" ? "https://www.googleapis.com/auth/calendar.events" : "offline_access Calendars.ReadWrite User.Read")).split(/\s+/).filter(Boolean)
  await upsertConnection(payload, {
    provider,
    tenantId,
    userId,
    accountEmail: account.email,
    calendar,
    accessToken,
    refreshToken,
    expiresAt: tokenExpiry(token, now),
    scopes,
    now,
    env,
  })
  return { returnPath, provider, accountEmail: account.email, calendarName: calendar.name }
}

const loadConnection = async (payload: AppointmentSystemPayload, id: string | number): Promise<AppointmentSystemRecord | null> => {
  const result = await payload.find({
    collection: "appointment-calendar-connections",
    where: { id: { equals: id } },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })
  return result.docs[0] ?? null
}

const loadAppointment = async (payload: AppointmentSystemPayload, id: string | number): Promise<AppointmentSystemRecord | null> => {
  const result = await payload.find({
    collection: "appointments",
    where: { id: { equals: id } },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })
  return result.docs[0] ?? null
}

const markConnection = async (payload: AppointmentSystemPayload, connection: AppointmentSystemRecord, data: Record<string, unknown>) =>
  payload.update({
    collection: "appointment-calendar-connections",
    id: connection.id,
    data,
    depth: 0,
    overrideAccess: true,
    context: { appointmentCalendarLifecycleMutation: true },
  })

const clearRevokedConnectionIfIdle = async (payload: AppointmentSystemPayload, connection: AppointmentSystemRecord): Promise<void> => {
  if (recordText(connection, "status") !== "revoked") return
  const pending = await payload.find({
    collection: "appointment-calendar-events",
    where: {
      and: [
        { connection: { equals: connection.id } },
        { status: { in: ["queued", "processing", "synced", "failed"] } },
      ],
    },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })
  if (pending.docs[0]) return
  await markConnection(payload, connection, {
    encryptedAccessToken: null,
    encryptedRefreshToken: null,
    accessTokenExpiresAt: null,
  })
}

const refreshAccessToken = async (payload: AppointmentSystemPayload, connection: AppointmentSystemRecord, now: Date, env: NodeJS.ProcessEnv): Promise<string> => {
  const existingAccess = recordText(connection, "encryptedAccessToken")
  const expiresAt = recordText(connection, "accessTokenExpiresAt")
  if (existingAccess && expiresAt && Number.isFinite(Date.parse(expiresAt)) && new Date(expiresAt).getTime() > now.getTime() + 60_000) {
    return openAppointmentSecret(existingAccess, "appointment-calendar-access-token", env)
  }
  const encryptedRefresh = recordText(connection, "encryptedRefreshToken")
  if (!encryptedRefresh) {
    await markConnection(payload, connection, { status: "reauth_required", lastError: "Calendar refresh token is unavailable." })
    throw new AppointmentCalendarAuthError()
  }
  const provider = providerFrom(recordText(connection, "provider"))
  let refreshToken: string
  try {
    refreshToken = openAppointmentSecret(encryptedRefresh, "appointment-calendar-refresh-token", env)
  } catch {
    await markConnection(payload, connection, { status: "error", lastError: "Calendar refresh token could not be opened." })
    throw new AppointmentCalendarAuthError()
  }
  try {
    const token = await oauthToken(provider, { refreshToken, env })
    const accessToken = accessTokenFrom(token)
    await markConnection(payload, connection, {
      status: "connected",
      encryptedAccessToken: sealAppointmentSecret(accessToken, "appointment-calendar-access-token", env),
      ...(token.refresh_token ? { encryptedRefreshToken: sealAppointmentSecret(String(token.refresh_token), "appointment-calendar-refresh-token", env) } : {}),
      accessTokenExpiresAt: tokenExpiry(token, now),
      lastError: null,
    })
    return accessToken
  } catch (error) {
    if (error instanceof AppointmentCalendarAuthError) {
      await markConnection(payload, connection, { status: "reauth_required", lastError: "The calendar provider rejected the refresh token." })
    }
    throw error
  }
}

const eventIdFor = (eventKey: string): string => `siab${digest(eventKey).slice(0, 48)}`

type AppointmentCalendarEventInput = {
  provider: AppointmentCalendarProvider
  token: string
  calendarId: string
  providerEventId?: string | null
  eventKey: string
  visitorName: string
  visitorNote?: string | null
  startAt: string
  endAt: string
  timezone: string
}

const calendarEventBody = (input: AppointmentCalendarEventInput): JsonObject => {
  const summary = `Afspraak: ${input.visitorName}`
  const description = input.visitorNote ? `Afspraak via de website.\n\nOpmerking:\n${input.visitorNote}` : "Afspraak via de website."
  if (input.provider === "google") {
    return {
      id: eventIdFor(input.eventKey),
      summary,
      description,
      start: { dateTime: new Date(input.startAt).toISOString(), timeZone: input.timezone },
      end: { dateTime: new Date(input.endAt).toISOString(), timeZone: input.timezone },
    }
  }
  return {
    subject: summary,
    body: { contentType: "text", content: description },
    start: { dateTime: new Date(input.startAt).toISOString().replace("Z", ""), timeZone: "UTC" },
    end: { dateTime: new Date(input.endAt).toISOString().replace("Z", ""), timeZone: "UTC" },
    transactionId: eventIdFor(input.eventKey),
  }
}

const externalEvent = async (input: AppointmentCalendarEventInput): Promise<{ id: string }> => {
  const body = calendarEventBody(input)
  if (input.provider === "google") {
    const calendarPath = encodeURIComponent(input.calendarId)
    if (input.providerEventId) {
      try {
        await providerRequest(`https://www.googleapis.com/calendar/v3/calendars/${calendarPath}/events/${encodeURIComponent(input.providerEventId)}`, input.token, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(body) })
        return { id: input.providerEventId }
      } catch (error) {
        if (!(error instanceof AppointmentCalendarError) || error.statusCode !== 404) throw error
      }
    }
    const created = await providerRequest(`https://www.googleapis.com/calendar/v3/calendars/${calendarPath}/events?sendUpdates=none`, input.token, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) })
    const id = stringValue(created.id)
    if (!id) throw new AppointmentCalendarError("Google returned no event id.", 503)
    return { id }
  }
  const calendarPath = encodeURIComponent(input.calendarId)
  if (input.providerEventId) {
    try {
      await providerRequest(`https://graph.microsoft.com/v1.0/me/calendars/${calendarPath}/events/${encodeURIComponent(input.providerEventId)}`, input.token, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(body) })
      return { id: input.providerEventId }
    } catch (error) {
      if (!(error instanceof AppointmentCalendarError) || error.statusCode !== 404) throw error
    }
  }
  const created = await providerRequest(`https://graph.microsoft.com/v1.0/me/calendars/${calendarPath}/events`, input.token, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) })
  const id = stringValue(created.id)
  if (!id) throw new AppointmentCalendarError("Microsoft returned no event id.", 503)
  return { id }
}

const deleteExternalEvent = async (input: { provider: AppointmentCalendarProvider; token: string; calendarId: string; providerEventId: string }): Promise<void> => {
  const calendarPath = encodeURIComponent(input.calendarId)
  const endpoint = input.provider === "google"
    ? `https://www.googleapis.com/calendar/v3/calendars/${calendarPath}/events/${encodeURIComponent(input.providerEventId)}`
    : `https://graph.microsoft.com/v1.0/me/calendars/${calendarPath}/events/${encodeURIComponent(input.providerEventId)}`
  try {
    await providerRequest(endpoint, input.token, { method: "DELETE" })
  } catch (error) {
    if (error instanceof AppointmentCalendarError && (error.statusCode === 404 || error.message.includes("HTTP 404"))) return
    throw error
  }
}

const claimCalendarEvent = async (payload: AppointmentSystemPayload, event: AppointmentSystemRecord, now: Date): Promise<AppointmentSystemRecord | null> => {
  const attemptCount = recordNumber(event, "attemptCount") + 1
  const result = await payload.update({
    collection: "appointment-calendar-events",
    id: event.id,
    where: {
      and: [
        { id: { equals: event.id } },
        {
          or: [
            { and: [{ status: { in: ["queued", "failed"] } }, { nextAttemptAt: { less_than_equal: now.toISOString() } }] },
            { and: [{ status: { equals: "processing" } }, { leaseUntil: { less_than_equal: now.toISOString() } }] },
          ],
        },
      ],
    },
    data: { status: "processing", attemptCount, lastAttemptAt: now.toISOString(), leaseUntil: new Date(now.getTime() + CALENDAR_LEASE_MS).toISOString(), lastError: null },
    depth: 0,
    overrideAccess: true,
    context: { appointmentCalendarLifecycleMutation: true },
  })
  if (result && typeof result === "object" && !Array.isArray(result)) {
    const docs = (result as { docs?: unknown }).docs
    if (Array.isArray(docs) && docs[0] && typeof docs[0] === "object" && "id" in docs[0]) return docs[0] as AppointmentSystemRecord
    if ("id" in result) return result
  }
  return null
}

const calendarRetryAt = (now: Date, attemptCount: number): string => {
  const delay = CALENDAR_RETRY_DELAYS_MS[Math.min(Math.max(attemptCount - 1, 0), CALENDAR_RETRY_DELAYS_MS.length - 1)] ?? 60_000
  return new Date(now.getTime() + delay).toISOString()
}

const queueLatestCalendarEvent = async (
  payload: AppointmentSystemPayload,
  event: AppointmentSystemRecord,
  appointment: AppointmentSystemRecord | null,
  now: Date,
  providerEventId?: string | null,
): Promise<void> => {
  const latestProviderEventId = providerEventId === undefined
    ? recordText(event, "providerEventId")
    : providerEventId
  const hasAppointment = Boolean(appointment)
  const status = recordText(appointment, "status")
  const operation = status === "confirmed" ? "upsert" : "delete"
  await payload.update({
    collection: "appointment-calendar-events",
    id: event.id,
    data: {
      eventVersion: eventVersionOf(appointment ?? event),
      status: hasAppointment || latestProviderEventId ? "queued" : "cancelled",
      operation,
      providerEventId: latestProviderEventId,
      attemptCount: 0,
      nextAttemptAt: now.toISOString(),
      leaseUntil: null,
      lastError: null,
    },
    depth: 0,
    overrideAccess: true,
    context: { appointmentCalendarLifecycleMutation: true },
  })
}

export async function processAppointmentCalendarEvents(input: { payload: Payload; now?: Date; limit?: number }) {
  const payload = asAppointmentSystemPayload(input.payload)
  const now = input.now ?? new Date()
  const limit = Math.max(1, Math.min(Math.floor(input.limit ?? 100), 500))
  const result = await payload.find({
    collection: "appointment-calendar-events",
    where: {
      or: [
        { and: [{ status: { in: ["queued", "failed"] } }, { nextAttemptAt: { less_than_equal: now.toISOString() } }] },
        { and: [{ status: { equals: "processing" } }, { leaseUntil: { less_than_equal: now.toISOString() } }] },
      ],
    },
    sort: "nextAttemptAt",
    limit,
    depth: 0,
    overrideAccess: true,
  })
  let synced = 0
  let failed = 0
  let skipped = 0
  for (const event of result.docs.slice(0, limit)) {
    const claimed = await claimCalendarEvent(payload, event, now)
    if (!claimed) {
      skipped += 1
      continue
    }
    const claimedVersion = eventVersionOf(claimed)
    try {
      const connectionId = relationId(claimed.connection)
      const appointmentId = relationId(claimed.appointment)
      if (!connectionId || !appointmentId) {
        await payload.update({
          collection: "appointment-calendar-events",
          id: claimed.id,
          data: { eventVersion: claimedVersion, status: "cancelled", leaseUntil: null, lastError: "Calendar event is missing its appointment or connection." },
          depth: 0,
          overrideAccess: true,
          context: { appointmentCalendarLifecycleMutation: true },
        })
        skipped += 1
        continue
      }

      const connection = await loadConnection(payload, connectionId)
      const appointment = await loadAppointment(payload, appointmentId)
      const providerEventId = recordText(claimed, "providerEventId")
      if (!connection) {
        await payload.update({
          collection: "appointment-calendar-events",
          id: claimed.id,
          data: { eventVersion: claimedVersion, status: "cancelled", leaseUntil: null, nextAttemptAt: now.toISOString(), syncedAt: now.toISOString(), lastError: "Calendar connection no longer exists." },
          depth: 0,
          overrideAccess: true,
          context: { appointmentCalendarLifecycleMutation: true },
        })
        skipped += 1
        continue
      }

      const provider = providerFrom(recordText(connection, "provider"))
      if (!appointment) {
        if (providerEventId) {
          const token = await refreshAccessToken(payload, connection, now, process.env)
          await deleteExternalEvent({ provider, token, calendarId: recordText(connection, "calendarId") ?? "", providerEventId })
        }
        await payload.update({
          collection: "appointment-calendar-events",
          id: claimed.id,
          data: { eventVersion: claimedVersion, status: "cancelled", operation: "delete", providerEventId: null, leaseUntil: null, nextAttemptAt: now.toISOString(), syncedAt: now.toISOString(), lastError: null },
          depth: 0,
          overrideAccess: true,
          context: { appointmentCalendarLifecycleMutation: true },
        })
        await clearRevokedConnectionIfIdle(payload, connection)
        synced += 1
        continue
      }

      // Appointment mutations and calendar work are intentionally separate
      // transactions. Re-read the version before touching a provider so a
      // stale queue item cannot overwrite a reschedule or cancellation.
      if (eventVersionOf(appointment) !== claimedVersion) {
        await queueLatestCalendarEvent(payload, claimed, appointment, now)
        skipped += 1
        continue
      }

      const operation = recordText(claimed, "operation") === "delete" ? "delete" : "upsert"
      const appointmentStatus = recordText(appointment, "status")
      const shouldDelete = operation === "delete" || appointmentStatus !== "confirmed"
      const token = await refreshAccessToken(payload, connection, now, process.env)
      if (shouldDelete) {
        if (providerEventId) await deleteExternalEvent({ provider, token, calendarId: recordText(connection, "calendarId") ?? "", providerEventId })
        const latest = await loadAppointment(payload, appointment.id)
        if (!latest) {
          await payload.update({
            collection: "appointment-calendar-events",
            id: claimed.id,
            data: { eventVersion: claimedVersion, status: "cancelled", operation: "delete", providerEventId: null, leaseUntil: null, nextAttemptAt: now.toISOString(), syncedAt: now.toISOString(), lastError: null },
            depth: 0,
            overrideAccess: true,
            context: { appointmentCalendarLifecycleMutation: true },
          })
          await clearRevokedConnectionIfIdle(payload, connection)
          synced += 1
          continue
        }
        if (eventVersionOf(latest) !== claimedVersion || recordText(latest, "status") === "confirmed") {
          await queueLatestCalendarEvent(payload, claimed, latest, now, null)
          skipped += 1
          continue
        }
        await payload.update({
          collection: "appointment-calendar-events",
          id: claimed.id,
          data: { eventVersion: claimedVersion, status: "cancelled", operation: "delete", providerEventId: null, leaseUntil: null, nextAttemptAt: now.toISOString(), syncedAt: now.toISOString(), lastError: null },
          depth: 0,
          overrideAccess: true,
          context: { appointmentCalendarLifecycleMutation: true },
        })
      } else {
        const visitorName = recordText(appointment, "visitorName") ?? "Bezoeker"
        const startAt = recordText(appointment, "startAt")
        const endAt = recordText(appointment, "endAt")
        const timezone = recordText(appointment, "timezone") ?? "UTC"
        if (!startAt || !endAt) throw new AppointmentCalendarError("Appointment has invalid calendar times.", 400)
        const external = await externalEvent({ provider, token, calendarId: recordText(connection, "calendarId") ?? "", providerEventId, eventKey: recordText(claimed, "eventKey") ?? `appointment:${claimed.id}`, visitorName, visitorNote: recordText(appointment, "visitorNote"), startAt, endAt, timezone })
        const latest = await loadAppointment(payload, appointment.id)
        if (!latest || eventVersionOf(latest) !== claimedVersion || recordText(latest, "status") !== "confirmed") {
          await queueLatestCalendarEvent(payload, claimed, latest, now, external.id)
          skipped += 1
          continue
        }
        await payload.update({
          collection: "appointment-calendar-events",
          id: claimed.id,
          data: { eventVersion: claimedVersion, status: "synced", operation: "upsert", providerEventId: external.id, leaseUntil: null, nextAttemptAt: now.toISOString(), syncedAt: now.toISOString(), lastError: null },
          depth: 0,
          overrideAccess: true,
          context: { appointmentCalendarLifecycleMutation: true },
        })
      }
      await markConnection(payload, connection, { lastSyncedAt: now.toISOString(), lastError: null, ...(recordText(connection, "status") === "reauth_required" ? { status: "connected" } : {}) })
      await clearRevokedConnectionIfIdle(payload, connection)
      synced += 1
    } catch (error) {
      const attemptCount = recordNumber(claimed, "attemptCount")
      const authError = error instanceof AppointmentCalendarAuthError
      const retryable = !authError && (error instanceof AppointmentCalendarError ? error.statusCode === 503 : true) && attemptCount < CALENDAR_MAX_ATTEMPTS
      const message = redactOperationalMessage(error)
      await payload.update({ collection: "appointment-calendar-events", id: claimed.id, data: { eventVersion: claimedVersion, status: "failed", leaseUntil: null, nextAttemptAt: retryable ? calendarRetryAt(now, attemptCount) : PERMANENT_RETRY_AT, lastError: message }, depth: 0, overrideAccess: true, context: { appointmentCalendarLifecycleMutation: true } })
      failed += 1
    }
  }
  return { examined: result.docs.length, synced, failed, skipped }
}

export async function disconnectCalendarConnection(input: { payload: Payload; tenantId: number | string; provider: AppointmentCalendarProvider; now?: Date }): Promise<void> {
  const payload = asAppointmentSystemPayload(input.payload)
  const provider = providerFrom(input.provider)
  const result = await payload.find({ collection: "appointment-calendar-connections", where: { and: [{ tenant: { equals: input.tenantId } }, { provider: { equals: provider } }] }, limit: 1, depth: 0, overrideAccess: true })
  const connection = result.docs[0]
  if (!connection) return
  const now = (input.now ?? new Date()).toISOString()
  await markConnection(payload, connection, { status: "revoked", lastError: null })
  let page = 1
  while (true) {
    const events = await payload.find({ collection: "appointment-calendar-events", where: { connection: { equals: connection.id } }, limit: 500, page, depth: 0, overrideAccess: true })
    for (const event of events.docs) {
      await payload.update({ collection: "appointment-calendar-events", id: event.id, data: { eventVersion: eventVersionOf(event), status: "queued", operation: "delete", nextAttemptAt: now, leaseUntil: null, lastError: null }, depth: 0, overrideAccess: true, context: { appointmentCalendarLifecycleMutation: true } })
    }
    if (events.hasNextPage !== true) break
    page += 1
  }
  await clearRevokedConnectionIfIdle(payload, { ...connection, status: "revoked" })
}

export const appointmentCalendarPermanentRetryAt = PERMANENT_RETRY_AT
