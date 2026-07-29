import { NextResponse, type NextRequest } from "next/server"
import { getPayload } from "payload"

import config from "@/payload.config"
import { exportDomainDnsPortability } from "@/lib/domains/offboarding"
import { relationshipId } from "@/lib/relationshipId"

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ managedDomainId: string }> },
): Promise<Response> {
  const payload = await getPayload({ config })
  const { user } = await payload.auth({ headers: request.headers })
  if (!user) return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
  if (user.role !== "owner") {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 })
  }
  const tenantId = relationshipId(user.tenants?.[0]?.tenant)
  if (!tenantId) {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 })
  }
  const { managedDomainId } = await context.params
  try {
    const dnsExport = await exportDomainDnsPortability(payload, {
      managedDomainId,
      actor: { email: user.email, tenantId },
    })
    return new NextResponse(`${JSON.stringify(dnsExport, null, 2)}\n`, {
      status: 200,
      headers: {
        "cache-control": "no-store",
        "content-disposition":
          `attachment; filename="${dnsExport.domain}-dns-export.json"`,
        "content-type": "application/json; charset=utf-8",
        "x-content-type-options": "nosniff",
      },
    })
  } catch {
    return NextResponse.json({ message: "DNS export unavailable" }, { status: 409 })
  }
}
