import "server-only"
import type { GenericEndpointContext } from "better-auth"
import { APIError, createAuthMiddleware } from "better-auth/api"
import { sql } from "@payloadcms/db-postgres"
import { asRecord, queryRows } from "@/lib/record"
import { accountLinkDeliveryFailure } from "./accountLinkDelivery"
import { AccountLinkError, type AccountLinkTarget } from "./accountLinkTypes"
import { admitAccountLink, accountLinkFingerprint, bindAccountLinkToken, beginAccountLinkDelivery,
  finishAccountLinkDelivery, type AccountLinkLease } from "./accountLinkStore"
import { authorizeSdkAccountLink, assertAccountLinkTargetCurrent } from "./accountLinkAuthorization"
import { CustomerIdentityError } from "./verifiedCustomer"
import { accountLinkLocale, type AccountLinkLocale } from "./accountLinkLocale"

async function getPayload() {
  const [{ getPayload }, { default: config }] = await Promise.all([import("payload"), import("@/payload.config")])
  return getPayload({ config })
}

function localPath(value: unknown, origin: string, fallback: string): string {
  const url = new URL(typeof value === "string" && value ? value : fallback, origin)
  if (url.origin !== origin || url.username || url.password || url.hash) throw new AccountLinkError("E_ACCOUNT_LINK_CALLBACK")
  return url.pathname + url.search
}

type Invocation = { lease: AccountLinkLease; target: AccountLinkTarget }

