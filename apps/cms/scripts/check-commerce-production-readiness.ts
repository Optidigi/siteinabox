import { getPayload } from "payload"
import config from "@/payload.config"
import { commerceProductionReadinessBlockers } from "@/lib/commerce/releaseGateCore"

const payload = await getPayload({ config })
const blockers = await commerceProductionReadinessBlockers(payload)

if (blockers.length > 0) {
  payload.logger.error(
    `Commerce production readiness failed: ${blockers.join(", ")}`,
  )
  process.exitCode = 1
} else {
  payload.logger.info("Commerce production readiness passed.")
}

await payload.destroy()
