import { readFileSync } from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"

const read = (relativePath: string) =>
  readFileSync(path.resolve(process.cwd(), relativePath), "utf8")

describe("PageForm wiring boundaries", () => {
  it("keeps the rich-text manifest context outside the PageForm module", () => {
    expect(read("src/components/editor/RtManifestContext.tsx")).toContain("RtManifestProvider")
    expect(read("src/components/forms/PageForm.tsx")).toContain(
      'export { useRtManifest }',
    )
    expect(read("src/components/editor/FieldRenderer.tsx")).toContain(
      'from "@/components/editor/RtManifestContext"',
    )
    expect(read("src/components/editor/richText/PastePlugin.tsx")).toContain(
      'from "@/components/editor/RtManifestContext"',
    )
    expect(read("src/components/editor/FieldRenderer.tsx")).not.toContain(
      'from "@/components/forms/PageForm"',
    )
    expect(read("src/components/editor/richText/PastePlugin.tsx")).not.toContain(
      'from "@/components/forms/PageForm"',
    )
  })

  it("keeps official Amicare canvas parity while moving customer preview to an iframe", () => {
    const canvasSurface = read("src/components/editor/canvas/CanvasSurface.tsx")
    const pageForm = read("src/components/forms/PageForm.tsx")
    const previewCustomizer = read("src/components/preview/PreviewCustomizer.tsx")

    expect(canvasSurface).not.toContain("ExactLegacyCanvas")
    expect(canvasSurface).toContain('from "@siteinabox/site-renderer"')
    expect(canvasSurface).toContain("<SitePageRenderer")
    expect(canvasSurface).toContain('legacyTenant === "amicare"')
    expect(canvasSurface).toContain("? undefined")
    expect(canvasSurface).toContain("renderHeader={renderHeaderChrome")
    expect(canvasSurface).toContain("renderFooter={renderFooterChrome")
    expect(canvasSurface).toContain("<CanvasBlockRenderer")
    expect(canvasSurface).toContain("onUpdate={effectiveReadOnly ? () => {} : updateBlock(index)}")
    expect(canvasSurface).not.toContain("{defaultRenderBlocks[index]}")
    expect(canvasSurface).toContain("createRendererMediaResolver")
    expect(canvasSurface).toContain("mediaResolver={mediaResolver}")
    expect(pageForm).toContain("rendererSettingsFromChromeDraft")
    expect(pageForm).toContain("const frameSettings = rendererSettingsState")
    expect(pageForm).toContain("tenantId={tenantId}")
    expect(pageForm).toContain("rendererNavPages")
    expect(pageForm).toContain("tenantSlug: tenantSlug ?? null")
    expect(pageForm).toContain("SiteChromeRow")
    expect(pageForm).toContain("<PageEditorFrameHost")
    expect(previewCustomizer).toContain("data-siab-renderer-frame")
    expect(previewCustomizer).toContain("/__renderer-frame/preview/")
    expect(previewCustomizer.includes("<CanvasMode")).toBe(false)
  })

  it("keeps Amicare-only rich text canvas treatment scoped to Amicare renderers", () => {
    const richTextCanvas = read("src/components/editor/canvas/blocks/RichText.tsx")
    const mobileSectionEdit = read("src/components/editor/canvas/mobile/mobile-section-edit.tsx")

    expect(richTextCanvas).toContain('legacyTenant === "amicare" ? splitAmicareIntro(block.body) : null')
    expect(richTextCanvas).toContain('className="amicare-richtext-body prose mx-auto mt-10')
    expect(richTextCanvas).not.toContain("splitBody.body.children.length > 0")
    expect(mobileSectionEdit).toContain('data-siab-site-renderer={legacyTenant === "amicare" ? "true" : undefined}')
    expect(mobileSectionEdit).toContain('data-legacy-tenant={legacyTenant === "amicare" ? "amicare" : undefined}')
    expect(mobileSectionEdit).toContain('className="rt-canvas w-full"')
    expect(mobileSectionEdit).toContain("legacyTenant={legacyTenant}")
  })

  it("publishes official tenant saves without a separate live-publish button", () => {
    const pageForm = read("src/components/forms/PageForm.tsx")
    const publishControls = read("src/components/editor/publish-controls.tsx")
    const mobilePageSettings = read("src/components/editor/canvas/mobile/mobile-page-settings.tsx")
    const officialTenants = read("src/lib/officialTenants.ts")
    const publishCurrentState = read("src/lib/publish/currentState.ts")
    const tenantRoute = read("src/app/(frontend)/(admin)/pages/[id]/page.tsx")
    const selectedSiteRoute = read("src/app/(frontend)/(admin)/sites/[slug]/pages/[id]/page.tsx")

    expect(pageForm).not.toContain("Publish live")
    expect(pageForm).not.toContain("canPublishLive")
    expect(pageForm).toContain("autoPublishLive")
    expect(pageForm).toContain('const savedValues: Values = { ...values, status: "published" }')
    expect(pageForm).toContain('fetch("/api/tenant-theme"')
    expect(pageForm).toContain("await Promise.all([themePromise, saveNavMembership(), saveChrome()])")
    expect(pageForm).toContain("await publishCurrentTenantStateAction(")
    expect(pageForm).toContain("auto-publish current CMS state after page")
    expect(pageForm).not.toContain('from "@/lib/actions/setTenantTheme"')
    expect(publishCurrentState).toContain("includeAllPublishedPages: true")
    expect(publishCurrentState).toContain("activate: true")
    expect(publishCurrentState).toContain("manualActivation: true")
    expect(pageForm).toContain('status: "published"')
    expect(officialTenants).toContain("export function isOfficialTenant")
    expect(tenantRoute).toContain("autoPublishLive={isOfficialTenant(ctx.tenant)}")
    expect(selectedSiteRoute).toContain("autoPublishLive={isOfficialTenant(tenant)}")
    expect(publishControls).not.toContain("SelectItem")
    expect(mobilePageSettings).not.toContain("statusField")
  })
})
