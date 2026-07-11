import { getPayload } from "payload"
import config from "@/payload.config"
import { syncLegalDocuments } from "@/lib/legal/legalDocuments"

const payload = await getPayload({ config })
const result = await syncLegalDocuments({
  payload,
  sourceCommit: process.env.SIAB_GIT_SHA,
  manifestUrl: process.env.SIAB_LEGAL_MANIFEST_URL ?? "https://www.siteinabox.nl/.well-known/siab-legal-manifest.json",
})

payload.logger.info(`[legal] synchronized ${result.synchronized} immutable document releases`)
process.exit(0)

