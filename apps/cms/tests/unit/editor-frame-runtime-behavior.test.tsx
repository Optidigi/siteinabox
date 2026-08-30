/** @vitest-environment jsdom */
import { act, render, screen, waitFor } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import type { Page, SiteSettings } from "@siteinabox/contracts"
import {
  IFRAME_EDITOR_PROTOCOL_NAME,
  IFRAME_EDITOR_PROTOCOL_VERSION,
  type IframeEditorSelection,
} from "@siteinabox/contracts/iframe-editor"

const rendererMocks = vi.hoisted(() => ({
  applyThemeAttributes: vi.fn(() => () => undefined),
  initializeHeroDitherEffects: vi.fn(() => () => undefined),
  initializeHeroAmbientEffectsWhenPresent: vi.fn(async () => null),
  initializeHeroMeshEffectsWhenPresent: vi.fn(async () => null),
  initializeNavbarBehavior: vi.fn(() => () => undefined),
}))

vi.mock("@siteinabox/site-renderer", () => ({
  applyThemeAttributes: rendererMocks.applyThemeAttributes,
  initializeHeroDitherEffects: rendererMocks.initializeHeroDitherEffects,
  initializeHeroAmbientEffectsWhenPresent: rendererMocks.initializeHeroAmbientEffectsWhenPresent,
  initializeHeroMeshEffectsWhenPresent: rendererMocks.initializeHeroMeshEffectsWhenPresent,
  initializeNavbarBehavior: rendererMocks.initializeNavbarBehavior,
  createRendererMediaResolver: () => () => null,
  prepareClientSiteRenderer: async () => ({ views: new Map() }),
  ClientSitePageRenderer: ({ page, settings }: { page: Page; settings: SiteSettings }) => (
    <main data-testid="rendered-page" data-site-name={settings.siteName}>
      {page.blocks.map((block, index) => (
        <section
          key={("id" in block && typeof block.id === "string") ? block.id : index}
          data-block-index={index}
          data-block-id={("id" in block && typeof block.id === "string") ? block.id : undefined}
        >
          <span data-siab-field="heading">
            {block.blockType === "hero" ? block.heading : block.blockType}
          </span>
        </section>
      ))}
    </main>
  ),
}))

vi.mock("@siteinabox/ui/lib/csp-nonce", () => ({ useCspNonce: () => undefined }))
vi.mock("@siteinabox/ui/lib/csp-style", () => ({
  formatCssPx: (value: number) => `${value}px`,
  useCspStyleRule: () => ({ className: "", styleElement: null }),
}))

import { EditorFrameRuntime } from "@/components/editor-frame/EditorFrameRuntime"

const page = (heading: string): Page => ({
  id: "page-1",
  title: "Home",
  slug: "home",
  updatedAt: "2026-01-01T00:00:00.000Z",
  blocks: [{
    id: "hero-1",
    blockType: "hero",
    variant: "hero-01",
    heading,
    body: "Body",
    primaryAction: { label: "Contact", href: "#contact" },
  }],
})

const settings = (siteName = "Demo"): SiteSettings => ({
  siteName,
  siteUrl: "https://demo.example",
  language: "nl",
  navigation: { primary: [], footer: [] },
})

const snapshot = (input: {
  expectedRevision: number
  page: Page
  settings?: SiteSettings
  selection?: IframeEditorSelection | null
}) => ({
  protocol: IFRAME_EDITOR_PROTOCOL_NAME,
  schemaVersion: IFRAME_EDITOR_PROTOCOL_VERSION,
  type: "render.snapshot" as const,
  messageId: `snapshot-${input.expectedRevision}`,
  expectedRevision: input.expectedRevision,
  pageId: "page-1",
  page: input.page,
  settings: input.settings ?? settings(),
  theme: null,
  selection: input.selection ?? null,
})

const dispatchSnapshot = (message: ReturnType<typeof snapshot>) => {
  window.dispatchEvent(new MessageEvent("message", {
    data: message,
    origin: window.location.origin,
    source: window.parent,
  }))
}

describe("EditorFrameRuntime", () => {
  it("renders page content through the shared renderer without chrome", async () => {
    render(<EditorFrameRuntime page={page("Initial")} settings={settings()} theme={null} tenantId="tenant-1" />)
    await screen.findByText("Initial")
    expect(screen.getByTestId("rendered-page").getAttribute("data-siab-navbar")).toBeNull()
    expect(screen.queryByTestId("rendered-navbar")).toBeNull()
    expect(screen.queryByTestId("rendered-footer")).toBeNull()
  })

  it("updates page and settings snapshots", async () => {
    render(<EditorFrameRuntime page={page("Initial")} settings={settings()} theme={null} tenantId="tenant-1" />)
    await screen.findByText("Initial")

    act(() => {
      dispatchSnapshot(snapshot({ expectedRevision: 0, page: page("Updated"), settings: settings("Updated settings") }))
    })

    await screen.findByText("Updated")
    expect(screen.getByTestId("rendered-page").getAttribute("data-site-name")).toBe("Updated settings")
  })

  it("reveals a selected block and field through the iframe selection protocol", async () => {
    render(<EditorFrameRuntime page={page("Initial")} settings={settings()} theme={null} tenantId="tenant-1" />)
    await screen.findByText("Initial")
    const block = document.querySelector<HTMLElement>('[data-block-id="hero-1"]')!
    const heading = block.querySelector<HTMLElement>('[data-siab-field="heading"]')!

    act(() => {
      dispatchSnapshot(snapshot({
        expectedRevision: 0,
        page: page("Initial"),
        selection: { pageId: "page-1", blockId: "hero-1", fieldPath: ["blocks", "0"] },
      }))
    })
    await waitFor(() => expect(block.getAttribute("data-siab-editor-selected")).toBe("true"))

    act(() => {
      dispatchSnapshot(snapshot({
        expectedRevision: 1,
        page: page("Initial"),
        selection: { pageId: "page-1", blockId: "hero-1", fieldPath: ["blocks", "0", "heading"] },
      }))
    })
    await waitFor(() => expect(heading.getAttribute("data-siab-editor-field-selected")).toBe("true"))
  })
})
