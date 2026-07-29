import { getPayload } from "payload"
import config from "@/payload.config"
import { commerceEdgeInventoryBlockers } from "@/lib/commerce/releaseGateCore"

const payload = await getPayload({ config })
const blockers = await commerceEdgeInventoryBlockers(payload)

if (blockers.length > 0) {
  payload.logger.error(
    `Commerce edge inventory preflight failed: ${blockers.join(", ")}`,
  )
  process.exitCode = 1
} else {
  payload.logger.info("Commerce edge inventory preflight passed.")
}

await payload.destroy()
