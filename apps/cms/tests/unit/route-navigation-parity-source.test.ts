import { readFileSync } from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"

const read = (relativePath: string) =>
  readFileSync(path.resolve(process.cwd(), relativePath), "utf8")

describe("OBS-103 route and navigation parity source checks", () => {
  it("keeps selected-site owner-capable routes behind role and tenant-scope gates", () => {
    for (const route of [
      "src/app/(frontend)/(admin)/sites/[slug]/settings/page.tsx",
      "src/app/(frontend)/(admin)/sites/[slug]/navigation/page.tsx",
      "src/app/(frontend)/(admin)/sites/[slug]/users/page.tsx",
    ]) {
      const source = read(route)
      expect(source).toContain('import { requireOwnerSelectedSite } from "@/lib/routePolicy"')
      expect(source).toContain("requireOwnerSelectedSite(slug)")
    }
  })

  it("keeps selected-site route policies centralized", () => {
    const source = read("src/lib/routePolicy.ts")

    expect(source).toContain('requireRole(["super-admin"])')
    expect(source).toContain('roles: Role[] = ["super-admin", "owner"]')
    expect(source).toContain("getTenantBySlug(slug)")
    expect(source).toContain("if (!tenant) notFound()")
    expect(source).toContain("assertSelectedTenantRouteAccess(gate.ctx, tenant)")
  })

  it("keeps super-admin selected-site routes behind the shared super-admin policy", () => {
    for (const route of [
      "src/app/(frontend)/(admin)/sites/[slug]/analytics/page.tsx",
      "src/app/(frontend)/(admin)/sites/[slug]/edit/page.tsx",
      "src/app/(frontend)/(admin)/sites/[slug]/forms/page.tsx",
      "src/app/(frontend)/(admin)/sites/[slug]/media/page.tsx",
      "src/app/(frontend)/(admin)/sites/[slug]/onboarding/page.tsx",
      "src/app/(frontend)/(admin)/sites/[slug]/page.tsx",
      "src/app/(frontend)/(admin)/sites/[slug]/pages/[id]/page.tsx",
      "src/app/(frontend)/(admin)/sites/[slug]/pages/edit/[pageSlug]/page.tsx",
      "src/app/(frontend)/(admin)/sites/[slug]/pages/new/page.tsx",
      "src/app/(frontend)/(admin)/sites/[slug]/pages/page.tsx",
    ]) {
      const source = read(route)
      expect(source).toContain('import { requireSuperAdminSelectedSite } from "@/lib/routePolicy"')
      expect(source).toContain("requireSuperAdminSelectedSite(slug)")
    }
  })

  it("does not expose selected-site team links to editor/viewer sidebar roles", () => {
    const sidebar = read("src/components/layout/AppSidebar.tsx")
    expect(sidebar).toContain('const showTeam = showContent && (inTenantView || role === "owner")')
    expect(sidebar).toContain("const showSettings = showContent")
  })

  it("keeps team owner-only while tenant settings expose personal preferences", () => {
    expect(read("src/app/(frontend)/(admin)/settings/page.tsx")).toContain("canManageTenantNotifications={isOwner}")
    expect(read("src/app/(frontend)/(admin)/users/page.tsx")).toContain(
      'if (user.role !== "owner") redirect("/?error=forbidden")'
    )
  })

  it("keeps tenant-host selected-site pills from linking to super-admin-only site overview", () => {
    for (const route of [
      "src/app/(frontend)/(admin)/sites/[slug]/settings/page.tsx",
      "src/app/(frontend)/(admin)/sites/[slug]/navigation/page.tsx",
      "src/app/(frontend)/(admin)/sites/[slug]/users/page.tsx",
    ]) {
      expect(read(route)).toContain('href={ctx.mode === "tenant" ? "/" : undefined}')
    }
  })

  it("keeps viewer on read-only tenant content list routes", () => {
    expect(read("src/app/(frontend)/(admin)/pages/page.tsx")).toContain(
      'const canManagePages = user.role === "owner" || user.role === "editor"'
    )
    expect(read("src/app/(frontend)/(admin)/pages/new/page.tsx")).toContain(
      'if (user.role === "viewer") redirect("/?error=forbidden")'
    )
    expect(read("src/app/(frontend)/(admin)/pages/[id]/page.tsx")).toContain(
      'const readOnly = user.role === "viewer"'
    )
    expect(read("src/app/(frontend)/(admin)/pages/edit/[pageSlug]/page.tsx")).toContain(
      'const readOnly = user.role === "viewer"'
    )
    expect(read("src/app/(frontend)/(admin)/pages/[id]/page.tsx")).toContain(
      "readOnly={readOnly}"
    )
    expect(read("src/app/(frontend)/(admin)/pages/edit/[pageSlug]/page.tsx")).toContain(
      "readOnly={readOnly}"
    )
    expect(read("src/app/(frontend)/(admin)/media/page.tsx")).toContain(
      'const canManageMedia = user.role === "owner" || user.role === "editor"'
    )
    expect(read("src/app/(frontend)/(admin)/media/page.tsx")).toContain(
      'pagesBaseHref={canManageMedia ? "/pages" : null}'
    )
  })

  it("renders viewer page detail through read-only editor chrome", () => {
    const pageForm = read("src/components/forms/PageForm.tsx")
    const frameHost = read("src/components/editor/iframe/PageEditorFrameHost.tsx")
    const canvasSurface = read("src/components/editor/canvas/CanvasSurface.tsx")

    expect(pageForm).toContain("readOnly?: boolean")
    expect(pageForm).toContain('const canEditPage = !readOnly')
    expect(pageForm).toContain('value={{ view: readOnly ? "sidebar" : mode')
    expect(pageForm).toContain("{isDesktop && !readOnly && (")
    expect(frameHost).toContain("export function PageEditorFrameHost")
    expect(canvasSurface).toContain("const effectiveReadOnly = readOnly || isReadOnlyView(view)")
    expect(canvasSurface).toContain("onUpdate={readOnly ? () => {} : onUpdate}")
  })
})
