import { readFileSync } from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"

const repoRoot = path.resolve(process.cwd(), process.cwd().endsWith(`${path.sep}apps${path.sep}cms`) ? "../.." : ".")

function read(relativePath: string) {
  return readFileSync(path.join(repoRoot, relativePath), "utf8")
}

describe("customer preview renderer parity source contract", () => {
  it("routes customer preview pages through the shared preview renderer surface", () => {
    const customerRootRoute = read("apps/cms/src/app/(frontend)/(site-preview)/[clientSlug]/page.tsx")
    const customerPageRoute = read("apps/cms/src/app/(frontend)/(site-preview)/[clientSlug]/pages/[pageSlug]/page.tsx")
    const previewRoute = read("apps/cms/src/lib/preview/renderPreviewRoute.tsx")
    const previewCustomizer = read("apps/cms/src/components/preview/PreviewCustomizer.tsx")

    expect(customerRootRoute).toContain('import { renderPreviewRoute } from "@/lib/preview/renderPreviewRoute"')
    expect(customerRootRoute).toContain("return renderPreviewRoute({ clientSlug })")
    expect(customerPageRoute).toContain('import { renderPreviewRoute } from "@/lib/preview/renderPreviewRoute"')
    expect(customerPageRoute).toContain("return renderPreviewRoute({ clientSlug, pageSlug })")

    expect(previewRoute).toContain("<PreviewCustomizer")
    expect(previewRoute).toContain("page={data.currentPage}")
    expect(previewRoute).toContain("settings={data.settings}")
    expect(previewRoute).toContain("tenantSlug={data.tenant.slug}")
    expect(previewRoute).toContain("domain={data.tenant.domain}")
    expect(previewRoute).not.toContain("data-rt-tenant-css")
    expect(previewRoute).not.toContain("dangerouslySetInnerHTML")

    expect(previewCustomizer).toContain("/renderer-frame/preview/")
    expect(previewCustomizer).toContain("data-siab-renderer-frame")
    expect(previewCustomizer).toMatch(/<iframe\b/i)
    expect(previewCustomizer.includes('view="preview"')).toBe(false)
    expect(previewCustomizer.includes("<CanvasMode")).toBe(false)
    expect(previewRoute).toContain("tenantSlug={data.tenant.slug}")
    expect(previewRoute).toContain("domain={data.tenant.domain}")
  })

  it("keeps generic customer preview out of CanvasMode and behind an iframe host", () => {
    const canvasSurface = read("apps/cms/src/components/editor/canvas/CanvasSurface.tsx")
    const previewCustomizer = read("apps/cms/src/components/preview/PreviewCustomizer.tsx")

    expect(previewCustomizer).toContain("data-siab-renderer-frame")
    expect(previewCustomizer.includes("@siteinabox/site-renderer")).toBe(false)
    expect(previewCustomizer.includes("<SitePageRenderer")).toBe(false)
    expect(canvasSurface).toContain('import { CanvasBlockRenderer } from "@/components/editor/canvas/CanvasBlockRenderer"')
  })
})
