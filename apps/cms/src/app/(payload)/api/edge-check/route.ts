import { NextResponse, type NextRequest } from "next/server"
import { getPayload } from "payload"
import config from "@/payload.config"
import {
  canonicalEdgeRequestHost,
  resolveManagedDomainEdgeIdentity,
} from "@/lib/domains/edgeReadiness"

export async function HEAD(req: NextRequest) {
  const host = canonicalEdgeRequestHost(req.headers)
  if (!host) {
    return new NextResponse(null, {
      status: 404,
      headers: { "cache-control": "no-store" },
    })
  }
  const payload = await getPayload({ config })
  const identity = await resolveManagedDomainEdgeIdentity(
    payload,
    host,
    "cms",
  )
  if (!identity) {
    return new NextResponse(null, {
      status: 404,
      headers: { "cache-control": "no-store" },
    })
  }
  return new NextResponse(null, {
    status: 200,
    headers: {
      "cache-control": "no-store",
      "x-siab-service": "cms",
      "x-siab-domain": identity.domain,
    },
  })
}
