/** @vitest-environment jsdom */
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react"
import { NextIntlClientProvider } from "next-intl"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { MobilePageEditorShell } from "@/components/editor/iframe/MobilePageEditorShell"
import messages from "@/locales/en.json"

describe("mobile editor keyboard navigation", () => {
  beforeEach(() => {
    vi.stubGlobal("matchMedia", vi.fn(() => ({ matches: false })))
    vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockReturnValue(390)
    // Smooth scrolling begins on a later browser frame, not during the click.
    Object.defineProperty(HTMLElement.prototype, "scrollTo", { configurable: true, value: vi.fn() })
  })
  afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals() })

  it("moves keyboard focus only after the requested inspector pane settles", () => {
    const { container } = render(
      <NextIntlClientProvider locale="en" messages={{ common: messages.common, editor: messages.editor }}>
        <MobilePageEditorShell preview={<input aria-label="Preview" />} inspector={<input aria-label="Title" />}
          agent={null} onExit={() => {}} selected={null} save={{ pending: false }} />
      </NextIntlClientProvider>,
    )
    const pager = container.querySelector<HTMLElement>("[data-siab-editor-pager]")!
    const inspector = container.querySelector<HTMLElement>('[data-editor-pane="inspector"]')!
    const preview = container.querySelector<HTMLElement>('[data-editor-pane="preview"]')!
    const edit = screen.getByRole("button", { name: messages.common.edit })
    edit.focus()
    fireEvent.click(edit)
    expect(document.activeElement).toBe(edit)
    act(() => { pager.scrollLeft = 410; fireEvent.scroll(pager) })
    expect(document.activeElement).toBe(edit)
    act(() => { pager.scrollLeft = 780; fireEvent.scroll(pager); fireEvent(pager, new Event("scrollend")) })
    expect(document.activeElement).toBe(inspector)
    expect(preview.hasAttribute("inert")).toBe(true)
    expect(inspector.hasAttribute("inert")).toBe(false)
  })
})
