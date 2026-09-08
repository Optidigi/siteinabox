import { NextResponse, type NextRequest } from "next/server"
import { getPayload } from "payload"
import type { User } from "@/payload-types"
import { encodeSiteEditorSse, runExistingSiteTurn, streamExistingSiteTurn } from "@/lib/agent/siteEditorAgent"
import { loadTenantBySlug } from "@/lib/agent/tools"
import { canUseMastraSiteEditor } from "@/lib/builder/extractWithMastra"
import { heuristicExtractBuilderFacts } from "@/lib/builder/facts"
import { BuilderChatMessageSchema } from "@/lib/builder/thread"
import { relationshipId, relationshipIdSet, type RelationshipIdRef } from "@/lib/relationshipId"
import config from "@/payload.config"

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value)

const userTenantIds = (user: User): Set<string> =>
  relationshipIdSet(
    (user?.tenants ?? []).map((membership: { tenant?: RelationshipIdRef }) => membership.tenant),
  )

const canUseCmsAgent = (user: User | null | undefined, tenantId: string | number | null): boolean => {
  if (user?.role === "super-admin") return tenantId != null
  if (tenantId == null) return false
  if (user?.role !== "owner" && user?.role !== "editor") return false
  const targetTenantId = relationshipId(tenantId)
  return targetTenantId != null && userTenantIds(user).has(targetTenantId)
}

export async function POST(req: NextRequest) {
  const payload = await getPayload({ config })
  const auth = await payload.auth({ headers: req.headers }).catch(() => ({ user: null }))

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ message: "Invalid JSON body" }, { status: 400 })
  }
  if (!isRecord(body) || typeof body.message !== "string") {
    return NextResponse.json({ message: "JSON object body required" }, { status: 400 })
  }

  const tenantSlug = typeof body.tenantSlug === "string" ? body.tenantSlug.trim() : ""
  if (!tenantSlug) {
    return NextResponse.json({ message: "tenantSlug is required" }, { status: 400 })
  }

  const tenant = await loadTenantBySlug(payload, tenantSlug)
  const user = auth.user
  if (!user || !tenant || !canUseCmsAgent(user, tenant.id)) {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 })
  }

  const history = Array.isArray(body.history)
    ? body.history.flatMap((item) => {
        const parsed = BuilderChatMessageSchema.safeParse(item)
        return parsed.success ? [parsed.data] : []
      }).slice(-8)
    : []
  const heuristic = heuristicExtractBuilderFacts(body.message, null)
  const turnInput = {
    ctx: { payload, tenantId: tenant.id, user },
    message: body.message.trim(),
    pageSlug: typeof body.pageSlug === "string" ? body.pageSlug : "index",
    selectedBlockIndex: typeof body.selectedBlockIndex === "number" ? body.selectedBlockIndex : null,
    role: user.role,
    recentMessages: history,
    allowRegenerate: false,
    facts: heuristic,
    useMastra: canUseMastraSiteEditor(),
  } as const

  const wantsStream = req.headers.get("accept")?.includes("text/event-stream")
  if (wantsStream) {
    const encoder = new TextEncoder()
    const stream = new ReadableStream({
      async start(controller) {
        try {
          for await (const event of streamExistingSiteTurn(turnInput)) {
            controller.enqueue(encoder.encode(encodeSiteEditorSse(event)))
          }
        } catch {
          controller.enqueue(encoder.encode(encodeSiteEditorSse({
            type: "error",
            message: "De agent kon dit nu niet toepassen.",
          })))
        } finally {
          controller.close()
        }
      },
    })
    return new Response(stream, {
      headers: {
        "content-type": "text/event-stream; charset=utf-8",
        "cache-control": "no-cache",
      },
    })
  }

  const result = await runExistingSiteTurn(turnInput)
  return NextResponse.json({
    ok: true,
    text: result.text,
    applied: result.applied,
    snapshot: result.snapshot,
  })
}
