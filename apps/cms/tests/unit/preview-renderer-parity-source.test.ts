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

    expect(previewCustomizer).toContain('view="preview"')
    expect(previewCustomizer).toContain("rendererSettings={settings}")
    expect(previewCustomizer).toContain("tenantSlug={tenantSlug}")
    expect(previewCustomizer).toContain("tenantDomain={domain}")
  })

  it("uses SitePageRenderer for non-Amicare generic customer preview, not only the legacy Amicare shell", () => {
    const canvasMode = read("apps/cms/src/components/editor/canvas/CanvasMode.tsx")

    expect(canvasMode).toContain('import { SitePageRenderer, createRendererMediaResolver, resolveLegacyTenant } from "@siteinabox/site-renderer"')
    expect(canvasMode).toContain("const legacyTenant = rendererSettings")
    expect(canvasMode).toContain('const useSharedAmicareShell = legacyTenant === "amicare"')
    expect(canvasMode).toContain("const useSharedPreviewShell = isCustomerPreviewView(view) && Boolean(rendererSettings)")
    expect(canvasMode).toContain("const useSharedRendererShell = useSharedAmicareShell || useSharedPreviewShell")
    expect(canvasMode).toContain("{useSharedRendererShell ? (")
    expect(canvasMode).toContain("<SitePageRenderer")
    expect(canvasMode).toContain("tenantSlug={tenantSlug}")
    expect(canvasMode).toContain("domain={tenantDomain}")
    expect(canvasMode).toContain("includeThemeStyle")
    expect(canvasMode).toContain("includeBehaviorScripts={false}")
    expect(canvasMode).toContain('canvasAttributes={{ "data-rt-view": view } as React.HTMLAttributes<HTMLDivElement>}')
    expect(canvasMode).toContain("renderBlocks={isCustomerPreviewView(view)")
  })
})
