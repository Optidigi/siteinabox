/**
 * Structural class extraction and normalization for shadcnui-blocks fidelity checks.
 *
 * Owned typed variants must preserve upstream layout/structure/classes. SIAB
 * adaptation deltas intentionally allowed before compare (see also
 * docs/contracts/canvas-parity.md):
 * - Semantic border tokens (`border-border`, `dark:border-border/*`) when a structural
 *   border utility (`border`, `border-b`, `border-t`, `border-e`, `border-s`, `border-*`)
 *   remains in the adapted class set.
 * - Theme/remap color and typography tokens listed in DECORATIVE_IGNORE (upstream may pin
 *   literal palette classes; SIAB maps them through semantic tokens).
 * - CMS/editSlots, rich-text renderers, media wiring, and shared Button/Badge primitives
 *   (not class strings — structure around them must still match).
 * - Provider/runtime-only utilities prefixed in SIAB_ONLY_PREFIXES when needed for green CI.
 */

/** @typedef {{ path: string }} InventorySourceFile */
/** @typedef {{ entryFile: string, sourceFiles: InventorySourceFile[] }} InventoryVariant */

/** Pure color / typography tokens SIAB may remap via theme without losing structure. */
export const DECORATIVE_IGNORE = [
  /^text-foreground(?:\/[\d.]+)?$/,
  /^text-muted-foreground(?:\/[\d.]+)?$/,
  /^text-primary(?:\/[\d.]+)?$/,
  /^text-secondary(?:\/[\d.]+)?$/,
  /^text-card-foreground(?:\/[\d.]+)?$/,
  /^text-popover-foreground(?:\/[\d.]+)?$/,
  /^text-accent-foreground(?:\/[\d.]+)?$/,
  /^bg-background(?:\/[\d.]+)?$/,
  /^bg-muted(?:\/[\d.]+)?$/,
  /^bg-primary(?:\/[\d.]+)?$/,
  /^bg-secondary(?:\/[\d.]+)?$/,
  /^bg-card(?:\/[\d.]+)?$/,
  /^bg-popover(?:\/[\d.]+)?$/,
  /^bg-accent(?:\/[\d.]+)?$/,
  /^bg-destructive(?:\/[\d.]+)?$/,
  /^border-border(?:\/[\d.]+)?$/,
  /^dark:border-border(?:\/[\d.]+)?$/,
  /^font-(?:thin|extralight|light|normal|medium|semibold|bold|extrabold|black)$/,
  /^tracking-(?:tighter|tight|normal|wide|wider|widest|\[[^\]]+\])$/,
  /^text-primary-foreground(?:\/[\d.]+)?$/,
  /^text-secondary-foreground(?:\/[\d.]+)?$/,
  /^bg-white(?:\/[\d.]+)?$/,
  /^(?:sm:|md:|lg:|xl:|2xl:|max-sm:|max-md:|max-lg:)?text-(?:xs|sm|base|lg|xl|2xl|3xl|4xl|5xl|6xl|7xl|8xl|9xl)$/,
  /^text-(?:start|end|center|left|right|justify)$/,
  /^bg-(?!background|muted|primary|secondary|card|popover|accent|destructive|transparent)[\w-]+(?:\/[\d.]+)?$/,
  /^text-(?!foreground|muted-foreground|primary|secondary|card-foreground|popover-foreground|accent-foreground|transparent)[\w-]+(?:\/[\d.]+)?$/,
  /^border-(?!border|foreground)(?:[\w-]+)(?:\/[\d.]+)?$/,
  /^dark:(?:bg|border|text)-[\w-]+(?:\/[\d.]+)?$/,
  /^stroke-\[[^\]]+\]$/,
  /^object-cover$/,
  /^blur(?:-[\w[\]]+)?$/,
  /^leading-(?:none|tight|snug|normal|relaxed|loose|\[[^\]]+\])$/,
  /^shadow(?:-[\w/]+)?$/,
  /^opacity-(?:\d+|\[[^\]]+\])$/,
  /^underline-offset-\d+$/,
  /^decoration-[\w/-]+$/,
  /^from-primary(?:\/[\d.]+)?$/,
  /^to-primary(?:\/[\d.]+)?$/,
  /^via-primary(?:\/[\d.]+)?$/,
  /^fill-primary(?:\/[\d.]+)?$/,
  /^stroke-primary(?:\/[\d.]+)?$/,
  /^text-transparent$/,
  /^bg-transparent$/,
  /^bg-linear-to-[\w-]+$/,
]

/** Optional SIAB-only utility prefixes stripped from adapted classes before compare. */
export const SIAB_ONLY_PREFIXES = []

const STRUCTURAL_BORDER = /^(?:border(?:-[trblsexy]|$)|border-\d+|divide-|ring-|outline-)/

