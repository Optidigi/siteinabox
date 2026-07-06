/**
 * @vitest-environment jsdom
 */
import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { FontPicker } from "@/components/editor/theme/font-picker"
import { FONT_PRESETS } from "@/lib/theme/presets"

describe("FontPicker", () => {
  it("renders only fixed font presets and saves scheme IDs", () => {
    const onChange = vi.fn()
    render(<FontPicker fonts={FONT_PRESETS} value={undefined} onChange={onChange} />)

    expect(screen.getAllByRole("button")).toHaveLength(3)
    expect(screen.queryByText("Generated Style")).toBeNull()

    fireEvent.click(screen.getByRole("button", { name: "Apply Classic Editorial font preset" }))
    expect(onChange).toHaveBeenLastCalledWith({ schemeId: "classic-editorial" })
  })
})
