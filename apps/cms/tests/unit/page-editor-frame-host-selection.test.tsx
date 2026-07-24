/** @vitest-environment jsdom */
import * as React from "react"
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import type { Page, SiteSettings } from "@siteinabox/contracts"
import {
  IFRAME_EDITOR_PROTOCOL_NAME,
  IFRAME_EDITOR_PROTOCOL_VERSION,
  type IframeEditorSelection,
} from "@siteinabox/contracts/iframe-editor"
import { PageEditorFrameHost } from "@/components/editor/iframe/PageEditorFrameHost"

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}))

type WireBlock = Page["blocks"][number] & { id?: string }
type WirePage = Omit<Page, "blocks"> & { blocks: WireBlock[] }

const page: WirePage = {
  id: "page-1",
  title: "Home",
  slug: "home",
  updatedAt: "2026-01-01T00:00:00.000Z",
  blocks: [
    {
      id: "a",
      blockType: "hero",
      designVariant: "shadcnui-blocks.hero-01",
      headline: { t: "root", variant: "inline", children: [{ t: "text", v: "A" }] },
    },
    {
      id: "b",
      blockType: "hero",
      designVariant: "shadcnui-blocks.hero-01",
      headline: { t: "root", variant: "inline", children: [{ t: "text", v: "B" }] },
    },
  ],
}

const settings: SiteSettings = {
  siteName: "Demo",
  siteUrl: "https://demo.example",
  language: "nl",
}

const selection = (index: number, blockId: string): IframeEditorSelection => ({
  pageId: "page-1",
  blockId,
  fieldPath: ["blocks", String(index)],
})

function Harness() {
  const [selected, setSelected] = React.useState<IframeEditorSelection | null>(null)
  const [revealSelection, setRevealSelection] = React.useState(true)
  return (
    <>
      <button type="button" onClick={() => {
        setRevealSelection(true)
        setSelected(selection(0, "a"))
      }}>Select A</button>
      <button type="button" onClick={() => {
        setRevealSelection(false)
        setSelected({
          ...selection(1, "b"),
          fieldPath: ["blocks", "1", "headline"],
        })
      }}>Select B field without reveal</button>
      <output data-testid="selected-block">{selected?.blockId ?? ""}</output>
      <PageEditorFrameHost
        pageId="page-1"
        page={page}
        settings={settings}
        theme={null}
        tenantId="tenant-1"
        selection={selected}
        revealSelection={revealSelection}
        onSelectionChanged={setSelected}
      />
    </>
  )
}

describe("PageEditorFrameHost selection origin", () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("reveals parent selection and echoes canvas selection without reveal", async () => {
    const { container } = render(<Harness />)
    const frame = container.querySelector("iframe")!
    const frameWindow = frame.contentWindow!
    const postMessage = vi.spyOn(frameWindow, "postMessage").mockImplementation(() => undefined)

    act(() => {
      window.dispatchEvent(new MessageEvent("message", {
        origin: window.location.origin,
        source: frameWindow,
        data: {
          protocol: IFRAME_EDITOR_PROTOCOL_NAME,
          schemaVersion: IFRAME_EDITOR_PROTOCOL_VERSION,
          type: "renderer.ready",
          messageId: "ready",
          rendererId: "test-frame",
          pageId: "page-1",
        },
      }))
    })
    await waitFor(() => expect(postMessage).toHaveBeenCalled())

    fireEvent.click(screen.getByRole("button", { name: "Select A" }))
    await waitFor(() => {
      const messages = postMessage.mock.calls.map(([message]) => message)
      expect(messages.some((message) =>
        typeof message === "object"
        && message != null
        && "type" in message
        && message.type === "render.snapshot"
        && "selection" in message
        && (message.selection as IframeEditorSelection | null)?.blockId === "a"
        && "revealSelection" in message
        && message.revealSelection === true,
      )).toBe(true)
    })

    postMessage.mockClear()
    fireEvent.click(screen.getByRole("button", { name: "Select B field without reveal" }))
    await waitFor(() => {
      const fieldSnapshot = postMessage.mock.calls
        .map(([message]) => message)
        .find((message) =>
          typeof message === "object"
          && message != null
          && "type" in message
          && message.type === "render.snapshot"
          && "selection" in message
          && (message.selection as IframeEditorSelection | null)?.fieldPath?.[2] === "headline",
        )
      expect(fieldSnapshot).toBeTruthy()
      expect(fieldSnapshot).not.toHaveProperty("revealSelection")
    })

    postMessage.mockClear()
    act(() => {
      window.dispatchEvent(new MessageEvent("message", {
        origin: window.location.origin,
        source: frameWindow,
        data: {
          protocol: IFRAME_EDITOR_PROTOCOL_NAME,
          schemaVersion: IFRAME_EDITOR_PROTOCOL_VERSION,
          type: "selection.changed",
          messageId: "canvas-b",
          selection: selection(1, "b"),
        },
      }))
    })

    await waitFor(() => expect(screen.getByTestId("selected-block").textContent).toBe("b"))
    await waitFor(() => {
      const canvasEcho = postMessage.mock.calls
        .map(([message]) => message)
        .find((message) =>
          typeof message === "object"
          && message != null
          && "type" in message
          && message.type === "render.snapshot"
          && "selection" in message
          && (message.selection as IframeEditorSelection | null)?.blockId === "b",
        )
      expect(canvasEcho).toBeTruthy()
      expect(canvasEcho).not.toHaveProperty("revealSelection")
    })
  })
})