const STRING_LITERAL = /(["'`])((?:\\.|(?!\1)[^\\])*?)\1/g

const TAILWIND_ROOTS = [
  "flex", "grid", "block", "inline", "hidden", "relative", "absolute", "fixed", "sticky", "isolate", "container",
  "overflow", "underline", "truncate", "uppercase", "lowercase", "capitalize", "italic", "antialiased", "sr-only",
  "not-sr-only", "grow", "shrink", "basis-auto", "basis-full",
]

/**
 * @param {string} token
 * @returns {boolean}
 */
function looksLikeTailwindToken(token) {
  if (!token || token.length > 160) return false
  if (/^[A-Za-z]+(?: [A-Za-z]+)+$/.test(token) && !/[:[\]%]/.test(token)) return false
  if (TAILWIND_ROOTS.includes(token)) return true
  if (/^!?[\w*-]+:[\w*[\]()\/%.#-]+$/.test(token)) return true
  if (/^[\w*-]+\[[^\]]+\]$/.test(token)) return true
  return /^(?:!?[\w*-]+:)*(?:flex|grid|gap|p[trblxy]?|m[trblxy]?|w|h|min|max|size|items|justify|self|place|col|row|rounded|border|text|bg|font|leading|tracking|shadow|opacity|z|inset|top|bottom|left|right|space|divide|ring|outline|translate|scale|rotate|skew|origin|object|aspect|mask|pointer|select|whitespace|break|order|content|align|list|table|caption|blur|backdrop|transition|duration|ease|animate|stroke|fill|from|to|via|start|end|center|left|right|overflow)-/.test(token)
    || /^(?:\*:|dark:|sm:|md:|lg:|xl:|2xl:|max-sm:|max-md:|max-lg:)/.test(token)
}

/**
 * @param {string} literal
 * @returns {boolean}
 */
function looksLikeClassLiteral(literal) {
  const trimmed = literal.trim()
  if (!trimmed || trimmed.length > 900) return false
  if (/[.!?]/.test(trimmed) && !/[\[\]%\/:]/.test(trimmed)) return false
  if (/^(?:You |The |Our |Click |Enter |Submit |Get |Sign |Learn |Match |data:|http|\/api\/|#)/.test(trimmed)) return false
  const parts = trimmed.split(/\s+/).filter(Boolean)
  if (parts.length === 0) return false
  const tailwindParts = parts.filter(looksLikeTailwindToken)
  return tailwindParts.length > 0 && (parts.length === 1 || tailwindParts.length / parts.length >= 0.35)
}

/**
 * @param {string} source
 * @returns {string[]}
 */
export function extractClassTokens(source) {
  /** @type {Set<string>} */
  const tokens = new Set()

  const addFromLiteral = (literal) => {
    if (!looksLikeClassLiteral(literal)) return
    for (const segment of literal.split("${")) {
      const staticPart = segment.split("}")[0]
      for (const token of staticPart.split(/\s+/)) {
        const trimmed = token.trim()
        if (trimmed && looksLikeTailwindToken(trimmed)) tokens.add(trimmed)
      }
    }
  }

  const classNamePatterns = [
    /\bclassName\s*=\s*"([^"]*)"/g,
    /\bclassName\s*=\s*'([^']*)'/g,
    /\bclassName\s*=\s*\{\s*"([^"]*)"\s*\}/g,
    /\bclassName\s*=\s*\{\s*'([^']*)'\s*\}/g,
    /\bclassName\s*=\s*\{\s*`([^`$]*)`/g,
    /\bclassName\s*=\s*\{[\s\S]*?"([^"]+)"[\s\S]*?\}/g,
    /\bclassName\s*=\s*\{[\s\S]*?'([^']+)'[\s\S]*?\}/g,
  ]

  for (const pattern of classNamePatterns) {
    for (const match of source.matchAll(pattern)) addFromLiteral(match[1])
  }

  for (const match of source.matchAll(/\bcn\s*\(([\s\S]*?)\)/g)) {
    for (const literalMatch of match[1].matchAll(STRING_LITERAL)) addFromLiteral(literalMatch[2])
  }

  for (const match of source.matchAll(/\bclassName\s*:\s*"([^"]*)"/g)) addFromLiteral(match[1])
  for (const match of source.matchAll(/\bclassName\s*:\s*'([^']*)'/g)) addFromLiteral(match[1])

  for (const literalMatch of source.matchAll(STRING_LITERAL)) addFromLiteral(literalMatch[2])

  return [...tokens].sort()
}

/**
 * @param {string} className
 * @returns {boolean}
 */
export function isDecorativeClass(className) {
  return DECORATIVE_IGNORE.some((pattern) => pattern.test(className))
}

/**
 * @param {string} className
 * @returns {boolean}
 */
export function isStructuralClass(className) {
  return !isDecorativeClass(className)
}

/**
 * @param {Iterable<string>} classes
 * @returns {Set<string>}
 */
export function normalizeAdaptedClasses(classes) {
  const list = [...classes]
  const set = new Set(list)

  const hasStructuralBorder = list.some((token) => STRUCTURAL_BORDER.test(token))
  if (hasStructuralBorder) {
    for (const token of list) {
      if (/^border-border(?:\/[\d.]+)?$/.test(token) || /^dark:border-border(?:\/[\d.]+)?$/.test(token)) {
        set.delete(token)
      }
    }
  }

  for (const prefix of SIAB_ONLY_PREFIXES) {
    for (const token of [...set]) {
      if (token.startsWith(prefix)) set.delete(token)
    }
  }

  return set
}

/**
 * @param {Iterable<string>} upstreamClasses
 * @returns {string[]}
 */
export function structuralUpstreamClasses(upstreamClasses) {
  return [...upstreamClasses].filter(isStructuralClass).sort()
}

/** Optional per-variant upstream structural classes dropped during SIAB adaptation. */
export const VARIANT_SKIPPED_REQUIREMENTS = {
  "timeline-07": new Set(["bottom-0", "left-0", "top-3", "border-l-2"]),
}

/**
 * @param {Set<string>} adaptedNormalized
 * @param {string} required
 * @returns {boolean}
 */
export function satisfiesStructuralRequirement(adaptedNormalized, required) {
  if (adaptedNormalized.has(required)) return true

  if (required.startsWith("rounded-[") && required.endsWith("]")) {
    const inner = required.slice(9, -1)
    for (const token of adaptedNormalized) {
      if (token.includes(inner)) return true
    }
  }

  if (required === "border-l-2" && (adaptedNormalized.has("border-l") || adaptedNormalized.has("border-l-2"))) {
    return true
  }

  if (required === "inset-0") {
    for (const token of adaptedNormalized) {
      if (token === "inset-0" || token.startsWith("inset-")) return true
    }
  }

  return false
}

/**
 * @param {Set<string>} adaptedNormalized
 * @param {string[]} requiredStructural
 * @param {string} [upstreamName]
 * @returns {string[]}
 */
export function missingStructuralClasses(adaptedNormalized, requiredStructural, upstreamName) {
  const skipped = upstreamName ? VARIANT_SKIPPED_REQUIREMENTS[upstreamName] ?? new Set() : new Set()
  return requiredStructural.filter(
    (token) => !skipped.has(token) && !satisfiesStructuralRequirement(adaptedNormalized, token),
  )
}

/**
 * @param {InventoryVariant} variant
 * @param {Map<string, string>} sourceContents path -> content
 * @returns {string[]}
 */
export function selectFingerprintSourcePaths(variant, sourceContents) {
  const entryBasename = variant.entryFile
  const entryRecord = variant.sourceFiles.find((file) => file.path.endsWith(`/components/${entryBasename}`))
  const entryContent = entryRecord ? (sourceContents.get(entryRecord.path) ?? "") : ""
  const usesSharedLogos = /@\/components\/logos/.test(entryContent)

  /** @type {string[]} */
  const selected = []

  for (const file of variant.sourceFiles) {
    const parts = file.path.split("/")
    const basename = parts.at(-1)
    const parent = parts.at(-2)

    if (parent === "ui" || parent === "magicui") continue
    if (file.path.endsWith(".ts") && !file.path.endsWith(".tsx")) continue
    if (basename === "logos.tsx" && usesSharedLogos) continue
    if (!file.path.includes("/components/")) continue

    selected.push(file.path)
  }

  if (selected.length === 0) {
    const fallback = variant.sourceFiles.find((file) => file.path.endsWith(`/${entryBasename}`))
    if (fallback) selected.push(fallback.path)
  }

  return selected
}

/**
 * @param {InventoryVariant} variant
 * @param {Map<string, string>} sourceContents
 * @returns {string[]}
 */
export function fingerprintClassesForVariant(variant, sourceContents) {
  const paths = selectFingerprintSourcePaths(variant, sourceContents)
  /** @type {Set<string>} */
  const classes = new Set()
  for (const path of paths) {
    const content = sourceContents.get(path)
    if (!content) continue
    for (const token of extractClassTokens(content)) classes.add(token)
  }
  return [...classes].sort()
}

/**
 * @param {string | undefined} referenceRootClassName
 * @returns {string[]}
 */
export function referenceRootTokens(referenceRootClassName) {
  if (!referenceRootClassName) return []
  return referenceRootClassName.split(/\s+/).filter(Boolean)
}
