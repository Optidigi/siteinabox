import * as React from "react"
import type { ThemeTokenSpec } from "@siteinabox/contracts"
import { themeAttributeProps } from "./attributes"

export * from "./color-mode"
export * from "./attributes"

export function ThemeCanvas({ theme, ...props }: React.HTMLAttributes<HTMLDivElement> & { theme?: ThemeTokenSpec | null }) {
  return <div {...props} {...themeAttributeProps(theme)} />
}
