/** @vitest-environment jsdom */
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { Button } from "@siteinabox/ui/components/button"

afterEach(() => { cleanup(); vi.useRealTimers() })

describe("shared button pointer and keyboard behavior", () => {
  it.each(["mouse", "pen", ""])('preserves keyboard focus and releases %s pointer focus', pointerType => {
    vi.useFakeTimers()
    render(<Button>Save</Button>)
    const button = screen.getByRole("button", { name: "Save" })
    button.focus()
    const event = new Event("pointerup", { bubbles: true })
    Object.defineProperty(event, "pointerType", { value: pointerType })
    fireEvent(button, event)
    act(() => vi.runAllTimers())
    expect(document.activeElement === button).toBe(pointerType === "")
  })
  it("honors a caller that cancels pointer blur", () => {
    vi.useFakeTimers()
    const onPointerUp = vi.fn((event: React.PointerEvent<HTMLButtonElement>) => event.preventDefault())
    render(<Button onPointerUp={onPointerUp}>Save</Button>)
    const button = screen.getByRole("button", { name: "Save" })
    button.focus()
    const event = new Event("pointerup", { bubbles: true, cancelable: true })
    Object.defineProperty(event, "pointerType", { value: "mouse" })
    fireEvent(button, event)
    act(() => vi.runAllTimers())
    expect(onPointerUp).toHaveBeenCalledOnce()
    expect(document.activeElement).toBe(button)
  })
  it("forwards a slotted child's caller handler without adding native button behavior", () => {
    vi.useFakeTimers()
    const onPointerUp = vi.fn()
    render(<Button asChild onPointerUp={onPointerUp}><a href="/settings">Settings</a></Button>)
    const link = screen.getByRole("link", { name: "Settings" })
    link.focus()
    const event = new Event("pointerup", { bubbles: true })
    Object.defineProperty(event, "pointerType", { value: "mouse" })
    fireEvent(link, event)
    act(() => vi.runAllTimers())
    expect(onPointerUp).toHaveBeenCalledOnce()
    expect(document.activeElement).toBe(link)
    expect(screen.queryByRole("button")).toBeNull()
  })
})
