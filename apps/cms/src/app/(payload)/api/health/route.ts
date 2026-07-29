import { promises as fs } from "node:fs"
import path from "node:path"
import { NextResponse } from "next/server"
import { getPayload } from "payload"
import config from "@/payload.config"

/**
 * Liveness probe. Returns 200 when:
 *   - Postgres reachable (Payload boot succeeds)
 *   - DATA_DIR exists and is writable
 * Anything else returns 503 with a status object the operator can read.
 *
 * Lives inside the (payload) route group so it doesn't collide with
 * (payload)/api/[...slug] from a different group. Static "health" beats
 * the catch-all in the same group.
 */
export async function GET() {
  const dataDirPath = path.resolve(process.cwd(), process.env.DATA_DIR || "./.data-out")

  let dbOk = false
  try {
    const payload = await getPayload({ config })
    // Cheap query: count tenants. Boots Payload + verifies DB round-trip.
    await payload.count({ collection: "tenants", overrideAccess: true })
    dbOk = true
  } catch {
    // dbOk stays false
  }

  let dirOk = false
  try {
    await fs.access(dataDirPath)
    const probe = path.join(dataDirPath, ".healthcheck")
    await fs.writeFile(probe, "ok")
    await fs.rm(probe)
    dirOk = true
  } catch {
    // dirOk stays false
  }

  const ok = dbOk && dirOk
  return NextResponse.json(
    {
      status: ok ? "ok" : "degraded",
      db: dbOk ? "connected" : "down",
      dataDir: dirOk ? "writable" : "unwritable"
    },
    {
      status: ok ? 200 : 503,
      headers: { "x-siab-service": "cms" },
    }
  )
}
