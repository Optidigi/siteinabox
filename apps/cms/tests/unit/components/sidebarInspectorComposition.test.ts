import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

const read = (path: string) => readFileSync(path, "utf8")

describe("sidebar inspector composition", () => {
  it("keeps the active mobile iframe editor layout primitives available for composition", () => {
    const sectionList = read("src/components/editor/canvas/mobile/mobile-section-list.tsx")
    const inspectorBar = read("src/components/editor/canvas/mobile/mobile-inspector-bar.tsx")
    const pageSettings = read("src/components/editor/canvas/mobile/mobile-page-settings.tsx")
    const seoSettings = read("src/components/editor/canvas/mobile/mobile-seo-settings.tsx")
    const frameEditor = read("src/components/editor/iframe/MobileFrameEditor.tsx")

    expect(sectionList).toContain("export interface MobileSectionListSlotContext")
    expect(sectionList).toContain("export const MobileSectionListLayout")
    expect(inspectorBar).toContain("export interface MobileInspectorBarSlotContext")
    expect(inspectorBar).toContain("export const MobileInspectorBarLayout")
    expect(pageSettings).toContain("export interface MobilePageSettingsSlotContext")
    expect(pageSettings).toContain("export const MobilePageSettingsLayout")
    expect(seoSettings).toContain("export interface MobileSeoSettingsSlotContext")
    expect(seoSettings).toContain("export const MobileSeoSettingsLayout")
    expect(frameEditor).toContain("function MobileFocusedSection")
    expect(frameEditor).toContain("<MobileSectionList")
    expect(frameEditor).toContain("<MobileInspectorBar")
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
