import "server-only"

import { createHash, randomBytes } from "node:crypto"
import type { Payload, RequiredDataFromCollectionSlug } from "payload"
import { z } from "zod"
import { requestProviderJson } from "@/lib/providers/http"
import type { Appointment, AppointmentCalendarConnection, AppointmentCalendarEvent, AppointmentCalendarOauthState, User } from "@/payload-types"
import { browserOriginMatchesAuthority, canonicalRequestAuthority, type CanonicalRequestAuthority } from "@/lib/requestAuthority"
import { redactOperationalMessage } from "@/lib/security/redactOperationalMessage"
import { openAppointmentSecret, sealAppointmentSecret } from "./secrets"
import { AppointmentAtomicClaimError, claimAppointmentCalendarEvent, claimAppointmentCalendarOAuthState, transitionAppointmentCalendarEvent } from "./atomicClaims"
import {
  recordNumber,
  recordText,
  relationId,
} from "./systemPayload"

type CalendarReadWritePayload = Pick<Payload, "find" | "update" | "db">
type CalendarSystemPayload = Pick<Payload, "find" | "update" | "create" | "db">

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
  payload: Pick<Payload, "create">
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
  await input.payload.create({
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
const boundaryFailure = (): AppointmentCalendarError => new AppointmentCalendarError("The calendar provider returned an invalid response.", 503)
const opaqueId = z.string().min(1).max(2048).refine(value => value === value.trim() && !/[\x00-\x20\x7f]/.test(value))
const tokenText = z.string().min(1).max(16384).refine(value => !/[\x00-\x20\x7f]/.test(value))
const tokenSchema = z.object({ access_token: tokenText, token_type: z.string().refine(value => value.toLowerCase() === "bearer"), expires_in: z.number().int().positive().max(31_536_000), refresh_token: tokenText.optional(), scope: z.string().max(16384).optional() }).passthrough()
const parseBoundary = <T>(schema: z.ZodType<T>, value: unknown): T => {
  const parsed = schema.safeParse(value)
  if (!parsed.success) throw boundaryFailure()
  return parsed.data
}

const fetchJson = async (input: string, init: RequestInit): Promise<{ status: number; body: unknown }> => {
  try {
    return await requestProviderJson(input, init, { operation: "Calendar provider", timeoutMs: REQUEST_TIMEOUT_MS, maxBodyBytes: 512 * 1024, readAttempts: 2, allowEmpty: init.method === "DELETE" })
  } catch {
    // Provider bodies, URLs and transport diagnostics must never enter the queue.
    throw new AppointmentCalendarError("The calendar provider request could not be completed.", 503)
  }
}

const oauthToken = async (provider: AppointmentCalendarProvider, input: {
  code?: string
  refreshToken?: string
  verifier?: string
  redirectUri?: string
  env: NodeJS.ProcessEnv
  signal?: AbortSignal
}): Promise<z.infer<typeof tokenSchema>> => {
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
    signal: input.signal,
  })
  if (response.status !== 200) {
    const error = asJsonObject(response.body)?.error
    if (error === "invalid_grant" || error === "invalid_token" || error === "unauthorized_client") throw new AppointmentCalendarAuthError()
    throw new AppointmentCalendarError("The calendar provider could not authorise the connection.", response.status === 429 || response.status >= 500 ? 503 : 400)
  }
  return parseBoundary(tokenSchema, response.body)
}

const accessTokenFrom = (body: z.infer<typeof tokenSchema>): string => body.access_token

const tokenExpiry = (body: z.infer<typeof tokenSchema>, now = new Date()): string => {
  const token = parseBoundary(tokenSchema, body)
  const seconds = Math.max(1, token.expires_in - 60)
  return new Date(now.getTime() + seconds * 1_000).toISOString()
}

