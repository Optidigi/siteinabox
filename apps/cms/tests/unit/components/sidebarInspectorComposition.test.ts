import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

const read = (path: string) => readFileSync(path, "utf8")

describe("sidebar inspector composition", () => {
  it("keeps the mobile inspector exposed through host-composable slots", () => {
    const canvasMode = read("src/components/editor/canvas/CanvasMode.tsx")
    const canvasMobile = read("src/components/editor/canvas/mobile/CanvasMobile.tsx")
    const sectionList = read("src/components/editor/canvas/mobile/mobile-section-list.tsx")
    const sectionEdit = read("src/components/editor/canvas/mobile/mobile-section-edit.tsx")
    const inspectorBar = read("src/components/editor/canvas/mobile/mobile-inspector-bar.tsx")
    const pageSettings = read("src/components/editor/canvas/mobile/mobile-page-settings.tsx")
    const seoSettings = read("src/components/editor/canvas/mobile/mobile-seo-settings.tsx")
    const pageForm = read("src/components/forms/PageForm.tsx")

    expect(canvasMode).toContain("renderMobileList?: (context: MobileSectionListSlotContext)")
    expect(canvasMode).toContain("renderMobileSectionEdit?: (context: MobileSectionEditSlotContext)")
    expect(canvasMode).toContain("renderMobileInspector?: (context: MobileInspectorBarSlotContext)")
    expect(canvasMode).toContain("renderMobilePageSettings?: (context: MobilePageSettingsSlotContext)")
    expect(canvasMode).toContain("renderMobileSeoSettings?: (context: MobileSeoSettingsSlotContext)")
    expect(canvasMobile).toContain("renderList={renderMobileList}")
    expect(canvasMobile).toContain("renderSectionEdit={renderMobileSectionEdit}")
    expect(canvasMobile).toContain("renderInspector={renderMobileInspector}")

    expect(sectionList).toContain("export interface MobileSectionListSlotContext")
    expect(sectionList).toContain("export const MobileSectionListLayout")
    expect(sectionEdit).toContain("export interface MobileSectionEditSlotContext")
    expect(sectionEdit).toContain("export const MobileSectionEditLayout")
    expect(inspectorBar).toContain("export interface MobileInspectorBarSlotContext")
    expect(inspectorBar).toContain("export const MobileInspectorBarLayout")
    expect(pageSettings).toContain("export interface MobilePageSettingsSlotContext")
    expect(pageSettings).toContain("export const MobilePageSettingsLayout")
    expect(seoSettings).toContain("export interface MobileSeoSettingsSlotContext")
    expect(seoSettings).toContain("export const MobileSeoSettingsLayout")

    expect(pageForm).toContain("const renderMobileList")
    expect(pageForm).toContain("const renderMobileSectionEdit")
    expect(pageForm).toContain("const renderMobileInspector")
    expect(pageForm).toContain("const renderMobilePageSettings")
    expect(pageForm).toContain("const renderMobileSeoSettings")
    expect(pageForm).toContain("renderMobileList={renderMobileList}")
  })

  it("keeps the registry page settings state exposed through a host-composable slot", () => {
    const sidebarInspector = read("src/components/editor/sidebar-drill-down.tsx")
    const pageForm = read("src/components/forms/PageForm.tsx")

    expect(sidebarInspector).toContain("renderPageSettings?: (context: SidebarPageSettingsSlotContext)")
    expect(sidebarInspector).toContain("export const SidebarPageSettingsLayout")
    expect(sidebarInspector).toContain("seoCard: React.ReactNode")
    expect(sidebarInspector).toContain("dangerZone: React.ReactNode")
    expect(sidebarInspector).toContain("footer: React.ReactNode")
    expect(sidebarInspector).toContain("const actionsHeader = (")
    expect(sidebarInspector).toContain("const footer = null")

    expect(pageForm).toContain("type SidebarPageSettingsSlotContext")
    expect(pageForm).toContain("const renderSidebarPageSettings")
    expect(pageForm).toContain("renderPageSettings={renderSidebarPageSettings}")
  })

  it("composes mobile page settings with Header/Footer navigation after slug without status controls", () => {
    const pageForm = read("src/components/forms/PageForm.tsx")
    const pageSettings = read("src/components/editor/canvas/mobile/mobile-page-settings.tsx")

    const titleIndex = pageForm.indexOf("{ctx.titleField}")
    const slugIndex = pageForm.indexOf("{ctx.slugField}")
    const navIndex = pageForm.indexOf("{mobileNavigationSection}")

    expect(pageForm).toContain("const mobileNavigationSection = canManageNav")
    expect(pageForm).toContain('id="mobile-nav-header-toggle"')
    expect(pageForm).toContain('id="mobile-nav-footer-toggle"')
    expect(titleIndex).toBeGreaterThan(-1)
    expect(slugIndex).toBeGreaterThan(titleIndex)
    expect(navIndex).toBeGreaterThan(slugIndex)
    expect(pageForm).not.toContain("{ctx.statusField}")
    expect(pageSettings).not.toContain("statusField")
    expect(pageSettings).not.toContain('name="status"')
  })

  it("keeps the registry block list exposed through a host-composable slot", () => {
    const sidebarInspector = read("src/components/editor/sidebar-drill-down.tsx")
    const pageForm = read("src/components/forms/PageForm.tsx")

    expect(sidebarInspector).toContain("renderList?: (context: SidebarListSlotContext)")
    expect(sidebarInspector).toContain("export const SidebarListLayout")
    expect(sidebarInspector).toContain("blockRows: React.ReactNode")
    expect(sidebarInspector).toContain("addBlockButton: React.ReactNode")
    expect(sidebarInspector).toContain("blockTypePicker: React.ReactNode")

    expect(pageForm).toContain("type SidebarListSlotContext")
    expect(pageForm).toContain("const renderSidebarList")
    expect(pageForm).toContain("renderList={renderSidebarList}")
  })

  it("keeps the registry block form exposed through a host-composable slot", () => {
    const sidebarInspector = read("src/components/editor/sidebar-drill-down.tsx")
    const pageForm = read("src/components/forms/PageForm.tsx")

    expect(sidebarInspector).toContain("renderBlockForm?: (context: SidebarBlockFormSlotContext)")
    expect(sidebarInspector).toContain("export const SidebarBlockFormLayout")
    expect(sidebarInspector).toContain("fields: React.ReactNode")
    expect(sidebarInspector).toContain("deleteDialog: React.ReactNode")

    expect(pageForm).toContain("type SidebarBlockFormSlotContext")
    expect(pageForm).toContain("const renderSidebarBlockForm")
    expect(pageForm).toContain("renderBlockForm={renderSidebarBlockForm}")
  })
})
