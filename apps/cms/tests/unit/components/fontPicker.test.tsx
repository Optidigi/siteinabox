/**
 * @vitest-environment jsdom
 */
import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { FontPicker } from "@/components/editor/theme/font-picker"
import { FONT_PRESETS } from "@/lib/theme/presets"

describe("FontPicker", () => {
  it("restores the generated font set from the Generated Style row", () => {
    const generatedFonts = {
      title: "Fraunces Variable",
      heading: "Fraunces Variable",
      text: "Inter Variable",
      script: "Caveat Variable",
    }
    const onChange = vi.fn()

    render(
      <FontPicker
        fonts={FONT_PRESETS}
        value={generatedFonts}
        manifest={{ version: 1 } as any}
        onChange={onChange}
      />,
    )

    fireEvent.click(screen.getByRole("button", { name: "Apply Clear Modern font preset" }))
    expect(onChange).toHaveBeenLastCalledWith({
      title: "Inter Variable",
      heading: "Inter Variable",
      text: "Inter Variable",
    })

    fireEvent.click(screen.getByRole("button", { name: "Apply Generated Style font preset" }))
    expect(onChange).toHaveBeenLastCalledWith(generatedFonts)
  })
})
