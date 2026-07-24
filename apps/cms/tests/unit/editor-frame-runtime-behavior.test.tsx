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
  }: {
    page: Page
    settings: SiteSettings
  }) => (
    <main className="site-frame-root" data-testid="rendered-page" data-site-name={settings.siteName}>
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
})

describe("EditorFrameRuntime reveal intent", () => {
  const scrolled: Element[] = []

  beforeEach(() => {
    scrolled.length = 0
    Object.defineProperty(globalThis, "CSS", {
      configurable: true,
      value: { escape: (value: string) => value },
    })
    Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
      configurable: true,
      value: vi.fn(function (this: Element) {
        scrolled.push(this)
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

    act(() => {
      dispatchSnapshot(snapshot({
        expectedRevision: 1,
        page: page("A"),
        selection: null,
      }))
    })
    await waitFor(() => expect(blockA.hasAttribute("data-siab-editor-selected")).toBe(false))
    scrolled.length = 0

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
