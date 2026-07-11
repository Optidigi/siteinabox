"use server"

import { headers } from "next/headers"
import { redirect } from "next/navigation"
import { revalidatePath } from "next/cache"
import { getPayload } from "payload"
import config from "@/payload.config"
import { getSiabContext } from "@/lib/context"
import { relationshipId } from "@/lib/relationshipId"
import { acceptCustomerLegalRequirement } from "@/lib/legal/customerRequirements"

export async function acceptLegalRequirementAction(formData: FormData) {
  const requestHeaders = await headers()
  const payload = await getPayload({ config })
  const { user } = await payload.auth({ headers: requestHeaders })
  const ctx = await getSiabContext()
  if (!user || user.role !== "owner" || ctx.mode !== "tenant") redirect("/login")

  const tenantId = relationshipId(user.tenants?.[0]?.tenant)
  if (!tenantId || tenantId !== String(ctx.tenant.id)) redirect("/?error=forbidden")
  const requirementId = String(formData.get("requirementId") ?? "").trim()
  if (!requirementId || formData.get("acceptance") !== "accepted") {
    redirect("/settings?legal=acceptance-required")
  }

  try {
    await acceptCustomerLegalRequirement({
      payload,
      requirementId,
      tenantId,
      actorUserId: user.id,
      actorEmail: user.email,
      requestId: requestHeaders.get("x-request-id"),
      ipAddress: requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim(),
      userAgent: requestHeaders.get("user-agent"),
    })
  } catch (error) {
    console.error("Legal requirement acceptance failed", error)
    redirect("/settings?legal=failed")
  }

  revalidatePath("/", "layout")
  redirect("/settings?legal=accepted")
}
