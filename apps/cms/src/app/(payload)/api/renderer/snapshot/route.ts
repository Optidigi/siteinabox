import { NextResponse, type NextRequest } from "next/server"
import { getPayload } from "payload"
import config from "@/payload.config"
import { normalizeRequestHost, resolvePublishedSnapshotByHost } from "@/lib/publish/siteSnapshots"

function isAuthorized(req: NextRequest): boolean {
  const expected = process.env.SIAB_RENDERER_API_TOKEN
  if (!expected) return process.env.NODE_ENV !== "production"
  const header = req.headers.get("authorization") ?? ""
  return header === `Bearer ${expected}`
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
  }

  const url = new URL(req.url)
  const host = normalizeRequestHost(url.searchParams.get("host") ?? req.headers.get("x-forwarded-host") ?? req.headers.get("host"))
  if (!host) {
    return NextResponse.json({ message: "host is required" }, { status: 400 })
  }

  const payload = await getPayload({ config })
  let resolved
  try {
    resolved = await resolvePublishedSnapshotByHost(payload, host)
  } catch (err) {
    const message = err instanceof Error ? err.message : "Published snapshot failed validation"
    return NextResponse.json({ message }, { status: 422 })
  }
  if (!resolved) {
    return NextResponse.json({ message: "No active published snapshot for host" }, { status: 404 })
  }

  return NextResponse.json({
    tenant: resolved.tenant,
    snapshotId: resolved.snapshotId,
    snapshot: resolved.snapshot,
  })
}