export function sdkAccountLinks(namespace: "cms" | "preview") {
  // Private per-request memory carries authority, never request metadata. The
  // durable lease remains the arbiter across processes and restarts.
  const invocations = new WeakMap<object, Invocation>()
  const before = createAuthMiddleware(async ctx => {
    if (ctx.path !== "/sign-in/magic-link" && ctx.path !== "/magic-link/verify") return
    const payload = await getPayload()
    // First-use cutover bounds pre-upgrade compatibility to the existing 300s
    // token lifetime. New issuance always passes through this activation first.
    const policy = queryRows<{ activated_at: Date | string }>(await payload.db.drizzle.execute(sql`
      INSERT INTO account_link_policies (key,activated_at) VALUES (${namespace},clock_timestamp())
      ON CONFLICT (key) DO UPDATE SET key=excluded.key RETURNING activated_at`))[0]!
    const origin = new URL(ctx.context.baseURL).origin
    if (ctx.path === "/sign-in/magic-link") {
      const metadata = asRecord(asRecord(ctx.body)?.metadata)
      const privilegedAttempt = namespace === "cms" ? ["user_invite", "site_live_handoff"].includes(String(metadata?.intent))
        : metadata?.previewSiteReady === true
      try {
        const body = asRecord(ctx.body)
        if (typeof body?.email !== "string") throw new AccountLinkError("E_ACCOUNT_LINK_TARGET")
        const callbackPath = localPath(body.callbackURL, origin, "/")
        const errorCallbackPath = localPath(body.errorCallbackURL, origin, callbackPath)
        if (localPath(body.newUserCallbackURL, origin, callbackPath) !== callbackPath) throw new AccountLinkError("E_ACCOUNT_LINK_CALLBACK")
        const target = await authorizeSdkAccountLink(payload, namespace, { email: body.email, origin,
          callbackPath, errorCallbackPath, metadata: body.metadata })
        const admission = await admitAccountLink(payload, target)
        if (admission.kind !== "claimed") {
          if (target.purpose === "invitation" || target.purpose === "site_handoff") {
            const previous = admission.kind === "coalesced" ? await payload.findByID({
              collection: "account-link-dispatches", id: admission.id, overrideAccess: true }) : null
            if (previous?.state !== "sent") throw new APIError("SERVICE_UNAVAILABLE", { message: "Account-link delivery is not confirmed." })
          }
          return ctx.json({ status: true })
        }
        invocations.set(ctx.context, { lease: admission.lease, target })
      } catch (error) {
        if (privilegedAttempt) throw new APIError("SERVICE_UNAVAILABLE", { message: "Account-link delivery is not confirmed." })
        if (error instanceof APIError && error.statusCode === 503) throw error
        if (error instanceof AccountLinkError || error instanceof APIError || error instanceof CustomerIdentityError) return ctx.json({ status: true })
        throw new APIError("SERVICE_UNAVAILABLE", { message: "Account link temporarily unavailable." })
      }
      return
    }
    try {
      const query = asRecord(ctx.query)
      if (typeof query?.token !== "string") throw new AccountLinkError("E_ACCOUNT_LINK_TOKEN")
      const tokenFingerprint = accountLinkFingerprint(namespace, query.token)
      const receipt = (await payload.find({ collection: "account-link-dispatches", overrideAccess: true,
        where: { tokenFingerprint: { equals: tokenFingerprint } }, limit: 1, depth: 0 })).docs[0]
      const identifier = `magic-link:${query.token}`
      const verification = await ctx.context.internalAdapter.findVerificationValue(identifier)
      const tokenRows = queryRows<{ count: number | string }>(await payload.db.drizzle.execute(sql`
        SELECT count(*) AS count FROM ${sql.identifier(namespace === "cms" ? "better_auth_verifications" : "preview_auth_verifications")}
        WHERE identifier=${identifier}`))[0]
      if (!verification || Number(tokenRows?.count) !== 1) throw new AccountLinkError("E_ACCOUNT_LINK_TOKEN")
      const tokenRecord = asRecord(JSON.parse(verification.value))
      if (tokenRecord?.type !== "magic-link" || typeof tokenRecord.email !== "string") throw new AccountLinkError("E_ACCOUNT_LINK_TOKEN")
      if (!receipt) {
        const legacy = verification
        const activation = new Date(policy.activated_at).getTime()
        if (!legacy || legacy.createdAt.getTime() > activation || legacy.expiresAt.getTime() > activation + 300_000 ||
          legacy.expiresAt.getTime() <= Date.now()) throw new AccountLinkError("E_ACCOUNT_LINK_TOKEN")
        const record = asRecord(JSON.parse(legacy.value))
        if (typeof record?.email !== "string" || record.type !== "magic-link") throw new AccountLinkError("E_ACCOUNT_LINK_TOKEN")
        await authorizeSdkAccountLink(payload, namespace, { email: record.email, origin,
          callbackPath: localPath(query.callbackURL, origin, "/"),
          errorCallbackPath: localPath(query.errorCallbackURL, origin, "/"), metadata: undefined })
        return
      }
      if (verification.id !== receipt.verificationId || tokenRecord.email.trim().toLowerCase() !== receipt.recipient ||
        verification.expiresAt.toISOString() !== receipt.expiresAt) throw new AccountLinkError("E_ACCOUNT_LINK_TOKEN")
      if (receipt.namespace !== namespace || receipt.origin !== origin ||
        localPath(query.callbackURL, origin, "/") !== receipt.callbackPath ||
        localPath(query.errorCallbackURL, origin, receipt.callbackPath) !== receipt.errorCallbackPath ||
        localPath(query.newUserCallbackURL, origin, receipt.callbackPath) !== receipt.callbackPath) throw new AccountLinkError("E_ACCOUNT_LINK_CALLBACK")
      const target: AccountLinkTarget = { ...receipt, payloadUserId: receipt.payloadUserId ?? undefined,
        previewUserId: receipt.previewUserId ?? undefined, tenantId: receipt.tenantId ?? undefined,
        role: receipt.role ?? undefined, actorUserId: receipt.actorUserId ?? undefined, metadata: asRecord(receipt.metadata) ?? undefined }
      await assertAccountLinkTargetCurrent(payload, target)
      const rows = queryRows(await payload.db.drizzle.execute(sql`
        UPDATE account_link_dispatches SET state='consumed', active_key=NULL, updated_at=clock_timestamp()
        WHERE id=${receipt.id} AND state IN ('sent','indeterminate','dispatching') AND expires_at>clock_timestamp() RETURNING id`))
      if (rows.length !== 1) throw new AccountLinkError("E_ACCOUNT_LINK_TOKEN")
    } catch {
      throw new APIError("UNAUTHORIZED", { message: "This link is unavailable. Request a new link after it expires." })
    }
  })

  async function deliver(input: { email: string; token: string; url: string }, context: GenericEndpointContext | undefined,
    send: (locale: AccountLinkLocale) => Promise<unknown>) {
    const invocation = context && invocations.get(context.context)
    if (!invocation || invocation.target.recipient !== input.email.trim().toLowerCase()) throw new AccountLinkError("E_ACCOUNT_LINK_AUTHORITY")
    const payload = await getPayload()
    const row = await context!.context.internalAdapter.findVerificationValue(`magic-link:${input.token}`)
    if (!row) throw new AccountLinkError("E_ACCOUNT_LINK_TOKEN")
    await bindAccountLinkToken(payload, invocation.lease, { namespace, token: input.token, verificationId: row.id, expiresAt: row.expiresAt })
    await assertAccountLinkTargetCurrent(payload, invocation.target)
    await beginAccountLinkDelivery(payload, invocation.lease)
    try {
      await send(accountLinkLocale(context?.headers))
      await finishAccountLinkDelivery(payload, invocation.lease, { state: "sent" })
    } catch (error) {
      await finishAccountLinkDelivery(payload, invocation.lease, accountLinkDeliveryFailure(error))
      if (invocation.target.purpose === "invitation" || invocation.target.purpose === "site_handoff") {
        throw new APIError("SERVICE_UNAVAILABLE", { message: "Account-link delivery is not confirmed." })
      }
      // The response does not reveal recipient eligibility or transport status.
    } finally { invocations.delete(context!.context) }
  }
  return { before, deliver }
}
