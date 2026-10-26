"use client"

import { SidebarTrigger } from "@siteinabox/ui/components/sidebar"
import { ThemeToggle } from "@/components/theme-toggle"
import { UserMenu } from "./UserMenu"
import { CmsAgentDrawer } from "./CmsAgentDrawer"
import { useCmsAgentSelectionState } from "./CmsAgentSelection"
import type { User } from "@/payload-types"
import { usePathname } from "next/navigation"
import { SiteSwitcher, type SiteSwitcherSite } from "@/components/layout/SiteSwitcher"
import { WorkspaceHeader } from "./WorkspaceHeader"

export function isPageEditorPath(pathname: string) {
  return /^\/pages\/(?:new|\d+|edit\/[^/]+)$/.test(pathname)
    || /^\/sites\/[^/]+\/pages\/(?:new|\d+|edit\/[^/]+)$/.test(pathname)
}

const RESERVED_SITES_SEGMENTS = new Set(["new"])

export function SiteHeader({
  user,
  sites = [],
  workspaceName,
}: {
  user: Pick<User, "email" | "name" | "role">
  sites?: SiteSwitcherSite[]
  workspaceName?: string
}) {
  const pathname = usePathname() ?? "/"
  const selection = useCmsAgentSelectionState()
  const onPageEditor = isPageEditorPath(pathname)
  const slugMatch = pathname.match(/^\/sites\/([^/]+)/)
  const rawSlug = slugMatch?.[1]
  const tenantSlug = (rawSlug && !RESERVED_SITES_SEGMENTS.has(rawSlug) ? rawSlug : undefined)
    ?? selection.tenantSlug
    ?? (sites.length === 1 ? sites[0]?.slug : undefined)
  const currentSite = tenantSlug
    ? sites.find((site) => site.slug === tenantSlug) ?? { name: tenantSlug, slug: tenantSlug }
    : null

  return (
    <WorkspaceHeader data-siab-cms-sticky-chrome className="sticky top-0 z-30 h-16 gap-2 bg-background py-0 md:px-5" identity={<>
      {!onPageEditor ? (
        <SidebarTrigger variant="outline" className="md:hidden" />
      ) : null}
      {workspaceName ? <span className="truncate text-sm font-medium">{workspaceName}</span> : null}
      {currentSite && !onPageEditor ? (
        <div className="min-w-0">
          <SiteSwitcher current={currentSite} sites={sites} />
        </div>
      ) : null}
      </>} actions={<>
      {tenantSlug ? (
        <div className={onPageEditor ? "hidden min-[1280px]:block" : undefined}>
          <CmsAgentDrawer
            tenantSlug={tenantSlug}
            pageSlug={selection.pageSlug}
            selectedBlockIndex={selection.selectedBlockIndex}
            onApplied={selection.applySnapshot ?? undefined}
          />
        </div>
      ) : null}
      <div className="max-md:hidden">
        <ThemeToggle />
      </div>
      <UserMenu user={{ email: user.email, name: user.name ?? null, role: user.role }} />
      </>} />
  )
}