const providerRequest = async (url: string, token: string, init: RequestInit = {}, successStatus = 200): Promise<JsonObject> => {
  parseBoundary(tokenText, token)
  const headers = new Headers(init.headers)
  headers.set("authorization", `Bearer ${token}`)
  const response = await fetchJson(url, { ...init, headers })
  const error = asJsonObject(asJsonObject(response.body)?.error)
  const reasons = Array.isArray(error?.errors) ? error.errors.map(value => asJsonObject(value)?.reason) : []
  if (response.status === 429 || response.status >= 500 || (response.status === 403 && reasons.some(reason => reason === "rateLimitExceeded" || reason === "userRateLimitExceeded"))) throw new AppointmentCalendarError("The calendar provider is temporarily unavailable.", 503)
  if (response.status === 401 || response.status === 403) throw new AppointmentCalendarAuthError()
  if (response.status < 200 || response.status >= 300) throw new AppointmentCalendarError(`Calendar provider request failed with HTTP ${response.status}.`, response.status === 404 ? 404 : response.status === 409 ? 409 : 400)
  if (init.method === "DELETE") {
    if (response.status !== 204) throw boundaryFailure()
    return {}
  }
  if (response.status !== successStatus) throw boundaryFailure()
  const body = asJsonObject(response.body)
  if (!body) throw boundaryFailure()
  return body
}

const googleAccount = async (token: string, signal?: AbortSignal): Promise<{ email: string }> => {
  const profile = await providerRequest("https://www.googleapis.com/oauth2/v3/userinfo", token, { signal })
  const email = parseBoundary(z.object({ email: z.string().email().max(320) }), profile).email
  if (!email) throw new AppointmentCalendarError("Google returned no account email.", 503)
  return { email: email.toLowerCase() }
}

const microsoftAccount = async (token: string, signal?: AbortSignal): Promise<{ email: string }> => {
  const profile = await providerRequest("https://graph.microsoft.com/v1.0/me?$select=mail,userPrincipalName", token, { signal })
  const account = parseBoundary(z.object({ mail: z.string().email().max(320).nullable().optional(), userPrincipalName: z.string().email().max(320).optional() }), profile)
  const email = account.mail ?? account.userPrincipalName
  if (!email) throw new AppointmentCalendarError("Microsoft returned no account email.", 503)
  return { email: email.toLowerCase() }
}

type CalendarChoice = { id: string; name: string }

const googleCalendarSchema = z.object({ items: z.array(z.object({ id: opaqueId, accessRole: z.enum(["none", "freeBusyReader", "reader", "writerWithoutPrivateAccess", "writer", "owner"]), primary: z.boolean().optional(), deleted: z.boolean().optional(), summary: z.string().max(4096).optional(), summaryOverride: z.string().max(4096).optional() }).passthrough()).max(250), nextPageToken: z.string().min(1).max(4096).optional() })
const graphCalendarSchema = z.object({ value: z.array(z.object({ id: opaqueId, name: z.string().max(4096), canEdit: z.boolean(), isDefaultCalendar: z.boolean() }).passthrough()).max(100), "@odata.nextLink": z.string().min(1).max(8192).optional() })
const calendarChoice = async (provider: AppointmentCalendarProvider, token: string, signal?: AbortSignal): Promise<CalendarChoice> => {
  const base = provider === "google" ? "https://www.googleapis.com/calendar/v3/users/me/calendarList?minAccessRole=writer&showDeleted=false&maxResults=250" : "https://graph.microsoft.com/v1.0/me/calendars?$select=id,name,isDefaultCalendar,canEdit&$top=100"
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 30_000)
  const abort = () => controller.abort()
  signal?.addEventListener("abort", abort, { once: true })
  if (signal?.aborted) controller.abort()
  let url = base
  const seen = new Set<string>()
  let first: CalendarChoice | undefined
  let total = 0
  try {
    for (let page = 0; page < 10; page += 1) {
      if (seen.has(url)) throw boundaryFailure()
      seen.add(url)
      const result = await providerRequest(url, token, { signal: controller.signal })
      if (provider === "google") {
        const body = parseBoundary(googleCalendarSchema, result)
        total += body.items.length
        if (total > 1000) throw boundaryFailure()
        for (const item of body.items) {
          if (item.deleted || !["writer", "owner"].includes(item.accessRole)) continue
          const choice = { id: item.id, name: item.summaryOverride ?? item.summary ?? "Google Calendar" }
          first ??= choice
          if (item.primary) return choice
        }
        if (!body.nextPageToken) break
        const next = new URL(base); next.searchParams.set("pageToken", body.nextPageToken); url = next.href
      } else {
        const body = parseBoundary(graphCalendarSchema, result)
        total += body.value.length
        if (total > 1000) throw boundaryFailure()
        for (const item of body.value) {
          if (!item.canEdit) continue
          const choice = { id: item.id, name: item.name }
          first ??= choice
          if (item.isDefaultCalendar) return choice
        }
        const link = body["@odata.nextLink"]
        if (!link) break
        let next: URL
        try { next = new URL(link) } catch { throw boundaryFailure() }
        const original = new URL(base)
        if (next.origin !== original.origin || next.pathname !== original.pathname || next.username || next.password || next.hash || next.searchParams.get("$select") !== original.searchParams.get("$select") || next.searchParams.get("$top") !== "100" || [...next.searchParams.keys()].some(key => !["$select", "$top", "$skip", "$skiptoken"].includes(key)) || [...next.searchParams.keys()].some(key => next.searchParams.getAll(key).length !== 1)) throw boundaryFailure()
        url = next.href
      }
      if (page === 9) throw boundaryFailure()
    }
    if (!first) throw new AppointmentCalendarError("The calendar provider returned no writable calendar.", 503)
    return first
  } finally {
    clearTimeout(timeout)
    signal?.removeEventListener("abort", abort)
  }
}
const googleCalendar = (token: string, signal?: AbortSignal) => calendarChoice("google", token, signal)
const microsoftCalendar = (token: string, signal?: AbortSignal) => calendarChoice("microsoft", token, signal)

