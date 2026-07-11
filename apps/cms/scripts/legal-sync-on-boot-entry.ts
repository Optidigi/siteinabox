import { getPayload } from "payload"
import config from "@/payload.config"
import { syncLegalDocuments } from "@/lib/legal/legalDocuments"

process.env.PAYLOAD_DISABLE_ADMIN = "true"

try {
  const payload = await getPayload({ config })
  const result = await syncLegalDocuments({
    payload,
    sourceCommit: process.env.SIAB_GIT_SHA,
    manifestUrl: process.env.SIAB_LEGAL_MANIFEST_URL || null,
  })
  console.log(`[legal-sync-on-boot] synchronized ${result.synchronized} immutable release(s)`)
  await payload.db.destroy?.()
  process.exit(0)
} catch (error) {
  console.error("[legal-sync-on-boot] FAILED:", error)
  process.exit(1)
}
