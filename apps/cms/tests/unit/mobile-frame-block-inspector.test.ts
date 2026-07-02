import { readFileSync } from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"

const repoRoot = path.resolve(process.cwd(), process.cwd().endsWith(`${path.sep}apps${path.sep}cms`) ? "../.." : ".")

function read(relativePath: string) {
  return readFileSync(path.join(repoRoot, relativePath), "utf8")
}

describe("mobile iframe block inspector source contract", () => {
  it("hosts parent-owned BlockFormFields in a vaul sheet for iframe mobile editing", () => {
    const sheet = read("apps/cms/src/components/editor/iframe/MobileBlockInspectorSheet.tsx")
    const pageForm = read("apps/cms/src/components/forms/PageForm.tsx")

    expect(sheet).toContain("export function MobileBlockInspectorSheet")
    expect(sheet).toContain("data-mobile-frame-block-inspector")
    expect(sheet).toContain("data-mobile-frame-block-inspector-done")
    expect(sheet).toContain('import { BlockFormFields } from "@/components/editor/fields/block-form-fields"')
    expect(sheet).toContain('import { VAUL_BOTTOM_SNAP_CSS } from "@/components/editor/canvas/mobile/vaulBottomSnapCss"')
    expect(sheet).toContain("useInspectorKeyboardLock(true)")
    expect(sheet).toContain("handleOnly")
    expect(sheet).toContain("const BLOCK_INSPECTOR_SNAP = 0.92")
    expect(sheet).not.toContain("CanvasMobile")
    expect(sheet).not.toContain("CanvasMode")

    expect(pageForm).toContain('import { MobileBlockInspectorSheet } from "@/components/editor/iframe/MobileBlockInspectorSheet"')
    expect(pageForm).toContain("mobileBlockInspectorIndex")
    expect(pageForm).toContain("setMobileBlockInspectorIndex(index)")
    expect(pageForm).toContain("closeMobileBlockInspector")
    expect(pageForm).toContain("handleMobileBlockDelete")
    expect(pageForm).toContain("<MobileBlockInspectorSheet")
    expect(pageForm).toContain("onOpenBlockInspector={openBlockInSidebar}")
    expect(pageForm).toContain("if (!isDesktop) {")
    expect(pageForm).toContain("<MobileMediaSheetProvider>")
  })

  it("shares nonce-bearing vaul snap css between legacy and iframe mobile inspectors", () => {
    const sharedCss = read("apps/cms/src/components/editor/canvas/mobile/vaulBottomSnapCss.ts")
    const legacyInspector = read("apps/cms/src/components/editor/canvas/mobile/mobile-inspector-bar.tsx")
    const iframeInspector = read("apps/cms/src/components/editor/iframe/MobileBlockInspectorSheet.tsx")

    expect(sharedCss).toContain("export const VAUL_BOTTOM_SNAP_CSS")
    expect(sharedCss).toContain("[data-vaul-handle]")
    expect(legacyInspector).toContain('from "@/components/editor/canvas/mobile/vaulBottomSnapCss"')
    expect(iframeInspector).toContain('from "@/components/editor/canvas/mobile/vaulBottomSnapCss"')
    expect(legacyInspector).toContain("data-mobile-inspector-vaul-css")
    expect(iframeInspector).toContain("data-mobile-inspector-vaul-css")
  })
})
