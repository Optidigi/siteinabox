import { readFileSync } from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"

const repoRoot = path.resolve(process.cwd(), process.cwd().endsWith(`${path.sep}apps${path.sep}cms`) ? "../.." : ".")

function read(relativePath: string) {
  return readFileSync(path.join(repoRoot, relativePath), "utf8")
}

describe("editor frame route source contract", () => {
  it("loads generated-site renderer CSS and scoped canvas CSS in the editor-frame layout shell", () => {
    const layout = read("apps/cms/src/app/(editor-frame)/layout.tsx")

    expect(layout).toContain('import "@/styles/shadcn.css"')
    expect(layout).toContain('import "@/styles/editor-frame-ui.css"')
    expect(layout).toContain('import "@/styles/editor-frame-canvas-affordances.css"')
    expect(layout).toContain('import "@/styles/generated-site-renderer.css"')
    expect(layout).toContain('import "@/styles/site-renderer-canvas.css"')
    expect(layout).toContain('import { ThemeProvider } from "@/components/theme-provider"')
    expect(layout.indexOf('import "@/styles/generated-site-renderer.css"')).toBeLessThan(
      layout.indexOf('import "@/styles/shadcn.css"'),
    )
    expect(layout).toContain('<ThemeProvider attribute="class" defaultTheme="dark" enableSystem disableTransitionOnChange nonce={nonce}>')
    expect(layout.indexOf("<CspNonceProvider nonce={nonce}>")).toBeLessThan(
      layout.indexOf('<ThemeProvider attribute="class" defaultTheme="dark" enableSystem disableTransitionOnChange nonce={nonce}>'),
    )
    expect(layout.indexOf('<ThemeProvider attribute="class" defaultTheme="dark" enableSystem disableTransitionOnChange nonce={nonce}>')).toBeLessThan(
      layout.indexOf("<StatusFeedbackProvider>"),
    )
    expect(layout).toContain("<html")
    expect(layout).toContain("<body>")
  })

  it("defines an authenticated editor-frame page route with tenant ownership checks", () => {
    const route = read("apps/cms/src/app/(editor-frame)/editor-frame/pages/[id]/page.tsx")

    expect(route).toContain('import { requireAuth } from "@/lib/authGate"')
    expect(route).toContain('import { getPageById, listPages } from "@/lib/queries/pages"')
    expect(route).toContain('import { getOrCreateSiteSettings } from "@/lib/queries/settings"')
    expect(route).toContain('import { sameRelationshipId } from "@/lib/relationshipId"')
    expect(route).toContain('import { EditorFrameRuntime } from "@/components/editor-frame/EditorFrameRuntime"')
    expect(route).toContain('import { createEditorFrameNewPagePlaceholder } from "@/lib/editor/editorFramePlaceholderPage"')
    expect(route).toContain('import { loadCanvasTenantCss } from "@/lib/editor/loadTenantCss"')
    expect(route).toContain("loadCanvasTenantCss(tenant)")
    expect(route).toContain('import { getTenantBySlug } from "@/lib/queries/tenants"')
    expect(route).toContain("resolveEditorFrameTenant")
    expect(route).toContain('searchParams: Promise<RouteSearchParams>')
    expect(route).toContain("tenantSlugParam")
    expect(route).toContain('ctx.mode === "tenant"')
    expect(route).toContain('ctx.mode !== "super-admin"')
    expect(route).toContain('const isNewPage = id === "new"')
    expect(route).toContain("if (!isNewPage && !Number.isFinite(pageId)) notFound()")
    expect(route).toContain("if (!isNewPage) {")
    expect(route).toContain("sameRelationshipId(page.tenant, tenant.id)")
    expect(route).toContain("createEditorFrameNewPagePlaceholder()")
    expect(route).not.toContain("isPreviewHost")
    expect(route).not.toContain("previewAuth")
    expect(route).not.toContain("CanvasMode")
  })

  it("uses the iframe-editor contract and renderer runtime without CanvasMode", () => {
    const runtime = read("apps/cms/src/components/editor-frame/EditorFrameRuntime.tsx")

    expect(runtime).toContain("@siteinabox/contracts/iframe-editor")
    expect(runtime).toContain("validateIframeEditorMessage")
    expect(runtime).toContain('type: "renderer.ready"')
    expect(runtime).toContain("selection: true")
    expect(runtime).toContain('type: "selection.changed"')
    expect(runtime).toContain("data-block-index")
    expect(runtime).toContain("SitePageRenderer")
    expect(runtime).toContain("createRendererMediaResolver")
    expect(runtime).toContain("includeBehaviorScripts={false}")
    expect(runtime).not.toContain("CanvasMode")
  })
})
