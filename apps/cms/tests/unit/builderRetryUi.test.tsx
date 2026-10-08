// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { BuilderShell } from "@/components/builder/BuilderShell"
import type { ComponentProps } from "react"

vi.mock("@/lib/actions/requestBuilderMagicLink", () => ({ signOutBuilderAction: vi.fn() }))
vi.mock("@/components/builder/BuilderThemeToggle", () => ({ BuilderThemeToggle: () => null }))
vi.mock("@/components/builder/useBuilderMobilePager", async () => {
  const React = await import("react")
  return { useBuilderMobilePager: () => ({ pagerRef: React.useRef(null), pane: "chat", paging: false, scrollToPane: vi.fn() }) }
})

beforeEach(() => {
  sessionStorage.clear()
  vi.stubGlobal("matchMedia", vi.fn(() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() })))
  Object.defineProperty(HTMLElement.prototype, "scrollTo", { configurable: true, value: vi.fn() })
})
afterEach(() => { cleanup(); vi.unstubAllGlobals() })
// Session renewal is separate from counted model dispatch in these UI tests.
const installBuilderTransport = (dispatch: (url: string, init?: RequestInit) => unknown) => {
  vi.stubGlobal("fetch", (url: string, init?: RequestInit) => url === "/api/siab-auth/preview-renew"
    ? Promise.resolve(Response.json({ ok: true }))
    : dispatch(url, init))
}
const props: ComponentProps<typeof BuilderShell> = { email: "ui-fixture@example.test", initialMessages: [], initialFacts: null, initialClientSlug: null, initialRemaining: 12 }

describe("real builder retry and quota UI", () => {
  it("uses the selected language for the mobile opener and send button", () => {
    installBuilderTransport(vi.fn())
    render(<BuilderShell {...props} locale="en" />)
    expect(screen.queryByText("Wat gaan we bouwen?")).toBeNull()
    expect(screen.getByRole("button", { name: "Send" })).toBeTruthy()
    expect(screen.getAllByText("What shall we build?")).toHaveLength(2)
  })
  it("retry after network failure sends the unchanged UUID, message and language", async () => {
    const dispatch = vi.fn().mockRejectedValueOnce(new Error("connection lost")).mockResolvedValueOnce(new Response(JSON.stringify({ ok: true, text: "What does your bakery offer?", messages: [{ role: "user", text: "Build a bakery" }, { role: "assistant", text: "What does your bakery offer?" }], quota: { remaining: 11 } }), { headers: { "content-type": "application/json" } }))
    installBuilderTransport(dispatch)
    render(<BuilderShell {...props} locale="en" />)
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "Build a bakery" } })
    fireEvent.submit(screen.getByRole("textbox").closest("form")!)
    await screen.findByText("The request has not completed. Retry the same request.")
    fireEvent.click(screen.getByRole("button", { name: "Retry the same request" }))
    await screen.findByText("What does your bakery offer?")
    expect(dispatch).toHaveBeenCalledTimes(2)
    const first: unknown = JSON.parse(dispatch.mock.calls[0]?.[1].body)
    const second: unknown = JSON.parse(dispatch.mock.calls[1]?.[1].body)
    expect(first).toEqual(second)
    expect(first).toMatchObject({ message: "Build a bakery", locale: "en", operationId: expect.any(String) })
    expect(screen.getByText("Builder turns remaining: 11")).toBeTruthy()
    expect(sessionStorage.getItem("siab-builder-pending:ui-fixture@example.test")).toBeNull()
  })
  it("restores pending operation after reload without granting a new credit", async () => {
    const operation = { operationId: "552ae921-0dd9-4c4b-9477-56df7a38bbee", message: "Maak een bakkerij", locale: "nl" }
    sessionStorage.setItem("siab-builder-pending:ui-fixture@example.test", JSON.stringify(operation))
    const dispatch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: "operation_pending", quota: { remaining: 11 } }), { status: 202 }))
    installBuilderTransport(dispatch)
    render(<BuilderShell {...props} />)
    fireEvent.click(await screen.findByRole("button", { name: "Probeer dezelfde aanvraag opnieuw" }))
    await screen.findByText("Deze aanvraag wordt nog verwerkt. Je kunt de status opnieuw opvragen.")
    expect(JSON.parse(dispatch.mock.calls[0]?.[1].body)).toEqual(operation)
    expect(sessionStorage.getItem("siab-builder-pending:ui-fixture@example.test")).toBeTruthy()
  })
  it("exhausted allowance retains preview and checkout while denying another turn", async () => {
    const dispatch = vi.fn()
    installBuilderTransport(dispatch)
    render(<BuilderShell {...props} initialRemaining={0} initialClientSlug="fixture" locale="en" />)
    await waitFor(() => expect(screen.getByRole("textbox").hasAttribute("disabled")).toBe(true))
    expect(screen.getByRole("link", { name: "Go live" }).getAttribute("href")).toBe("/fixture/checkout")
    expect(screen.getByTitle("Website preview")).toBeTruthy()
    expect(screen.getByText("You have used your 12 builder turns. Your preview and checkout remain available.")).toBeTruthy()
    expect(dispatch).not.toHaveBeenCalled()
  })
})
