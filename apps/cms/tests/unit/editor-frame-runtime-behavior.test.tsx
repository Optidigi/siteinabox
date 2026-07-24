/** @vitest-environment jsdom */
import * as React from "react"
import { act, render, screen, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import {
  DEFAULT_THEME_TOKEN_SPEC,
  type Page,
  type SiteSettings,
} from "@siteinabox/contracts"
import {
  IFRAME_EDITOR_PROTOCOL_NAME,
  IFRAME_EDITOR_PROTOCOL_VERSION,
  type IframeEditorSelection,
} from "@siteinabox/contracts/iframe-editor"

const rendererMocks = vi.hoisted(() => ({
  applyThemeAttributes: vi.fn(() => () => undefined),
}))

vi.mock("@siteinabox/site-renderer", () => ({
  applyThemeAttributes: rendererMocks.applyThemeAttributes,
  createRendererMediaResolver: () => () => null,
  prepareClientSiteRenderer: async () => ({ views: new Map() }),
  ClientSitePageRenderer: ({
    page,
    settings,
    banner,
  }: {
    page: Page
    settings: SiteSettings
    banner?: React.ReactNode
  }) => (
    <main className="site-frame-root" data-testid="rendered-page" data-site-name={settings.siteName}>
      {banner === undefined && settings.chrome?.banner?.message
        ? <aside data-testid="rendered-banner">{settings.chrome.banner.message}</aside>
        : banner}
      <header data-site-chrome="header">Header</header>
      {page.blocks.map((block, index) => (
        <section
          key={("id" in block && typeof block.id === "string") ? block.id : index}
          data-block-index={index}
          data-block-id={("id" in block && typeof block.id === "string") ? block.id : undefined}
        >
          <span data-siab-field="headline">
            {block.blockType === "hero"
              ? block.headline.children.map((child) => child.t === "text" ? child.v : "").join("")
              : block.blockType}
          </span>
        </section>
      ))}
    </main>
  ),
}))

vi.mock("@siteinabox/ui/lib/csp-nonce", () => ({
  useCspNonce: () => undefined,
}))

vi.mock("@siteinabox/ui/lib/csp-style", () => ({
  formatCssPx: (value: number) => `${value}px`,
  useCspStyleRule: () => ({ className: "", styleElement: null }),
}))

import { EditorFrameRuntime } from "@/components/editor-frame/EditorFrameRuntime"

type WireBlock = Page["blocks"][number] & { id?: string }
type WirePage = Omit<Page, "blocks"> & { blocks: WireBlock[] }

const inlineText = (value: string) => ({
  t: "root" as const,
  variant: "inline" as const,
  children: [{ t: "text" as const, v: value }],
})

const page = (first: string, second = "B"): WirePage => ({
  id: "page-1",
  title: "Home",
  slug: "home",
  updatedAt: "2026-01-01T00:00:00.000Z",
  blocks: [
    {
      id: "a",
      blockType: "hero",
      designVariant: "shadcnui-blocks.hero-01",
      headline: inlineText(first),
    },
    {
      id: "b",
      blockType: "hero",
      designVariant: "shadcnui-blocks.hero-01",
      headline: inlineText(second),
    },
  ],
})

const settings = (siteName = "Demo"): SiteSettings => ({
  siteName,
  siteUrl: "https://demo.example",
  language: "nl",
})

const selection = (index: number, blockId: string): IframeEditorSelection => ({
  pageId: "page-1",
  blockId,
  fieldPath: ["blocks", String(index)],
})

function snapshot(input: {
  expectedRevision: number
  page: unknown
  settings?: SiteSettings
  theme?: typeof DEFAULT_THEME_TOKEN_SPEC | null
  selection?: IframeEditorSelection | null
  revealSelection?: boolean
}) {
  return {
    protocol: IFRAME_EDITOR_PROTOCOL_NAME,
    schemaVersion: IFRAME_EDITOR_PROTOCOL_VERSION,
    type: "render.snapshot",
    messageId: `snapshot-${input.expectedRevision}`,
    expectedRevision: input.expectedRevision,
    pageId: "page-1",
    page: input.page,
    settings: input.settings ?? settings(),
    theme: input.theme ?? null,
    selection: input.selection ?? null,
    ...(input.revealSelection ? { revealSelection: true } : {}),
  }
}

function dispatchSnapshot(message: ReturnType<typeof snapshot>) {
  window.dispatchEvent(new MessageEvent("message", {
    data: message,
    origin: window.location.origin,
    source: window,
  }))
}

describe("EditorFrameRuntime live snapshots", () => {
  beforeEach(() => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined)
    Object.defineProperty(globalThis, "CSS", {
      configurable: true,
      value: { escape: (value: string) => value },
    })
    Object.defineProperty(document, "fonts", {
      configurable: true,
      value: { ready: Promise.resolve() },
    })
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
      callback(0)
      return 1
    })
    vi.spyOn(window, "cancelAnimationFrame").mockImplementation(() => undefined)
  })

  afterEach(() => {
    vi.restoreAllMocks()
    rendererMocks.applyThemeAttributes.mockClear()
  })

  it("applies valid settings and theme independently, then recovers page content", async () => {
    render(
      <EditorFrameRuntime
        page={page("Initial")}
        settings={settings()}
        theme={null}
        tenantId="tenant-1"
      />,
    )
    await screen.findByText("Initial")

    act(() => {
      dispatchSnapshot(snapshot({
        expectedRevision: 0,
        page: {
          title: "Home",
          slug: "home",
          updatedAt: "2026-01-01T00:00:00.000Z",
          blocks: [{ id: "bad", blockType: "hero" }],
        },
        settings: settings("Changed settings"),
        theme: DEFAULT_THEME_TOKEN_SPEC,
      }))
    })

    await waitFor(() => {
      expect(screen.getByTestId("rendered-page").getAttribute("data-site-name")).toBe("Changed settings")
    })
    expect(screen.getByText("Initial")).toBeTruthy()
    expect(rendererMocks.applyThemeAttributes).toHaveBeenCalledWith(document, DEFAULT_THEME_TOKEN_SPEC)
    expect(console.warn).toHaveBeenCalled()

    act(() => {
      dispatchSnapshot(snapshot({
        expectedRevision: 1,
        page: page("Recovered"),
        settings: settings("Changed settings"),
        theme: DEFAULT_THEME_TOKEN_SPEC,
      }))
    })

    await screen.findByText("Recovered")
  })

  it("omits settings-owned banners while page and settings snapshots keep updating", async () => {
    const settingsWithBanner = (siteName: string, message: string): SiteSettings => ({
      ...settings(siteName),
      chrome: {
        banner: {
          variant: "shadcnui-blocks.banner-01",
          visible: true,
          message,
        },
      },
    })

    render(
      <EditorFrameRuntime
        page={page("Initial")}
        settings={settingsWithBanner("Initial settings", "Initial announcement")}
        theme={null}
        tenantId="tenant-1"
      />,
    )

    await screen.findByText("Initial")
    expect(screen.queryByTestId("rendered-banner")).toBeNull()

    act(() => {
      dispatchSnapshot(snapshot({
        expectedRevision: 0,
        page: page("Updated"),
        settings: settingsWithBanner("Updated settings", "Updated announcement"),
      }))
    })

    await screen.findByText("Updated")
    expect(screen.getByTestId("rendered-page").getAttribute("data-site-name")).toBe("Updated settings")
    expect(screen.queryByTestId("rendered-banner")).toBeNull()
  })
})

