"use server"

import { headers } from "next/headers"
import { getPayload } from "payload"
import config from "@/payload.config"
import { publishCurrentTenantState } from "@/lib/publish/currentState"

export async function publishCurrentTenantStateAction(
  tenantId: string | number,
  reason?: string | null,
): Promise<void> {
  const payload = await getPayload({ config })
  const { user } = await payload.auth({ headers: await headers() })
  if (!user) throw new Error("Forbidden: authentication required")
  await publishCurrentTenantState(payload, {
    tenantId,
    user,
    reason,
  })
}
