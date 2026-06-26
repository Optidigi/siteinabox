import { NextResponse, type NextRequest } from "next/server"
import { getPayload } from "payload"
import config from "@/payload.config"
import { activatePublishedSnapshot, publishSiteSnapshot } from "@/lib/publish/siteSnapshots"

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value)

const asId = (value: unknown): string | number | null =>
  typeof value === "string" || typeof value === "number" ? value : null

export async function POST(req: NextRequest) {
  const payload = await getPayload({ config })
  let auth: Awaited<ReturnType<typeof payload.auth>> | null = null
  try {
    auth = await payload.auth({ headers: req.headers })
  } catch {
    auth = null
  }
  if (auth?.user?.role !== "super-admin") {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ message: "Invalid JSON body" }, { status: 400 })
  }
  if (!isRecord(body)) {
    return NextResponse.json({ message: "JSON object body required" }, { status: 400 })
  }

  try {
    if (body.action === "rollback") {
      const snapshotId = asId(body.snapshotId)
      if (snapshotId == null) return NextResponse.json({ message: "snapshotId is required" }, { status: 400 })
      const snapshot = await activatePublishedSnapshot(payload, {
        snapshotId,
        manualActivation: body.manualActivation === true,
        activatedBy: auth.user.id,
        activationReason: typeof body.reason === "string" ? body.reason : "manual rollback",
        rollback: true,
      })
      return NextResponse.json({ ok: true, activated: true, snapshotId: snapshot.id })
    }

    const tenantId = asId(body.tenantId)
    if (tenantId == null) return NextResponse.json({ message: "tenantId is required" }, { status: 400 })

    const result = await publishSiteSnapshot(payload, {
      tenantId,
      generationRunId: asId(body.generationRunId),
      activate: body.activate === true,
      manualActivation: body.manualActivation === true,
      publishedBy: auth.user.id,
      activationReason: typeof body.reason === "string" ? body.reason : null,
    })

    return NextResponse.json({
      ok: true,
      activated: result.activated,
      snapshotId: result.snapshot.id,
      status: result.snapshot.status,
      version: result.snapshot.version,
      domain: result.snapshot.domain,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Publish failed"
    return NextResponse.json({ ok: false, message }, { status: 422 })
  }
}
