import { SidebarProvider, SidebarInset } from "@siteinabox/ui/components/sidebar"
import { CmsPostHogTracker, type CmsPostHogConfig } from "@/components/analytics/CmsPostHogTracker"
import { AppSidebar } from "@/components/layout/AppSidebar"
import { SiteHeader } from "@/components/layout/SiteHeader"
import { requireAuth } from "@/lib/authGate"
import { getPostHogAnalyticsConfig } from "@/lib/analytics/config"
import { headers } from "next/headers"
import { NextIntlClientProvider } from "next-intl"
import { Suspense } from "react"
import { CmsUsageTracker } from "@/components/analytics/CmsUsageTracker"
import { resolveLocale } from "@/i18n/config"
import { loadMessages } from "@/i18n/messages"

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, ctx } = await requireAuth()
  const headerStore = await headers()
  const posthog = getPostHogAnalyticsConfig()
  const locale = resolveLocale(user.language)
  const messages = await loadMessages(locale)
  const tenant = ctx.mode === "tenant" ? ctx.tenant : null
  const cmsPostHogConfig: CmsPostHogConfig = {
    enabled: posthog.captureEnabled,
    projectToken: posthog.projectToken,
    apiHost: posthog.publicHost,
    uiHost: posthog.host,
    context: {
      distinctId: `cms:${user.id}`,
      environment: posthog.environment,
      adminHost: headerStore.get("x-siab-host") || headerStore.get("host"),
      cmsMode: ctx.mode,
      tenantId: tenant ? String(tenant.id) : null,
      tenantSlug: tenant ? String(tenant.slug ?? "") || null : null,
      siteDomain: tenant ? String(tenant.domain ?? "") || null : null,
      userRole: user.role,
    },
  }

  return (
    <NextIntlClientProvider locale={locale} messages={messages}>
      <Suspense fallback={null}>
        <CmsPostHogTracker config={cmsPostHogConfig} />
        <CmsUsageTracker />
      </Suspense>
      <SidebarProvider>
        <AppSidebar mode={ctx.mode} role={user.role} />
        <SidebarInset className="min-w-0">
          <SiteHeader user={user} />
          {/* U2 / methodology §1 16-px content-inset floor — `max-md:p-4`
              keeps Cards from touching the viewport edge on phones (Cards
              previously sat with only 8 px inset under `max-md:p-2`). */}
          <main className="min-w-0 flex-1 max-md:p-4 md:p-6">{children}</main>
        </SidebarInset>
      </SidebarProvider>
    </NextIntlClientProvider>
  )
}
