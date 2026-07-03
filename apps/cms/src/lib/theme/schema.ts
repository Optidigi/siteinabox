import { z } from "zod"

// Pragmatic CSS color validator. Accepts:
//   hex:      #rgb | #rrggbb | #rrggbbaa
//   functions: rgb() | rgba() | hsl() | hsla() | oklch() | color()
//   keywords:  transparent | currentColor | inherit | initial | unset
//              plus any single alphabetic CSS named color (e.g. "red", "blue", "aliceblue")
//
// Rejects anything that doesn't match these patterns — "not-a-color" fails
// because it contains a hyphen and is not a CSS color function.
//
// Regex breakdown:
//   ^(#[0-9a-fA-F]{3,8})          — hex shorthand or full 3/4/6/8 digit
//   |(oklch|color|rgb[a]?|hsl[a]?)\(.*\)  — function forms (loose content, we just need the form)
//   |[a-zA-Z]+$                    — single word (named colors, currentColor, transparent, etc.)
const CSS_COLOR_REGEX =
  /^(#[0-9a-fA-F]{3,8}|(oklch|color|rgb[a]?|hsl[a]?)\(.*\)|[a-zA-Z]+)$/

const cssColor = z.string().regex(CSS_COLOR_REGEX, {
  message:
    "Must be a valid CSS color — hex (#fff, #ff0000), function (rgb(), hsl(), oklch()), or named keyword",
})

const STYLE_PRESET_REGEX = /^[a-z0-9-]+$/

export const themeSchema = z
  .object({
    palette: z
      .object({
        accent: cssColor.optional(),
        bg: cssColor.optional(),
        ink: cssColor.optional(),
        muted: cssColor.optional(),
      })
      .strict()
      .optional(),
    darkPalette: z
      .object({
        accent: cssColor.optional(),
        bg: cssColor.optional(),
        ink: cssColor.optional(),
        muted: cssColor.optional(),
      })
      .strict()
      .optional(),
    fonts: z
      .object({
        title: z.string().optional(),
        heading: z.string().optional(),
        text: z.string().optional(),
        script: z.string().optional(),
      })
      .strict()
      .optional(),
    radius: z.string().optional(),
    density: z.enum(["compact", "comfortable", "spacious"]).optional(),
    stylePreset: z.string().regex(STYLE_PRESET_REGEX).optional(),
    borderStyle: z.enum(["solid", "dashed", "none"]).optional(),
    mode: z.enum(["light", "dark"]).optional(),
  })
  .strict()

export type ThemeTokens = z.infer<typeof themeSchema>
