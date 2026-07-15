import { NextResponse, type NextRequest } from "next/server"
import { getPayload } from "payload"
import config from "@/payload.config"
import { buildStatusInventory } from "@/lib/statusInventory"

function isAuthorized(req: NextRequest): boolean {
  const expected = process.env.STATUS_MONITOR_INVENTORY_TOKEN?.trim()
  if (!expected) return false
  return req.headers.get("authorization") === `Bearer ${expected}`
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
  }
  const payload = await getPayload({ config })
  const tenants = await payload.find({
    collection: "tenants",
    where: { status: { equals: "active" } },
    limit: 2_000,
    depth: 0,
    overrideAccess: true,
  })
  return NextResponse.json(buildStatusInventory(tenants.docs))
}