const consumeOAuthState = async (payload: CalendarReadWritePayload, input: {
  state: string
  provider: AppointmentCalendarProvider
  now: Date
}): Promise<AppointmentCalendarOauthState> => {
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
  const state = await claimAppointmentCalendarOAuthState(payload, candidate, input.now)
  if (!state) throw new AppointmentCalendarError("Calendar OAuth state was already used.", 400)
  return state
}

export async function getCalendarOAuthReturnPath(
  inputPayload: Pick<Payload, "find">,
  stateValue: string,
  providerValue: AppointmentCalendarProvider,
): Promise<string> {
  if (!/^[A-Za-z0-9_-]{32,128}$/.test(stateValue)) return "/appointments"
  const payload = inputPayload
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

const eventVersionOf = (record: Pick<Appointment | AppointmentCalendarEvent, "eventVersion"> | null | undefined): number => {
  const value = recordNumber(record ?? { id: "" }, "eventVersion", 1)
  return Number.isSafeInteger(value) && value >= 1 ? value : 1
}

const createCalendarEventIfMissing = async (
  payload: CalendarSystemPayload,
  input: { where: { eventKey: { equals: string } }; data: RequiredDataFromCollectionSlug<"appointment-calendar-events"> },
): Promise<AppointmentCalendarEvent> => {
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
  payload: CalendarSystemPayload,
  connection: AppointmentCalendarConnection,
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
      const data: RequiredDataFromCollectionSlug<"appointment-calendar-events"> = {
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
            // Keep same-version attempts monotonic so a requeue cannot recreate an old lease.
            ...(existing.docs[0].eventVersion === eventVersion ? {} : { attemptCount: 0 }),
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

const upsertConnection = async (payload: CalendarSystemPayload, input: {
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
  const data: RequiredDataFromCollectionSlug<"appointment-calendar-connections"> = {
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
  payload: CalendarSystemPayload & Pick<Payload, "auth">
  provider: AppointmentCalendarProvider
  state: string
  code: string
  headers: Headers
  env?: NodeJS.ProcessEnv
  now?: Date
  signal?: AbortSignal
}): Promise<{ returnPath: string; provider: AppointmentCalendarProvider; accountEmail: string; calendarName: string }> {
  const env = input.env ?? process.env
  const provider = providerFrom(input.provider)
  const authority = callbackAuthority(input.headers, provider, env)
  if (!input.code || input.code.length > 4_096) throw new AppointmentCalendarError("The calendar authorisation code is invalid.")
  const now = input.now ?? new Date()
  const payload = input.payload
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
  const actor = auth.user
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
    signal: input.signal,
  })
  const accessToken = accessTokenFrom(token)
  const refreshToken = stringValue(token.refresh_token) ?? ""
  const account = provider === "google" ? await googleAccount(accessToken, input.signal) : await microsoftAccount(accessToken, input.signal)
  const calendar = provider === "google" ? await googleCalendar(accessToken, input.signal) : await microsoftCalendar(accessToken, input.signal)
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

const loadConnection = async (payload: CalendarReadWritePayload, id: string | number): Promise<AppointmentCalendarConnection | null> => {
  const result = await payload.find({
    collection: "appointment-calendar-connections",
    where: { id: { equals: id } },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })
  return result.docs[0] ?? null
}

const loadAppointment = async (payload: CalendarReadWritePayload, id: string | number): Promise<Appointment | null> => {
  const result = await payload.find({
    collection: "appointments",
    where: { id: { equals: id } },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })
  return result.docs[0] ?? null
}

const markConnection = async (payload: CalendarReadWritePayload, connection: AppointmentCalendarConnection, data: Partial<AppointmentCalendarConnection>) =>
  payload.update({
    collection: "appointment-calendar-connections",
    id: connection.id,
    data,
    depth: 0,
    overrideAccess: true,
    context: { appointmentCalendarLifecycleMutation: true },
  })

const clearRevokedConnectionIfIdle = async (payload: CalendarReadWritePayload, connection: AppointmentCalendarConnection): Promise<void> => {
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

const refreshAccessToken = async (payload: CalendarReadWritePayload, connection: AppointmentCalendarConnection, now: Date, env: NodeJS.ProcessEnv, signal?: AbortSignal): Promise<string> => {
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
    const token = await oauthToken(provider, { refreshToken, env, signal })
    const accessToken = accessTokenFrom(token)
    await markConnection(payload, connection, {
      status: "connected",
      encryptedAccessToken: sealAppointmentSecret(accessToken, "appointment-calendar-access-token", env),
      ...(token.refresh_token ? { encryptedRefreshToken: sealAppointmentSecret(token.refresh_token, "appointment-calendar-refresh-token", env) } : {}),
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
  signal?: AbortSignal
  createUncertain?: boolean
  onCreateIntent?: () => Promise<void>
  assertLease?: () => Promise<void>
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

const eventTimeSchema = z.object({ dateTime: z.string().min(1).max(128).regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,7})?(?:Z|[+-]\d{2}:\d{2})?$/).refine(value => Number.isFinite(Date.parse(value))), timeZone: z.string().min(1).max(128).optional() })
const googleEventSchema = z.object({ id: z.string().regex(/^[a-v0-9]{5,1024}$/), status: z.literal("confirmed"), summary: z.string().max(4096), description: z.string().max(65536), start: eventTimeSchema, end: eventTimeSchema }).passthrough()
const graphEventSchema = z.object({ id: opaqueId, transactionId: opaqueId, isCancelled: z.literal(false), subject: z.string().max(4096), body: z.object({ contentType: z.string().refine(value => value.toLowerCase() === "text"), content: z.string().max(65536) }), start: eventTimeSchema, end: eventTimeSchema }).passthrough()
const validateEvent = (input: AppointmentCalendarEventInput, response: unknown, expectedId?: string): { id: string } => {
  const requested = calendarEventBody(input)
  if (input.provider === "google") {
    const event = parseBoundary(googleEventSchema, response)
    const start = asJsonObject(requested.start)!
    const end = asJsonObject(requested.end)!
    if (event.id !== (expectedId ?? eventIdFor(input.eventKey)) || event.summary !== requested.summary || event.description !== requested.description || Date.parse(event.start.dateTime) !== Date.parse(String(start.dateTime)) || Date.parse(event.end.dateTime) !== Date.parse(String(end.dateTime)) || (event.start.timeZone !== undefined && event.start.timeZone !== input.timezone) || (event.end.timeZone !== undefined && event.end.timeZone !== input.timezone)) throw boundaryFailure()
    return { id: event.id }
  }
  const event = parseBoundary(graphEventSchema, response)
  const utc = (value: string) => Date.parse(/(?:Z|[+-]\d{2}:\d{2})$/.test(value) ? value : `${value}Z`)
  if ((expectedId !== undefined && event.id !== expectedId) || event.transactionId !== eventIdFor(input.eventKey) || event.subject !== requested.subject || event.body.content !== asJsonObject(requested.body)?.content || event.start.timeZone !== "UTC" || event.end.timeZone !== "UTC" || utc(event.start.dateTime) !== Date.parse(input.startAt) || utc(event.end.dateTime) !== Date.parse(input.endAt)) throw boundaryFailure()
  return { id: event.id }
}

const externalEvent = async (input: AppointmentCalendarEventInput): Promise<{ id: string }> => {
  parseBoundary(opaqueId, input.calendarId)
  if (!input.eventKey || input.eventKey.length > 2048) throw new AppointmentCalendarError("Calendar event identity is unavailable.", 400)
  if (input.providerEventId) parseBoundary(input.provider === "google" ? z.string().regex(/^[a-v0-9]{5,1024}$/) : opaqueId, input.providerEventId)
  const body = calendarEventBody(input)
  const calendarPath = encodeURIComponent(input.calendarId)
  const base = input.provider === "google" ? `https://www.googleapis.com/calendar/v3/calendars/${calendarPath}/events` : `https://graph.microsoft.com/v1.0/me/calendars/${calendarPath}/events`
  const write = (method: string) => ({ method, headers: { "content-type": "application/json" }, body: JSON.stringify(body), signal: input.signal })
  if (input.providerEventId) {
    try {
      await input.assertLease?.()
      const updated = await providerRequest(`${base}/${encodeURIComponent(input.providerEventId)}`, input.token, write("PATCH"))
      return validateEvent(input, updated, input.providerEventId)
    } catch (error) {
      if (!(error instanceof AppointmentCalendarError) || error.statusCode !== 404) throw error
    }
  }
  if (input.provider === "microsoft" && input.createUncertain) throw new AppointmentCalendarError("Calendar create outcome is unresolved; provider reconciliation is required.", 503)
  await input.onCreateIntent?.()
  try {
    const created = await providerRequest(input.provider === "google" ? `${base}?sendUpdates=none` : base, input.token, write("POST"), input.provider === "google" ? 200 : 201)
    return validateEvent(input, created)
  } catch (error) {
    if (input.provider !== "google" || !(error instanceof AppointmentCalendarError) || error.statusCode !== 409) throw error
    // A previous deterministic POST may have succeeded despite a lost response.
    // Never generate another ID or claim an unrelated existing event.
    const existing = await providerRequest(`${base}/${eventIdFor(input.eventKey)}`, input.token, { signal: input.signal })
    return validateEvent(input, existing)
  }
}

const deleteExternalEvent = async (input: { provider: AppointmentCalendarProvider; token: string; calendarId: string; providerEventId: string; signal?: AbortSignal; assertLease?: () => Promise<void> }): Promise<void> => {
  parseBoundary(opaqueId, input.calendarId)
  parseBoundary(input.provider === "google" ? z.string().regex(/^[a-v0-9]{5,1024}$/) : opaqueId, input.providerEventId)
  const calendarPath = encodeURIComponent(input.calendarId)
  const endpoint = input.provider === "google"
    ? `https://www.googleapis.com/calendar/v3/calendars/${calendarPath}/events/${encodeURIComponent(input.providerEventId)}`
    : `https://graph.microsoft.com/v1.0/me/calendars/${calendarPath}/events/${encodeURIComponent(input.providerEventId)}`
  try {
    await input.assertLease?.()
    await providerRequest(endpoint, input.token, { method: "DELETE", signal: input.signal })
  } catch (error) {
    if (error instanceof AppointmentCalendarError && error.statusCode === 404) return
    throw error
  }
}

const resolveUncertainDeletion = async (input: { provider: AppointmentCalendarProvider; token: string; calendarId: string; eventKey: string; signal?: AbortSignal; assertLease?: () => Promise<void> }): Promise<void> => {
  if (input.provider !== "google") throw new AppointmentCalendarError("Calendar create outcome is unresolved; provider reconciliation is required.", 503)
  parseBoundary(opaqueId, input.calendarId)
  if (!input.eventKey) throw boundaryFailure()
  const id = eventIdFor(input.eventKey)
  const endpoint = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(input.calendarId)}/events/${id}`
  try {
    const existing = parseBoundary(googleEventSchema, await providerRequest(endpoint, input.token, { signal: input.signal }))
    if (existing.id !== id) throw boundaryFailure()
  } catch {
    // GET404 does not prove a timed-out remote create cannot finish later.
    throw new AppointmentCalendarError("Calendar create outcome is unresolved; provider reconciliation is required.", 503)
  }
  await deleteExternalEvent({ ...input, providerEventId: id })
}

const claimCalendarEvent = (payload: CalendarReadWritePayload, event: AppointmentCalendarEvent, now: Date): Promise<AppointmentCalendarEvent | null> => claimAppointmentCalendarEvent(payload, event, now, CALENDAR_LEASE_MS)

const calendarRetryAt = (now: Date, attemptCount: number): string => {
  const delay = CALENDAR_RETRY_DELAYS_MS[Math.min(Math.max(attemptCount - 1, 0), CALENDAR_RETRY_DELAYS_MS.length - 1)] ?? 60_000
  return new Date(now.getTime() + delay).toISOString()
}

const queueLatestCalendarEvent = async (
  payload: CalendarReadWritePayload,
  event: AppointmentCalendarEvent,
  appointment: Appointment | null,
  now: Date,
  providerEventId?: string | null,
): Promise<void> => {
  const latestProviderEventId = providerEventId === undefined
    ? recordText(event, "providerEventId")
    : providerEventId
  const hasAppointment = Boolean(appointment)
  const status = recordText(appointment, "status")
  const operation = status === "confirmed" ? "upsert" : "delete"
  const latestVersion = eventVersionOf(appointment ?? event)
  await transitionAppointmentCalendarEvent(payload, event, {
      eventVersion: latestVersion,
      status: hasAppointment || latestProviderEventId ? "queued" : "cancelled",
      operation,
      providerEventId: latestProviderEventId,
      ...(providerEventId !== undefined ? { providerCreateUncertain: false } : {}),
      ...(latestVersion === event.eventVersion ? {} : { attemptCount: 0 }),
      nextAttemptAt: now.toISOString(),
      leaseUntil: null,
      lastError: null,
    })
}

export async function processAppointmentCalendarEvents(input: { payload: CalendarReadWritePayload; now?: Date; limit?: number; signal?: AbortSignal }) {
  const payload = input.payload
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
    if (input.signal?.aborted) break
    const claimed = await claimCalendarEvent(payload, event, now)
    if (!claimed) {
      skipped += 1
      continue
    }
    const claimedVersion = eventVersionOf(claimed)
    try {
      const createUncertain = claimed.providerCreateUncertain === true
      const connectionId = relationId(claimed.connection)
      const appointmentId = relationId(claimed.appointment)
      if ((!connectionId || !appointmentId) && createUncertain) throw new AppointmentCalendarError("Calendar create outcome is unresolved; provider reconciliation is required.", 503)
      if (!connectionId || !appointmentId) {
        await transitionAppointmentCalendarEvent(payload, claimed, { eventVersion: claimedVersion, status: "cancelled", leaseUntil: null, lastError: "Calendar event is missing its appointment or connection." })
        skipped += 1
        continue
      }

      const connection = await loadConnection(payload, connectionId)
      const appointment = await loadAppointment(payload, appointmentId)
      const providerEventId = recordText(claimed, "providerEventId")
      const persistCreateUncertainty = async (value: boolean) => {
        await transitionAppointmentCalendarEvent(payload, claimed, { providerCreateUncertain: value })
      }
      if (!connection && createUncertain) throw new AppointmentCalendarError("Calendar create outcome is unresolved; provider reconciliation is required.", 503)
      if (!connection) {
        await transitionAppointmentCalendarEvent(payload, claimed, { eventVersion: claimedVersion, status: "cancelled", leaseUntil: null, nextAttemptAt: now.toISOString(), syncedAt: now.toISOString(), lastError: "Calendar connection no longer exists." })
        skipped += 1
        continue
      }

      const provider = providerFrom(recordText(connection, "provider"))
      if (!appointment) {
        if (createUncertain && !providerEventId) {
          const token = await refreshAccessToken(payload, connection, now, process.env, input.signal)
          await resolveUncertainDeletion({ provider, token, calendarId: recordText(connection, "calendarId") ?? "", eventKey: recordText(claimed, "eventKey") ?? "", signal: input.signal, assertLease: () => transitionAppointmentCalendarEvent(payload, claimed, {}) })
        }
        if (providerEventId) {
          const token = await refreshAccessToken(payload, connection, now, process.env, input.signal)
          await deleteExternalEvent({ provider, token, calendarId: recordText(connection, "calendarId") ?? "", providerEventId, signal: input.signal, assertLease: () => transitionAppointmentCalendarEvent(payload, claimed, {}) })
        }
        await transitionAppointmentCalendarEvent(payload, claimed, { eventVersion: claimedVersion, status: "cancelled", operation: "delete", providerEventId: null, providerCreateUncertain: false, leaseUntil: null, nextAttemptAt: now.toISOString(), syncedAt: now.toISOString(), lastError: null })
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
      const token = await refreshAccessToken(payload, connection, now, process.env, input.signal)
      if (shouldDelete) {
        if (createUncertain && !providerEventId) await resolveUncertainDeletion({ provider, token, calendarId: recordText(connection, "calendarId") ?? "", eventKey: recordText(claimed, "eventKey") ?? "", signal: input.signal, assertLease: () => transitionAppointmentCalendarEvent(payload, claimed, {}) })
        if (providerEventId) await deleteExternalEvent({ provider, token, calendarId: recordText(connection, "calendarId") ?? "", providerEventId, signal: input.signal, assertLease: () => transitionAppointmentCalendarEvent(payload, claimed, {}) })
        const latest = await loadAppointment(payload, appointment.id)
        if (!latest) {
          await transitionAppointmentCalendarEvent(payload, claimed, { eventVersion: claimedVersion, status: "cancelled", operation: "delete", providerEventId: null, providerCreateUncertain: false, leaseUntil: null, nextAttemptAt: now.toISOString(), syncedAt: now.toISOString(), lastError: null })
          await clearRevokedConnectionIfIdle(payload, connection)
          synced += 1
          continue
        }
        if (eventVersionOf(latest) !== claimedVersion || recordText(latest, "status") === "confirmed") {
          await queueLatestCalendarEvent(payload, claimed, latest, now, null)
          skipped += 1
          continue
        }
        await transitionAppointmentCalendarEvent(payload, claimed, { eventVersion: claimedVersion, status: "cancelled", operation: "delete", providerEventId: null, providerCreateUncertain: false, leaseUntil: null, nextAttemptAt: now.toISOString(), syncedAt: now.toISOString(), lastError: null })
      } else {
        const visitorName = recordText(appointment, "visitorName") ?? "Bezoeker"
        const startAt = recordText(appointment, "startAt")
        const endAt = recordText(appointment, "endAt")
        const timezone = recordText(appointment, "timezone") ?? "UTC"
        if (!startAt || !endAt) throw new AppointmentCalendarError("Appointment has invalid calendar times.", 400)
        const external = await externalEvent({ provider, token, calendarId: recordText(connection, "calendarId") ?? "", providerEventId, eventKey: recordText(claimed, "eventKey") ?? "", visitorName, visitorNote: recordText(appointment, "visitorNote"), startAt, endAt, timezone, signal: input.signal, createUncertain, onCreateIntent: () => persistCreateUncertainty(true), assertLease: () => transitionAppointmentCalendarEvent(payload, claimed, {}) })
        const latest = await loadAppointment(payload, appointment.id)
        if (!latest || eventVersionOf(latest) !== claimedVersion || recordText(latest, "status") !== "confirmed") {
          await queueLatestCalendarEvent(payload, claimed, latest, now, external.id)
          skipped += 1
          continue
        }
        await transitionAppointmentCalendarEvent(payload, claimed, { eventVersion: claimedVersion, status: "synced", operation: "upsert", providerEventId: external.id, providerCreateUncertain: false, leaseUntil: null, nextAttemptAt: now.toISOString(), syncedAt: now.toISOString(), lastError: null })
      }
      await markConnection(payload, connection, { lastSyncedAt: now.toISOString(), lastError: null, ...(recordText(connection, "status") === "reauth_required" ? { status: "connected" } : {}) })
      await clearRevokedConnectionIfIdle(payload, connection)
      synced += 1
    } catch (error) {
      if (error instanceof AppointmentAtomicClaimError) { skipped += 1; continue }
      const attemptCount = recordNumber(claimed, "attemptCount")
      const authError = error instanceof AppointmentCalendarAuthError
      const retryable = !authError && (error instanceof AppointmentCalendarError ? error.statusCode === 503 : true) && attemptCount < CALENDAR_MAX_ATTEMPTS
      const message = redactOperationalMessage(error)
      try {
        await transitionAppointmentCalendarEvent(payload, claimed, { eventVersion: claimedVersion, status: "failed", leaseUntil: null, nextAttemptAt: retryable ? calendarRetryAt(now, attemptCount) : PERMANENT_RETRY_AT, lastError: message })
      } catch (transitionError) {
        if (transitionError instanceof AppointmentAtomicClaimError) { skipped += 1; continue }
        throw transitionError
      }
      failed += 1
    }
  }
  return { examined: result.docs.length, synced, failed, skipped }
}

export async function disconnectCalendarConnection(input: { payload: CalendarReadWritePayload; tenantId: number | string; provider: AppointmentCalendarProvider; now?: Date }): Promise<void> {
  const payload = input.payload
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
