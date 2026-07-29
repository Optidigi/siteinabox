import { NextResponse, type NextRequest } from "next/server"
import { getPayload } from "payload"
import config from "@/payload.config"
import { resolveManagedDomainEdgeIdentity } from "@/lib/domains/edgeReadiness"

function isAuthorized(req: NextRequest): boolean {
  const expected = process.env.SIAB_RENDERER_API_TOKEN
  if (!expected) return process.env.NODE_ENV !== "production"
  return req.headers.get("authorization") === `Bearer ${expected}`
}

export async function HEAD(req: NextRequest) {
  if (!isAuthorized(req)) return new NextResponse(null, { status: 401 })
  const host = new URL(req.url).searchParams.get("host")
  const payload = await getPayload({ config })
  const identity = await resolveManagedDomainEdgeIdentity(payload, host, "renderer")
  if (!identity) return new NextResponse(null, { status: 404 })
  return new NextResponse(null, {
    status: 200,
    headers: {
      "cache-control": "no-store",
      "x-siab-domain": identity.domain,
    },
  })
}
