"use server"
import { headers } from "next/headers"
import { getPayload } from "payload"
import config from "@/payload.config"
import {
  fetchSiteManifestFromRepo,
  type SiteRepoManifestResult,
} from "@/lib/github/siteRepoManifest"

export const fetchTenantManifestFromRepo = async (
  tenantId: number | string,
): Promise<SiteRepoManifestResult> => {
  const payload = await getPayload({ config })
  const { user } = await payload.auth({ headers: await headers() })
  if (!user) throw new Error("Forbidden: authentication required")
  if (user.role !== "super-admin") {
    throw new Error("Forbidden: only super-admin may sync tenant manifests")
  }

  const tenant = await payload.findByID({
    collection: "tenants",
    id: tenantId,
    depth: 0,
    user,
    overrideAccess: false,
  })
  const siteRepo = typeof tenant.siteRepo === "string" ? tenant.siteRepo.trim() : ""
  if (!siteRepo) return { ok: false, error: "Tenant has no siteRepo configured" }

  return fetchSiteManifestFromRepo(siteRepo, {
    token: process.env.GITHUB_TOKEN || process.env.GH_TOKEN,
  })
}
