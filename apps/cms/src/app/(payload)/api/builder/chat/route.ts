import { NextResponse, type NextRequest } from "next/server"
import { getPayload } from "payload"
import { hasUnvalidatedAuthSignal } from "@/access/authSignals"
import { runBuilderTurn } from "@/lib/builder/runBuilderTurn"
import { loadBuilderThread } from "@/lib/builder/sessionStore"
import { legalIsAccepted, builderPreviewActions, type BuilderChatMessage } from "@/lib/builder/thread"
import { readVerifiedPreviewSession } from "@/lib/auth/verifiedPreviewSession"
import { loadLatestActivePreviewGrant } from "@/lib/preview/previewAccess"
import { relationshipValue } from "@/lib/relationshipId"
import { isPreviewRequestAuthority } from "@/lib/requestAuthority"
import { assertBuilderAccountEligible } from "@/lib/builder/access"
import { assertCurrentPreviewSessionAuthority } from "@/lib/auth/previewSessionAuthority"
import { BuilderQuotaError, BuilderQuotaService, type BuilderOperationLease } from "@/lib/builder/quota"
import { ReservedBuilderExecution } from "@/lib/builder/quotaExecution"
import { BodyReadError } from "@/lib/http/body"
import { readBuilderJSON } from "@/lib/builder/quotaRequest"
import { builderOperationInputSchema, builderTerminalResultSchema } from "@/lib/builder/quotaSchemas"
import config from "@/payload.config"

const denialStatus = (reason: string) => reason === "operation_conflict" ? 409 : reason === "quota_exhausted" || reason === "technical_limit" ? 429 : reason === "busy" ? 409 : 503

export async function POST(req: NextRequest) {
  if (!isPreviewRequestAuthority(req.headers)) return NextResponse.json({ message: "Not found" }, { status: 404 })
  const session = await readVerifiedPreviewSession(req.headers)
  const email = session?.user?.email?.trim().toLowerCase()
  if (!email) return NextResponse.json({ message: hasUnvalidatedAuthSignal(req) ? "Forbidden" : "Unauthorized" }, { status: hasUnvalidatedAuthSignal(req) ? 403 : 401 })
  if (session?.user.emailVerified !== true) return NextResponse.json({ message: "Verified email required", error: "email_unverified" }, { status: 403 })
  const payload = await getPayload({ config }), service = new BuilderQuotaService(payload)
  try {
    if (!await service.consumeIngress(email)) return NextResponse.json({ error: "builder_request_limit" }, { status: 429 })
  } catch { return NextResponse.json({ error: "builder_request_busy" }, { status: 503 }) }
  let body: unknown
  try { body = await readBuilderJSON(req) }
  catch (error) { return NextResponse.json({ message: "Invalid builder body", error: error instanceof BodyReadError ? `builder_${error.code}` : "builder_invalid_json" }, { status: error instanceof BodyReadError && error.code === "payload_too_large" ? 413 : error instanceof BodyReadError && error.code === "body_timed_out" ? 408 : 400 }) }
  const parsed = builderOperationInputSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ message: "A UUID operationId and message of 2–4000 characters are required.", error: "builder_invalid_request" }, { status: 400 })
  const sessionSubject = { sessionId: session.session.id, email }
  const eligible = async (transactionReq?: Parameters<typeof assertBuilderAccountEligible>[2]) => {
    await assertCurrentPreviewSessionAuthority(payload, transactionReq, req.headers, sessionSubject)
    await assertBuilderAccountEligible(payload, email, transactionReq)
  }
  let lease: BuilderOperationLease | undefined, execution: ReservedBuilderExecution | undefined
  try {
    const registered = await loadBuilderThread(payload, email)
    if (!registered || !legalIsAccepted(registered.legal)) return NextResponse.json({ message: "Register with name and accepted terms first.", error: "legal_required" }, { status: 403 })
    const admission = await service.reserve(email, parsed.data, eligible)
    if (admission.status === "complete") return NextResponse.json({ ...admission.result, operationId: parsed.data.operationId, quota: admission.quota }, { status: admission.result.ok ? 200 : 422 })
    if (admission.status === "pending") return NextResponse.json({ error: "operation_pending", operationId: parsed.data.operationId, quota: admission.quota }, { status: 202 })
    if (admission.status === "denied") return NextResponse.json({ error: admission.reason, operationId: parsed.data.operationId, quota: admission.quota }, { status: denialStatus(admission.reason) })
    lease = admission.lease
    await service.claim(lease, eligible)
    execution = new ReservedBuilderExecution(service, lease, eligible, req.signal)
    await execution.assertActive()
    // Read after admission: a previous operation may have settled while this
    // request was authenticating, and its conversation must not be overwritten.
    const thread = await loadBuilderThread(payload, email)
    if (!thread || !legalIsAccepted(thread.legal)) throw new BuilderQuotaError("builder_session_invalid")
    const grant = await loadLatestActivePreviewGrant(email, payload)
    const result = await runBuilderTurn(payload, {
      message: parsed.data.message, locale: parsed.data.locale ?? "nl",
      contactName: thread.displayName, contactEmail: email, contactPhone: thread.contactPhone,
      legal: thread.legal, previousFacts: thread.facts, recentMessages: thread.messages.slice(-8),
      existingClientSlug: grant?.clientSlug ?? null, existingTenantId: relationshipValue(grant?.tenant),
    }, execution)
    const messages: BuilderChatMessage[] = [...thread.messages,
      { role: "user", text: parsed.data.message },
      { role: "assistant", text: result.text, choices: result.choices, actions: builderPreviewActions(result.applied, result.clientSlug) },
    ]
    const nextThread = { ...thread, facts: result.facts ?? thread.facts, clientSlug: result.clientSlug ?? thread.clientSlug, messages: messages.slice(-200) }
    const receipt = builderTerminalResultSchema.parse({ ...result, facts: nextThread.facts, clientSlug: nextThread.clientSlug, messages: nextThread.messages })
    await execution.assertActive()
    const quota = await service.settle(lease, eligible, { result: receipt, thread: nextThread })
    return NextResponse.json({ ...receipt, operationId: parsed.data.operationId, quota }, { status: result.ok ? 200 : result.error === "legal_required" ? 400 : 422 })
  } catch (error) {
    if (lease) await service.fail(lease, error instanceof BuilderQuotaError ? error.code : "builder_operation_failed", true).catch(() => undefined)
    const code = error instanceof Error ? error.message : "builder_operation_failed"
    return NextResponse.json({ error: code, operationId: parsed.data.operationId }, { status: code === "post_purchase_ai_disabled" || code === "builder_customer_cms_only" || code === "builder_checkout_frozen" || code.startsWith("builder_preview_") || code.startsWith("builder_authority_") ? 403 : 503 })
  } finally { execution?.dispose() }
}
