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

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, ctx } = await requireAuth()
  const locale = resolveLocale(user.language)
  const messages = await loadMessages(locale)
  const tenant = ctx.mode === "tenant" ? ctx.tenant : null
  const analyticsVisible = tenant ? tenantAnalyticsDashboardVisible(tenant.siteManifest) : true
  const legalRequirements = tenant
    ? await getTenantLegalRequirements(await getPayload({ config }), tenant.id)
    : []

  return (
    <NextIntlClientProvider locale={locale} messages={messages}>
      <Suspense fallback={null}>
        <CmsUsageTracker />
      </Suspense>
      <SidebarProvider>
        <AppSidebar mode={ctx.mode} role={user.role} analyticsVisible={analyticsVisible} />
        <SidebarInset className="min-w-0">
          <SiteHeader user={user} />
          <LegalRequirementBanner requirements={legalRequirements} canAccept={user.role === "owner"} locale={locale} />
          {/* U2 / methodology §1 16-px content-inset floor — `max-md:p-4`
              keeps Cards from touching the viewport edge on phones (Cards
              previously sat with only 8 px inset under `max-md:p-2`). */}
          <main className="min-w-0 flex-1 max-md:p-4 md:p-6">{children}</main>
        </SidebarInset>
      </SidebarProvider>
    </NextIntlClientProvider>
  )
}
