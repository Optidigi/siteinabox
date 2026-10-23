"use server"
import { headers } from "next/headers"
import { redirect } from "next/navigation"
import { getPayload } from "payload"
import config from "@/payload.config"
import { getSiabContext } from "@/lib/context"
import { reviewProductLegalRelease, activateProductLegalRelease } from "@/lib/legal/productLegal"

async function legalOperator() {
  const payload = await getPayload({ config })
  const { user } = await payload.auth({ headers: await headers() })
  const ctx = await getSiabContext()
  if (!user || user.role !== "super-admin" || ctx.mode !== "super-admin") throw new Error("Platform legal operator authentication is required")
  return { payload, user }
}

export async function reviewProductPolicyAction(form: FormData) {
  const { payload, user } = await legalOperator()
  const key = String(form.get("releaseKey") ?? "")
  const audience = String(form.get("audienceTenantIds") ?? "").split(",").filter(Boolean).map(Number)
  await reviewProductLegalRelease({ payload, actor: user, releaseKey: key, approvalRef: String(form.get("ownerReviewRef") ?? ""),
    publishedAt: String(form.get("publishedAt") ?? ""), effectiveAt: String(form.get("effectiveAt") ?? ""),
    audienceTenantIds: audience, sourceCommit: process.env.SIAB_GIT_SHA ?? "" })
  redirect(`/legal/product-drafts/${encodeURIComponent(key)}?state=reviewed`)
}

export async function activateProductPolicyAction(form: FormData) {
  const { payload, user } = await legalOperator()
  const key = String(form.get("releaseKey") ?? "")
  await activateProductLegalRelease({ payload, actor: user, releaseKey: key,
    expectedBundleHash: String(form.get("bundleHash") ?? ""), authorizationRef: String(form.get("publicationAuthorizationRef") ?? "") })
  const { syncProductLegalRequirements } = await import("@/lib/legal/productRequirements")
  await syncProductLegalRequirements(payload)
  redirect(`/legal/product-drafts/${encodeURIComponent(key)}?state=active`)
}
