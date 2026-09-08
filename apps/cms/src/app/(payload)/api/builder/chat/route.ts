import { NextResponse, type NextRequest } from "next/server"
import { getPayload } from "payload"
import { hasUnvalidatedAuthSignal } from "@/access/authSignals"
import { runBuilderTurn } from "@/lib/builder/runBuilderTurn"
import { loadBuilderThread, saveBuilderThread } from "@/lib/builder/sessionStore"
import { legalIsAccepted, builderPreviewActions, type BuilderChatMessage } from "@/lib/builder/thread"
import { previewAuth } from "@/lib/preview/betterAuth"
import { loadLatestActivePreviewGrant } from "@/lib/preview/previewAccess"
import { relationshipValue } from "@/lib/relationshipId"
import { isPreviewRequestAuthority } from "@/lib/requestAuthority"
import config from "@/payload.config"

const MAX_BUILDER_BYTES = 64 * 1024

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value)

export async function POST(req: NextRequest) {
  if (!isPreviewRequestAuthority(req.headers)) {
    return NextResponse.json({ message: "Not found" }, { status: 404 })
  }

  const session = await previewAuth.api.getSession({
    headers: req.headers,
    query: { disableCookieCache: true },
  })
  const sessionEmail = session?.user?.email?.trim().toLowerCase()
  if (!sessionEmail) {
    if (hasUnvalidatedAuthSignal(req)) {
      return NextResponse.json({ message: "Forbidden" }, { status: 403 })
    }
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
  }

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
  if (!isRecord(body) || typeof body.message !== "string") {
    return NextResponse.json({ message: "JSON object body required" }, { status: 400 })
  }

  const payload = await getPayload({ config })
  const thread = await loadBuilderThread(payload, sessionEmail)
  if (!thread || !legalIsAccepted(thread.legal)) {
    return NextResponse.json({ message: "Registreer eerst met naam en voorwaarden." }, { status: 403 })
  }

  const grant = await loadLatestActivePreviewGrant(sessionEmail, payload)
  if (thread.clientSlug && !grant) {
    return NextResponse.json({ message: "Preview toegang is ingetrokken." }, { status: 403 })
  }

  const existingClientSlug = grant?.clientSlug ?? null
  const existingTenantId = relationshipValue(grant?.tenant)

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
  })

  const messages: BuilderChatMessage[] = [
    ...thread.messages,
    { role: "user", text: userMessage },
    { role: "assistant", text: result.text, choices: result.choices, actions: builderPreviewActions(result.applied, result.clientSlug) },
  ]
  const saved = await saveBuilderThread(payload, {
    ...thread,
    facts: result.facts ?? thread.facts,
    clientSlug: result.clientSlug ?? thread.clientSlug,
    messages,
  })

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
