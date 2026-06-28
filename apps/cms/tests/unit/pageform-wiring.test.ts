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

  it("keeps the CMS canvas on the editor renderer path", () => {
    const canvasMode = read("src/components/editor/canvas/CanvasMode.tsx")
    const pageForm = read("src/components/forms/PageForm.tsx")

    expect(canvasMode).not.toContain('from "@siteinabox/site-renderer"')
    expect(canvasMode).not.toContain("ExactLegacyCanvas")
    expect(canvasMode).not.toContain("<SitePageRenderer")
    expect(pageForm).not.toContain("rendererSettings")
    expect(pageForm).not.toContain("tenantSlug")
  })

  it("publishes official tenant saves without a separate live-publish button", () => {
    const pageForm = read("src/components/forms/PageForm.tsx")
    const publishControls = read("src/components/editor/publish-controls.tsx")
    const mobilePageSettings = read("src/components/editor/canvas/mobile/mobile-page-settings.tsx")
    const officialTenants = read("src/lib/officialTenants.ts")
    const tenantRoute = read("src/app/(frontend)/(admin)/pages/[id]/page.tsx")
    const selectedSiteRoute = read("src/app/(frontend)/(admin)/sites/[slug]/pages/[id]/page.tsx")

    expect(pageForm).not.toContain("Publish live")
    expect(pageForm).not.toContain("canPublishLive")
    expect(pageForm).toContain("autoPublishLive")
    expect(pageForm).toContain('const savedValues: Values = { ...values, status: "published" }')
    expect(pageForm).toContain('fetch("/api/tenant-theme"')
    expect(pageForm).toContain('fetch("/api/publish"')
    expect(pageForm).toContain("await Promise.all([themePromise, saveNavMembership(), saveChrome()])")
    expect(pageForm).not.toContain('from "@/lib/actions/setTenantTheme"')
    expect(pageForm).toContain("includeAllPublishedPages: true")
    expect(pageForm).toContain("activate: true")
    expect(pageForm).toContain("manualActivation: true")
    expect(pageForm).toContain('status: "published"')
    expect(officialTenants).toContain("export function isOfficialTenant")
    expect(tenantRoute).toContain("autoPublishLive={isOfficialTenant(ctx.tenant)}")
    expect(selectedSiteRoute).toContain("autoPublishLive={isOfficialTenant(tenant)}")
    expect(publishControls).not.toContain("SelectItem")
    expect(mobilePageSettings).not.toContain("statusField")
  })
})
