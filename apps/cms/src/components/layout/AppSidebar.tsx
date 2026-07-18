"use client"
import { useEffect, useRef } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useTranslations } from "next-intl"
import { BarChart3, LayoutDashboard, Globe, Users, Inbox, ListChecks, Settings, FileText, Image as ImageIcon, Navigation, ClipboardList, Scale } from "lucide-react"
import {
  Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupContent,
  SidebarGroupLabel, SidebarHeader, SidebarMenu, SidebarMenuButton, SidebarMenuItem,
  useSidebar
} from "@siteinabox/ui/components/sidebar"

type Mode = "super-admin" | "tenant"
type Role = "super-admin" | "owner" | "editor" | "viewer"

export function AppSidebar({ mode, role, analyticsVisible = true }: { mode: Mode; role: Role; analyticsVisible?: boolean }) {
  const pathname = usePathname() ?? "/"
  const t = useTranslations("app")
  const { isMobile, setOpenMobile } = useSidebar()
  const lastPathRef = useRef(pathname)
  useEffect(() => {
    if (isMobile && lastPathRef.current !== pathname) {
      setOpenMobile(false)
    }
    lastPathRef.current = pathname
  }, [pathname, isMobile, setOpenMobile])
  // FN-2026-0007 fix — the regex matches any first path segment under
  // /sites/, including reserved non-site routes like /sites/new (the
  // create-site form). Filter those out so the Site group doesn't
  // render Pages/Media/etc. links pointing at /sites/new/pages (404s).
  // The set is small and stable; if a new reserved /sites/* route is
  // added in the future the new sibling under app/(admin)/sites/ should
  // be added here too.
  const RESERVED_SITES_SEGMENTS = new Set(["new"])
  const slugMatch = pathname.match(/^\/sites\/([^/]+)/)
  const rawSlug = slugMatch?.[1]
  const tenantSlug = rawSlug && !RESERVED_SITES_SEGMENTS.has(rawSlug) ? rawSlug : undefined
  const inTenantView = mode === "super-admin" && !!tenantSlug
  const base = inTenantView ? `/sites/${tenantSlug}` : ""

  // Selected-state matcher. Special-case "/" (Dashboard) to require an
  // exact match — otherwise startsWith("/") would match every route.
  // For all other links, an exact match OR a deeper sub-path counts as
  // "active" (e.g. /sites/foo/pages keeps "Sites" highlighted in Overview
  // because the user is conceptually still in that section).
  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(href + "/")

  // Site group (Pages/Media/Forms/Onboarding when
  // their inner gates pass) only makes sense in two contexts:
  //   1. site editors (mode === "tenant") — they author for their own site
  //   2. super-admin viewing a specific site (inTenantView === true) —
  //      links resolve to /sites/<slug>/* and edit that site's content
  // For super-admin AT TOP LEVEL (no site picked), every Site link
  // would resolve to a top-level route that just redirects to /sites — dead
  // ends. Hide the group entirely; the user picks a site from the Overview
  // group's Sites link instead.
  const showContent = mode === "tenant" || inTenantView
  const analyticsHref = inTenantView ? `${base}/analytics` : "/analytics"
  const settingsHref = `${base}/settings`
  const teamHref = `${base}/users`
  // Every tenant member can manage their own email preferences on Settings.
  // Website/legal controls on that page remain owner-only.
  const showSettings = showContent
  const showTeam = showContent && (inTenantView || role === "owner")

  return (
    <Sidebar
      collapsible="icon"
      className="[--sidebar-primary:var(--brand)] [--sidebar-primary-foreground:var(--brand-foreground)]"
    >
      <SidebarHeader>
        <Link href="/" aria-label={t("home")} className="flex items-center px-2 py-1.5 group-data-[collapsible=icon]:px-0 group-data-[collapsible=icon]:justify-center">
          {/* Expanded: full wordmark logo */}
          <span className="group-data-[collapsible=icon]:hidden">
            <img src="/logos/logo-light.svg" alt="SiteInABox" className="h-7 w-auto dark:hidden" />
            <img src="/logos/logo-dark.svg"  alt="SiteInABox" className="hidden dark:block h-7 w-auto" />
          </span>
          {/* Collapsed: icon mark only */}
          <span className="hidden group-data-[collapsible=icon]:flex items-center justify-center">
            <img src="/logos/icon-light.svg" alt="" className="h-6 w-6 dark:hidden" />
            <img src="/logos/icon-dark.svg"  alt="" className="hidden dark:block h-6 w-6" />
          </span>
        </Link>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>{t("overview")}</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem><SidebarMenuButton asChild isActive={isActive("/")}><Link href="/"><LayoutDashboard /> {t("dashboard")}</Link></SidebarMenuButton></SidebarMenuItem>
              {(mode === "super-admin" || analyticsVisible) && (
                <SidebarMenuItem className="max-md:hidden"><SidebarMenuButton asChild isActive={isActive(analyticsHref)}><Link href={analyticsHref}><BarChart3 /> {t("analytics")}</Link></SidebarMenuButton></SidebarMenuItem>
              )}
              {showSettings && (
                <SidebarMenuItem><SidebarMenuButton asChild isActive={isActive(settingsHref)}><Link href={settingsHref}><Settings /> {t("settings")}</Link></SidebarMenuButton></SidebarMenuItem>
              )}
              {showTeam && (
                <SidebarMenuItem><SidebarMenuButton asChild isActive={isActive(teamHref)}><Link href={teamHref}><Users /> {t("team")}</Link></SidebarMenuButton></SidebarMenuItem>
              )}
              {mode === "super-admin" && !inTenantView && (
                <>
                  <SidebarMenuItem><SidebarMenuButton asChild isActive={isActive("/sites")}><Link href="/sites"><Globe /> {t("sites")}</Link></SidebarMenuButton></SidebarMenuItem>
                  <SidebarMenuItem><SidebarMenuButton asChild isActive={isActive("/operations")}><Link href="/operations"><ClipboardList /> {t("operations")}</Link></SidebarMenuButton></SidebarMenuItem>
                  <SidebarMenuItem><SidebarMenuButton asChild isActive={isActive("/legal")}><Link href="/legal"><Scale /> {t("legal")}</Link></SidebarMenuButton></SidebarMenuItem>
                  <SidebarMenuItem><SidebarMenuButton asChild isActive={isActive("/users")}><Link href="/users"><Users /> {t("users")}</Link></SidebarMenuButton></SidebarMenuItem>
                </>
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        {showContent && (
          <SidebarGroup>
            <SidebarGroupLabel>{t("site")}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem><SidebarMenuButton asChild isActive={isActive(`${base}/pages`)}><Link href={`${base}/pages`}><FileText /> {t("pages")}</Link></SidebarMenuButton></SidebarMenuItem>
                {(role === "super-admin" || role === "owner") && (
                  <SidebarMenuItem><SidebarMenuButton asChild isActive={isActive(`${base}/navigation`)}><Link href={`${base}/navigation`}><Navigation /> {t("navigation")}</Link></SidebarMenuButton></SidebarMenuItem>
                )}
                <SidebarMenuItem><SidebarMenuButton asChild isActive={isActive(`${base}/media`)}><Link href={`${base}/media`}><ImageIcon /> {t("media")}</Link></SidebarMenuButton></SidebarMenuItem>
                <SidebarMenuItem><SidebarMenuButton asChild isActive={isActive(`${base}/forms`)}><Link href={`${base}/forms`}><Inbox /> {t("forms")}</Link></SidebarMenuButton></SidebarMenuItem>
                {inTenantView && (
                  <SidebarMenuItem><SidebarMenuButton asChild isActive={isActive(`${base}/onboarding`)}><Link href={`${base}/onboarding`}><ListChecks /> {t("onboarding")}</Link></SidebarMenuButton></SidebarMenuItem>
                )}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>
      <SidebarFooter />
    </Sidebar>
  )
}
