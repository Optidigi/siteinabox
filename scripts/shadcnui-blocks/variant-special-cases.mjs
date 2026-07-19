function replaceAll(contents, from, to) {
  return contents.replaceAll(from, to)
}

function adaptThemeColors(contents, replacements) {
  return replacements.reduce((adapted, [from, to]) => replaceAll(adapted, from, to), contents)
}

function adaptStructuredMediaRegion(contents, from, to) {
  if (!contents.includes(from)) {
    throw new Error(`Expected structured media region markup was not found for replacement: ${from.slice(0, 80)}…`)
  }
  return contents.replace(from, to)
}

function scopeNotFound03SvgIds(contents) {
  return contents
    .replace("<Number4 />", '<Number4 idPrefix="provider-404-first" />')
    .replace("<Number4 />", '<Number4 idPrefix="provider-404-second" />')
    .replace(
      "export const Number4 = (props: SVGProps<SVGSVGElement>) => (",
      'export const Number4 = ({ idPrefix = "provider-404", ...props }: SVGProps<SVGSVGElement> & { idPrefix?: string }) => (',
    )
    .replaceAll('clipPath="url(#cs_clip_1_number-4)"', 'clipPath={`url(#${idPrefix}-clip)`}')
    .replaceAll('id="cs_mask_1_number-4"', 'id={`${idPrefix}-mask`}')
    .replaceAll('mask="url(#cs_mask_1_number-4)"', 'mask={`url(#${idPrefix}-mask)`}')
    .replaceAll('filter="url(#filter0_f_880_3334)"', 'filter={`url(#${idPrefix}-blur)`}')
    .replaceAll('filter="url(#cs_noise_1_number-4)"', 'filter={`url(#${idPrefix}-noise)`}')
    .replaceAll('id="filter0_f_880_3334"', 'id={`${idPrefix}-blur`}')
    .replaceAll('id="cs_clip_1_number-4"', 'id={`${idPrefix}-clip`}')
    .replaceAll('id="cs_noise_1_number-4"', 'id={`${idPrefix}-noise`}')
}

const GRID_LINE_REPLACEMENTS = [
  ["rgba(75, 85, 99, 0.08)", "var(--provider-grid-line, rgba(75, 85, 99, 0.08))"],
  ["rgba(55, 65, 81, 0.12)", "var(--provider-grid-dot, rgba(55, 65, 81, 0.12))"],
]

const BORDER_BEAM_THEME_REPLACEMENTS = [
  ['colorFrom = "#ffaa40"', 'colorFrom = "var(--provider-accent-400, #ffaa40)"'],
  ['colorTo = "#9c40ff"', 'colorTo = "var(--provider-accent-700, #9c40ff)"'],
]

/**
 * Explicit per-variant transforms. Variant upstream names must appear only here
 * (plus catalog metadata tables), never inside generic adaptLiteralImports.
 */