describe("EditorFrameRuntime reveal intent", () => {
  const scrolled: Element[] = []
  const scrollOptions: Array<ScrollIntoViewOptions | boolean | undefined> = []

  beforeEach(() => {
    scrolled.length = 0
    scrollOptions.length = 0
    Object.defineProperty(globalThis, "CSS", {
      configurable: true,
      value: { escape: (value: string) => value },
    })
    Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
      configurable: true,
      value: vi.fn(function (
        this: Element,
        options?: ScrollIntoViewOptions | boolean,
      ) {
        scrolled.push(this)
        scrollOptions.push(options)
      }),
    })
    Object.defineProperty(document, "fonts", {
      configurable: true,
      value: { ready: Promise.resolve() },
    })
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
      callback(0)
      return 1
    })
    vi.spyOn(window, "cancelAnimationFrame").mockImplementation(() => undefined)
    vi.spyOn(console, "warn").mockImplementation(() => undefined)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("centers intentional parent reveals for blocks, fields, and chrome", async () => {
    render(
      <EditorFrameRuntime
        page={page("A")}
        settings={settings()}
        theme={null}
        tenantId="tenant-1"
      />,
    )
    await screen.findByText("A")
    const blockA = document.querySelector<HTMLElement>('[data-block-id="a"]')!
    const headline = blockA.querySelector<HTMLElement>('[data-siab-field="headline"]')!
    const header = document.querySelector<HTMLElement>('[data-site-chrome="header"]')!

    act(() => {
      dispatchSnapshot(snapshot({
        expectedRevision: 0,
        page: page("A"),
        selection: selection(0, "a"),
        revealSelection: true,
      }))
    })
    await waitFor(() => expect(scrolled).toEqual([blockA]))

    act(() => {
      dispatchSnapshot(snapshot({
        expectedRevision: 1,
        page: page("A"),
        selection: {
          ...selection(0, "a"),
          fieldPath: ["blocks", "0", "headline"],
        },
        revealSelection: true,
      }))
    })
    await waitFor(() => expect(scrolled).toEqual([blockA, headline]))

    act(() => {
      dispatchSnapshot(snapshot({
        expectedRevision: 2,
        page: page("A"),
        selection: {
          pageId: "page-1",
          fieldPath: ["chrome", "header"],
        },
        revealSelection: true,
      }))
    })
    await waitFor(() => expect(scrolled).toEqual([blockA, headline, header]))
    expect(scrollOptions).toEqual([
      { behavior: "smooth", block: "center" },
      { behavior: "smooth", block: "center" },
      { behavior: "smooth", block: "center" },
    ])
  })

  it("replaces a block highlight with a field highlight without scrolling when reveal is omitted", async () => {
    render(
      <EditorFrameRuntime
        page={page("A")}
        settings={settings()}
        theme={null}
        tenantId="tenant-1"
      />,
    )
    await screen.findByText("A")
    const blockA = document.querySelector<HTMLElement>('[data-block-id="a"]')!
    const blockB = document.querySelector<HTMLElement>('[data-block-id="b"]')!
    const headlineB = blockB.querySelector<HTMLElement>('[data-siab-field="headline"]')!

    act(() => {
      dispatchSnapshot(snapshot({
        expectedRevision: 0,
        page: page("A"),
        selection: selection(0, "a"),
        revealSelection: true,
      }))
    })
    await waitFor(() => expect(blockA.getAttribute("data-siab-editor-selected")).toBe("true"))

    scrolled.length = 0
    scrollOptions.length = 0
    document.documentElement.scrollTop = 23
    const parentScrollBefore = window.scrollY

    act(() => {
      dispatchSnapshot(snapshot({
        expectedRevision: 1,
        page: page("A"),
        selection: {
          ...selection(1, "b"),
          fieldPath: ["blocks", "1", "headline"],
        },
      }))
    })

    await waitFor(() => {
      expect(blockA.hasAttribute("data-siab-editor-selected")).toBe(false)
      expect(blockB.hasAttribute("data-siab-editor-selected")).toBe(false)
      expect(headlineB.getAttribute("data-siab-editor-field-selected")).toBe("true")
    })
    expect(scrolled).toEqual([])
    expect(scrollOptions).toEqual([])
    expect(document.documentElement.scrollTop).toBe(23)
    expect(window.scrollY).toBe(parentScrollBefore)
  })

  it("reveals parent selection but never consumes stale reveal intent for a canvas click", async () => {
    render(
      <EditorFrameRuntime
        page={page("A")}
        settings={settings()}
        theme={null}
        tenantId="tenant-1"
      />,
    )
    await screen.findByText("A")
    const blockA = document.querySelector<HTMLElement>('[data-block-id="a"]')!
    const blockB = document.querySelector<HTMLElement>('[data-block-id="b"]')!

    act(() => {
      dispatchSnapshot(snapshot({
        expectedRevision: 0,
        page: page("A"),
        selection: selection(0, "a"),
        revealSelection: true,
      }))
    })
    await waitFor(() => expect(scrolled).toEqual([blockA]))
    expect(scrollOptions).toEqual([{ behavior: "smooth", block: "center" }])

    act(() => {
      dispatchSnapshot(snapshot({
        expectedRevision: 1,
        page: page("A"),
        selection: null,
      }))
    })
    await waitFor(() => expect(blockA.hasAttribute("data-siab-editor-selected")).toBe(false))
    scrolled.length = 0
    scrollOptions.length = 0

    const frameScrollBefore = document.documentElement.scrollTop
    const parentScrollBefore = window.scrollY
    act(() => {
      dispatchSnapshot(snapshot({
        expectedRevision: 2,
        page: page("A"),
        selection: selection(0, "a"),
        revealSelection: true,
      }))
      blockB.dispatchEvent(new MouseEvent("click", { bubbles: true }))
    })

    await waitFor(() => {
      expect(blockB.getAttribute("data-siab-editor-selected")).toBe("true")
    })
    expect(scrolled).toEqual([])

    act(() => {
      dispatchSnapshot(snapshot({
        expectedRevision: 3,
        page: page("A"),
        selection: selection(1, "b"),
      }))
    })
    expect(scrolled).toEqual([])
    expect(scrollOptions).toEqual([])
    expect(document.documentElement.scrollTop).toBe(frameScrollBefore)
    expect(window.scrollY).toBe(parentScrollBefore)

    act(() => {
      dispatchSnapshot(snapshot({
        expectedRevision: 4,
        page: {
          title: "Home",
          slug: "home",
          updatedAt: "2026-01-01T00:00:00.000Z",
          blocks: [{ id: "bad", blockType: "hero" }],
        },
        selection: selection(1, "b"),
      }))
    })
    expect(scrolled).toEqual([])
  })
})
