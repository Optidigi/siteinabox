import { CustomerProjectionError } from "@/lib/projection/customerTransaction"
import { NextResponse, type NextRequest } from "next/server"
import { hasUnvalidatedAuthSignal } from "@/access/authSignals"
import { runBuilderTurn } from "@/lib/builder/runBuilderTurn"
import { loadBuilderThread, saveBuilderThread } from "@/lib/builder/sessionStore"
import { legalIsAccepted, builderPreviewActions, type BuilderChatMessage } from "@/lib/builder/thread"
import { getVerifiedPreviewCustomer } from "@/lib/auth/verifiedPreviewSession"
import { CustomerIdentityError } from "@/lib/auth/verifiedCustomer"
import { assertCustomerAccess } from "@/lib/auth/customerWorkspace"
import { loadVerifiedCustomerGrant } from "@/lib/preview/previewAccess"
import { isPreviewRequestAuthority } from "@/lib/requestAuthority"

const MAX_BUILDER_BYTES = 64 * 1024

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value)

export async function POST(req: NextRequest) {
  if (!isPreviewRequestAuthority(req.headers)) {
    return NextResponse.json({ message: "Not found" }, { status: 404 })
  }
  try {
    return await authenticatedBuilderTurn(req)
  } catch (error) {
    if (error instanceof CustomerProjectionError) return NextResponse.json(
      { message: error.message, error: error.code, committed: true }, { status: 503 })
    if (!(error instanceof CustomerIdentityError)) throw error
    return NextResponse.json({ message: "Verified workspace access is required.", error: error.code }, { status: 403 })
  }
}

async function authenticatedBuilderTurn(req: NextRequest) {
  const customer = await getVerifiedPreviewCustomer(req.headers)
  if (customer) await assertCustomerAccess(customer.payload, customer.authority, { intent: "write" })
  if (!customer) {
    if (hasUnvalidatedAuthSignal(req)) {
      return NextResponse.json({ message: "Forbidden" }, { status: 403 })
    }
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
  }
  const { payload, authority } = customer
  const sessionEmail = customer.account.email

  const contentLength = Number(req.headers.get("content-length") ?? 0)
  if (Number.isFinite(contentLength) && contentLength > MAX_BUILDER_BYTES) {
    return NextResponse.json({ message: "Builder payload too large" }, { status: 413 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ message: "Invalid JSON body" }, { status: 400 })
  }
  if (!isRecord(body) || typeof body.message !== "string" || Object.keys(body).some(key => key !== "message")) {
    return NextResponse.json({ message: "JSON object body required" }, { status: 400 })
  }

  const thread = await loadBuilderThread(payload, sessionEmail, customer.account.id)
  if (!thread || !legalIsAccepted(thread.legal)) {
    return NextResponse.json({ message: "Registreer eerst met naam en voorwaarden." }, { status: 403 })
  }

  const preview = await loadVerifiedCustomerGrant({ email: sessionEmail, payload, authority })
  if (thread.clientSlug && !preview) {
    return NextResponse.json({ message: "Preview toegang is ingetrokken." }, { status: 403 })
  }

  const existingClientSlug = preview?.clientSlug ?? null
  const existingTenantId = preview?.tenant.id ?? null
  if (existingTenantId != null) await assertCustomerAccess(payload, authority, { intent: "write", tenantId: existingTenantId })

  const userMessage = body.message.trim()
  const result = await runBuilderTurn(payload, {
    message: userMessage,
    contactName: thread.displayName,
    contactEmail: thread.customerEmail,
    contactPhone: thread.contactPhone,
    legal: thread.legal,
    previousFacts: thread.facts,
    recentMessages: thread.messages.slice(-8),
    existingClientSlug,
    existingTenantId,
    customerAuthority: authority,
  })

  const messages: BuilderChatMessage[] = [
    ...thread.messages,
    { role: "user", text: userMessage },
    { role: "assistant", text: result.text, choices: result.choices, actions: builderPreviewActions(result.applied, result.clientSlug) },
  ]
  await assertCustomerAccess(payload, authority, { intent: "write", tenantId: existingTenantId ?? undefined })
  const saved = await saveBuilderThread(payload, {
    ...thread,
    facts: result.facts ?? thread.facts,
    clientSlug: result.clientSlug ?? thread.clientSlug,
    messages,
  }, customer.account.id)

  return NextResponse.json(
    {
      ok: result.ok,
      text: result.text,
      facts: saved.facts,
      clientSlug: saved.clientSlug,
      messages: saved.messages,
      status: result.status,
      error: result.error,
      choices: result.choices,
      applied: result.applied,
      previewSnapshot: result.previewSnapshot,
    },
    { status: result.ok ? 200 : result.error === "legal_required" ? 400 : 422 },
  )
}
