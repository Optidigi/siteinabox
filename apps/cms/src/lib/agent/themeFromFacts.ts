import { DEFAULT_THEME_TOKEN_SPEC, type ThemeTokenSpec } from "@siteinabox/contracts"
import type { BuilderFacts } from "@/lib/builder/facts"

export const themeTokenSpecFromFacts = (facts: BuilderFacts): ThemeTokenSpec => ({
  version: 3,
  appearance: {
    mode: facts.appearanceMode,
    backgroundMode: DEFAULT_THEME_TOKEN_SPEC.appearance.backgroundMode,
  },
  colors: { schemeId: facts.colorSchemeId },
  fonts: { schemeId: facts.fontSchemeId },
  shape: { schemeId: facts.shapeSchemeId },
})
