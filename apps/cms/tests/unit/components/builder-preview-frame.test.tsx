/** @vitest-environment jsdom */
import { act, cleanup, render, screen } from "@testing-library/react"
import { NextIntlClientProvider } from "next-intl"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { BuilderShell } from "@/components/builder/BuilderShell"
import messages from "@/locales/en.json"

vi.mock("@/lib/actions/requestBuilderMagicLink", () => ({ signOutBuilderAction: vi.fn() }))
beforeEach(() => {
  vi.stubGlobal("matchMedia", () => ({ matches: true, addEventListener() {}, removeEventListener() {} }))
  Object.defineProperty(HTMLElement.prototype, "scrollTo", { configurable: true, value: vi.fn() })
})
afterEach(() => { cleanup(); sessionStorage.clear(); vi.unstubAllGlobals() })

function mount() {
  render(<NextIntlClientProvider locale="en" messages={{ auth: messages.auth, common: messages.common }}>
    <BuilderShell email="owned@example.test" initialMessages={[]} initialFacts={null} initialClientSlug="one" />
  </NextIntlClientProvider>)
  const frame = screen.getByTitle(messages.auth.workspacePreview) as HTMLIFrameElement
  const send = (type: string, extra = {}) => act(() => {
    window.dispatchEvent(new MessageEvent("message", { origin: window.location.origin, source: frame.contentWindow,
      data: { protocol: "siab.iframe-editor", schemaVersion: 3, messageId: "test", type,
        ...(type === "renderer.ready" ? { rendererId: "owned-frame" } : {}), ...extra } }))
  })
  return { frame, send }
}

describe("owned builder preview frame", () => {
  it("lets the server select the supported default page", () => {
    const { frame } = mount()
    expect(frame.getAttribute("src")).toBe("/renderer-frame/preview/one?rev=0")
  })
  it("keeps an already-ready document ready during fragment navigation", () => {
    const { frame, send } = mount()
    send("renderer.ready")
    expect(frame.parentElement?.getAttribute("aria-busy")).toBe("false")
    send("navigation.requested", { href: "/#services" })
    expect(frame.getAttribute("src")).toContain("#services")
    expect(frame.parentElement?.getAttribute("aria-busy")).toBe("false")
    send("navigation.requested", { href: "/contact" })
    expect(frame.parentElement?.getAttribute("aria-busy")).toBe("true")
  })
})
