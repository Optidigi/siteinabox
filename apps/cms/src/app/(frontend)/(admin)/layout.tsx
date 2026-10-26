import { SidebarProvider, SidebarInset } from "@siteinabox/ui/components/sidebar"
import { AppSidebar } from "@/components/layout/AppSidebar"
import { SiteHeader } from "@/components/layout/SiteHeader"
import { requireAuth } from "@/lib/authGate"
import { NextIntlClientProvider } from "next-intl"
import { Suspense } from "react"
import { CmsUsageTracker } from "@/components/analytics/CmsUsageTracker"
import { resolveLocale } from "@/i18n/config"
import { loadMessages } from "@/i18n/messages"
import { getPayload } from "payload"
import config from "@/payload.config"
import { getTenantLegalRequirements } from "@/lib/legal/customerRequirements"
import { tenantAnalyticsDashboardVisible } from "@/lib/analytics/config"
import { LegalRequirementBanner } from "@/components/legal/LegalRequirementBanner"
import { CmsAgentSelectionProvider } from "@/components/layout/CmsAgentSelection"
import { listTenants } from "@/lib/queries/tenants"
import { hasWorkspaceService } from "@/lib/tenants/services"

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, ctx } = await requireAuth()
  const locale = resolveLocale(user.language)
  const messages = await loadMessages(locale)
  const tenant = ctx.mode === "tenant" ? ctx.tenant : null
  const websiteEnabled = !tenant || hasWorkspaceService(tenant, "website")
  const analyticsVisible = tenant ? tenantAnalyticsDashboardVisible(tenant.siteManifest) : true
  const legalRequirements = tenant
    ? await getTenantLegalRequirements(await getPayload({ config }), tenant.id, new Date(), locale)
    : []
  const sites = tenant && websiteEnabled
    ? [{ name: tenant.name, slug: tenant.slug }]
    : user.role === "super-admin"
      ? (await listTenants()).filter(entry => hasWorkspaceService(entry, "website")).map((entry) => ({ name: entry.name, slug: entry.slug }))
      : []

  return (
    <NextIntlClientProvider locale={locale} messages={messages}>
      <Suspense fallback={null}>
        <CmsUsageTracker />
      </Suspense>
      <SidebarProvider>
        <AppSidebar mode={ctx.mode} role={user.role} analyticsVisible={analyticsVisible} websiteEnabled={websiteEnabled} emailEnabled={!tenant || hasWorkspaceService(tenant, "email")} />
        <SidebarInset className="min-w-0">
          <CmsAgentSelectionProvider>
          <SiteHeader user={user} sites={sites} workspaceName={!websiteEnabled ? tenant?.name : undefined} />
          <LegalRequirementBanner requirements={legalRequirements} canAccept={user.role === "owner"} locale={locale} />
          {/* U2 / methodology §1 16-px content-inset floor — `max-md:p-4`
              keeps Cards from touching the viewport edge on phones (Cards
              previously sat with only 8 px inset under `max-md:p-2`). */}
          <main className="min-w-0 flex-1 max-md:p-4 md:p-6">{children}</main>
          </CmsAgentSelectionProvider>
        </SidebarInset>
      </SidebarProvider>
    </NextIntlClientProvider>
  )
}