export const VARIANT_SPECIAL_CASES = {
  "contact-02": {
    adaptLiteral({ contents }) {
      return replaceAll(contents, "bg-white shadow-none", "bg-[var(--provider-surface,#fff)] shadow-none")
    },
    generateView({ semantic, namespace }) {
      return [
        'import * as React from "react"',
        'import type { Block } from "@siteinabox/contracts"',
        'import type { BlockRenderOptions } from "../../../../blocks/types"',
        'import { ShadcnUiContactView } from "../../contact-views"',
        `type VariantBlock = Extract<Block, { blockType: "${semantic.blockType}" }>`,
        `export default function View({ block, options }: { block: VariantBlock; options: BlockRenderOptions }) { return <ShadcnUiContactView block={block} options={options} variant="${namespace}.contact-02" /> }`,
        "",
      ].join("\n")
    },
  },
  "features-03": {
    slotOverrides({ variantSlots }) {
      if (variantSlots.features) {
        variantSlots.features = { ...variantSlots.features, minItems: 1, maxItems: 2 }
      }
    },
  },
  "hero-03": {
    composition: { embedsNavigation: true, suppressesChromeAreas: ["header"] },
    skipBindingCompilationForFile(filename) {
      return /^navbar\.(?:ts|tsx)$/.test(filename)
    },
  },
  "hero-08": {
    composition: { embedsNavigation: true, suppressesChromeAreas: ["header"] },
    skipBindingCompilationForFile(filename) {
      return /^navbar\.(?:ts|tsx)$/.test(filename)
    },
  },
  "footer-03": {
    featureAuditExtras({ sourceText = "" } = {}) {
      if (!/(?:<form|type=["']email|type=["']submit)/i.test(sourceText)) return []
      return [{
        feature: "form",
        disposition: "structured-adapter",
        evidence: "Capability-gated footer newsletter contract",
      }]
    },
  },
  "footer-04": {
    featureAuditExtras({ sourceText = "" } = {}) {
      if (!/(?:<form|type=["']email|type=["']submit)/i.test(sourceText)) return []
      return [{
        feature: "form",
        disposition: "structured-adapter",
        evidence: "Capability-gated footer newsletter contract",
      }]
    },
  },
  "navbar-02": {
    featureAuditExtras() {
      return [{
        feature: "theme-toggle",
        disposition: "runtime-derived",
        evidence: "Accessible provider control backed by the shared persisted color-mode runtime",
      }]
    },
  },
  "navbar-03": {
    resolveLiteralFilename(upstreamFilename) {
      return upstreamFilename === "navbar.ts" ? "navbar-data.ts" : upstreamFilename
    },
    adaptLiteral({ contents }) {
      return replaceAll(contents, 'from "./navbar"', 'from "./navbar-data"')
    },
  },
  "not-found-03": {
    adaptLiteral({ contents }) {
      return scopeNotFound03SvgIds(contents)
    },
  },
  "pricing-09": {
    adaptLiteral({ contents, filename }) {
      if (filename !== "border-beam.tsx") return contents
      return adaptThemeColors(contents, BORDER_BEAM_THEME_REPLACEMENTS)
    },
  },
}

export function hasDirectBindings(bindingManifest, upstreamName) {
  return Array.isArray(bindingManifest?.direct?.[upstreamName]) && bindingManifest.direct[upstreamName].length > 0
}

export function shouldPreserveOwnedVariant(bindingManifest, upstreamName) {
  return hasDirectBindings(bindingManifest, upstreamName)
}

export function applyVariantLiteralAdaptations(upstreamName, context) {
  const specialCase = VARIANT_SPECIAL_CASES[upstreamName]
  if (!specialCase?.adaptLiteral) return context.contents
  return specialCase.adaptLiteral({ upstreamName, ...context })
}

export function resolveLiteralFilename(upstreamName, upstreamFilename) {
  const specialCase = VARIANT_SPECIAL_CASES[upstreamName]
  return specialCase?.resolveLiteralFilename?.(upstreamFilename) ?? upstreamFilename
}

export function shouldSkipBindingCompilation(upstreamName, filename, bindingManifest) {
  if (hasDirectBindings(bindingManifest, upstreamName)) return true
  const specialCase = VARIANT_SPECIAL_CASES[upstreamName]
  return specialCase?.skipBindingCompilationForFile?.(filename) ?? false
}

export function getVariantComposition(upstreamName) {
  const specialCase = VARIANT_SPECIAL_CASES[upstreamName]
  return specialCase?.composition ?? { embedsNavigation: false, suppressesChromeAreas: [] }
}

export function applyVariantSlotOverrides(upstreamName, variantSlots) {
  VARIANT_SPECIAL_CASES[upstreamName]?.slotOverrides?.({ variantSlots })
}

export function buildFormFeatureAudit(sourceText, semantic, upstreamName) {
  if (!/(?:<form|type=["']email|type=["']submit)/i.test(sourceText)) return []
  if (semantic.blockType === "contactSection") {
    return [{
      feature: "form",
      disposition: "structured-adapter",
      evidence: "Validated SIAB form provider contract",
    }]
  }
  const variantForm = getVariantFeatureAuditExtras(upstreamName, { sourceText }).filter((entry) => entry.feature === "form")
  if (variantForm.length) return variantForm
  return [{
    feature: "form",
    disposition: "inactive",
    evidence: "Upstream demo capture form is inactive; no arbitrary external submission is retained",
  }]
}

export function getVariantFeatureAuditExtras(upstreamName, context = {}) {
  return VARIANT_SPECIAL_CASES[upstreamName]?.featureAuditExtras?.(context) ?? []
}

export function generateVariantView(upstreamName, { semantic, mainStem, namespace }) {
  const specialCase = VARIANT_SPECIAL_CASES[upstreamName]
  if (specialCase?.generateView) {
    return specialCase.generateView({ semantic, mainStem, namespace })
  }
  return [
    'import * as React from "react"',
    'import type { Block } from "@siteinabox/contracts"',
    'import type { BlockRenderOptions } from "../../../../blocks/types"',
    `import Literal from "./${mainStem}"`,
    'import { LiteralProviderVariantView } from "../../runtime/literal-view"',
    `type VariantBlock = Extract<Block, { blockType: "${semantic.blockType}" }>`,
    `export default function View({ block, options }: { block: VariantBlock; options: BlockRenderOptions }) { return <LiteralProviderVariantView Literal={Literal} model={{ block, options }} variant="${namespace}.${upstreamName}" /> }`,
    '',
  ].join("\n")
}

export const VARIANT_SPECIAL_CASE_IDS = Object.freeze(Object.keys(VARIANT_SPECIAL_CASES).sort())
