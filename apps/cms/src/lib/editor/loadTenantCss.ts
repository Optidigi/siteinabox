import "server-only"
import { promises as fs } from "node:fs"
import { resolve } from "node:path"
import { resolveTenantRenderer } from "@siteinabox/site-renderer/tenant-renderers/resolve"

const DATA_DIR = process.env.DATA_DIR ?? resolve(process.cwd(), ".data-out")

/** The single class the whole tenant stylesheet is scoped under. */
const SCOPE = ".rt-canvas"

/** Document-root selectors that collapse to the scope class itself
 *  (rather than `${SCOPE} html`, which would never match anything). */
const ROOT_SELECTORS = new Set([":root", ":host", "html", "body"])

/** Conditional-group at-rules whose body is a list of style rules we must
 *  recurse into. Everything else (`@font-face`, `@property`, `@keyframes`,
 *  `@page`) has a declaration body — or keyframe selectors — that must be
 *  emitted verbatim. */
const GROUP_AT_RULES = new Set(["media", "supports", "layer", "container", "scope"])

/**
 * Prefix one selector with the scope.
 *  - `:root` / `:host` / `html` / `body` → the scope class itself.
 *  - a selector already starting with the scope → left as-is (idempotent).
 *  - anything else → `${SCOPE} <selector>` (descendant).
 */
const scopeSelector = (sel: string): string => {
  const s = sel.trim()
  if (s === "") return s
  if (ROOT_SELECTORS.has(s)) return SCOPE
  if (s === SCOPE || s.startsWith(`${SCOPE} `) || s.startsWith(`${SCOPE}.`) || s.startsWith(`${SCOPE}:`)) {
    return s
  }
  return `${SCOPE} ${s}`
}

/**
 * Scope a selector list (the prelude of a qualified rule). Splits on
 * top-level commas only (commas inside `()` / `[]` belong to e.g. `:is(...)`
 * or attribute selectors and must not be split), scopes each selector, and
 * de-duplicates so `html, :host` collapses to a single `.rt-canvas`.
 */
const scopeSelectorList = (prelude: string): string => {
  const parts: string[] = []
  let depth = 0
  let buf = ""
  for (let i = 0; i < prelude.length; i++) {
    const ch = prelude[i]
    if (ch === "(" || ch === "[") depth++
    else if (ch === ")" || ch === "]") depth--
    if (ch === "," && depth === 0) {
      parts.push(buf)
      buf = ""
    } else {
      buf += ch
    }
  }
  parts.push(buf)
  const scoped = parts.map(scopeSelector)
  // Dedupe while preserving order (collapses `html, :host, :root` → `.rt-canvas`).
  return [...new Set(scoped)].join(", ")
}

/**
 * Extract all top-level statement-form at-rules with names in `names` (e.g.
 * `@import …;`, `@charset "utf-8";`) from a stylesheet. Block-form at-rules
 * with the same name (none today, but future-proof) are left in place.
 *
 * Walks the source string while skipping string literals and `/* * /`
 * comments, so a `;` inside `url("data:text/css;base64,…")` doesn't
 * terminate the rule prematurely (the bug the old `[^;]*;` regex had).
 */
const extractStatementAtRules = (
  css: string,
  names: ReadonlyArray<string>,
): { extracted: string[]; rest: string } => {
  const lower = names.map((s) => s.toLowerCase())
  const extracted: string[] = []
  let rest = ""
  let i = 0
  const n = css.length

  const skipString = (start: number): number => {
    const q = css[start]
    let j = start + 1
    while (j < n) {
      if (css[j] === "\\") { j = Math.min(j + 2, n); continue }
      if (css[j] === q) { j++; break }
      j++
    }
    return j
  }
  const skipComment = (start: number): number => {
    const end = css.indexOf("*/", start + 2)
    return end === -1 ? n : end + 2
  }

  while (i < n) {
    const ch = css[i]
    if (ch === '"' || ch === "'") { const j = skipString(i); rest += css.slice(i, j); i = j; continue }
    if (ch === "/" && css[i + 1] === "*") { const j = skipComment(i); rest += css.slice(i, j); i = j; continue }

    if (ch === "@") {
      // Read at-keyword.
      let k = i + 1
      while (k < n && /[a-zA-Z-]/.test(css[k] as string)) k++
      const keyword = css.slice(i + 1, k).toLowerCase()
      if (lower.includes(keyword)) {
        // Scan to terminating `;` or block-form `{`, skipping strings + comments.
        let j = k
        let isBlock = false
        while (j < n) {
          const c = css[j]
          if (c === '"' || c === "'") { j = skipString(j); continue }
          if (c === "/" && css[j + 1] === "*") { j = skipComment(j); continue }
          if (c === ";") { j++; break }
          if (c === "{") { isBlock = true; break }
          j++
        }
        if (!isBlock) {
          extracted.push(css.slice(i, j))
          i = j
          continue
        }
      }
    }

    rest += ch
    i++
  }
  return { extracted, rest }
}

/**
 * Recursively scope a stylesheet body (the top level, or the inside of a
 * conditional-group at-rule). Hand-rolled tokeniser — small, dependency-free,
 * and aware of strings/comments so it never mis-splits on a `{`/`}`/`;`/`,`
 * inside `content: "{"` or a `url(data:…)`.
 */
const scopeBlock = (css: string): string => {
  let out = ""
  let i = 0
  const n = css.length

  // Copy a string literal starting at css[i] (css[i] is the quote). Returns
  // the index just past the closing quote.
  const copyString = (start: number): number => {
    const quote = css[start]
    let j = start + 1
    while (j < n) {
      if (css[j] === "\\") { j += 2; continue }
      if (css[j] === quote) { j++; break }
      j++
    }
    out += css.slice(start, j)
    return j
  }

  // Copy a /* … */ comment starting at css[i]. Returns the index past `*/`.
  const copyComment = (start: number): number => {
    const end = css.indexOf("*/", start + 2)
    const j = end === -1 ? n : end + 2
    out += css.slice(start, j)
    return j
  }

  while (i < n) {
    const ch = css[i] as string // guarded by `i < n`

    // Pass through whitespace, comments, and stray semicolons verbatim.
    if (ch === "/" && css[i + 1] === "*") { i = copyComment(i); continue }
    if (ch === '"' || ch === "'") { i = copyString(i); continue }
    if (ch === ";" || ch === "}") { out += ch; i++; continue }
    if (/\s/.test(ch)) { out += ch; i++; continue }

    // We're at the start of a rule. Scan its prelude up to the matching
    // `{` (block rule) or `;` (statement at-rule), skipping strings/comments
    // and nested parens so we don't stop on a `;` inside `url(…)`.
    let j = i
    let parenDepth = 0
    let preludeEnd = -1
    let isStatement = false
    while (j < n) {
      const c = css[j]
      if (c === "/" && css[j + 1] === "*") { j = css.indexOf("*/", j + 2); j = j === -1 ? n : j + 2; continue }
      if (c === '"' || c === "'") {
        const q = c
        j++
        while (j < n) { if (css[j] === "\\") { j += 2; continue } if (css[j] === q) { j++; break } j++ }
        continue
      }
      if (c === "(") parenDepth++
      else if (c === ")") parenDepth--
      else if (parenDepth === 0 && c === "{") { preludeEnd = j; break }
      else if (parenDepth === 0 && c === ";") { preludeEnd = j; isStatement = true; break }
      j++
    }
    if (preludeEnd === -1) { out += css.slice(i); break } // malformed tail — emit as-is

    const prelude = css.slice(i, preludeEnd)

    if (isStatement) {
      // Statement at-rule (e.g. `@layer properties;`) — emit verbatim.
      out += prelude + ";"
      i = preludeEnd + 1
      continue
    }

    // Block rule: find the matching close brace.
    let depth = 1
    let k = preludeEnd + 1
    while (k < n && depth > 0) {
      const c = css[k]
      if (c === "/" && css[k + 1] === "*") { k = css.indexOf("*/", k + 2); k = k === -1 ? n : k + 2; continue }
      if (c === '"' || c === "'") {
        const q = c
        k++
        while (k < n) { if (css[k] === "\\") { k += 2; continue } if (css[k] === q) { k++; break } k++ }
        continue
      }
      if (c === "{") depth++
      else if (c === "}") depth--
      k++
    }
    const body = css.slice(preludeEnd + 1, k - 1)

    const trimmed = prelude.trim()
    if (trimmed.startsWith("@")) {
      const atKeyword = (trimmed.slice(1).split(/[\s({]/, 1)[0] ?? "").toLowerCase()
      if (GROUP_AT_RULES.has(atKeyword)) {
        // Conditional-group at-rule — recurse into the body.
        out += prelude + "{" + scopeBlock(body) + "}"
      } else {
        // @font-face / @property / @keyframes / @page — body is declarations
        // or keyframe selectors; emit verbatim.
        out += prelude + "{" + body + "}"
      }
    } else {
      // Qualified style rule — scope the selector list. The body is emitted
      // verbatim: CSS nesting (`&`, bare nested selectors, nested @supports)
      // all resolve relative to the now-scoped parent, so no recursion needed.
      out += scopeSelectorList(prelude) + " {" + body + "}"
    }
    i = k
  }

  return out
}

/**
 * Pure transformation: takes the raw CSS string of a tenant's compiled bundle
 * and returns the transformed string ready for canvas injection.
 *
 * Extracted so tests can call it synchronously without touching the filesystem.
 * See `loadTenantCss` for the full doc comment.
 */
/**
 * Rewrite relative font/asset URLs in the bundle to absolute URLs against
 * the local CMS tenant-assets route so the browser can fetch them when
 * the bundle is injected into the CMS document.
 *
 * Tailwind v4's compiled output emits `src: url(./files/foo.woff2)` for
 * @fontsource-variable packages. Those URLs resolve against the canvas
 * page URL (e.g. `/sites/<slug>/pages/<id>/files/foo.woff2`) → 404.
 * Rewriting to `/api/tenant-assets/<tenantId>/files/foo.woff2` makes them
 * load from the tenant's on-disk projection — the tenant's CSS build
 * step copies its font files alongside `cms-editor.css` into
 * `DATA_DIR/tenants/<id>/files/`.
 *
 * Skips: protocol-absolute URLs (http://, https://, //) and data: URIs.
 */
const rewriteAssetUrls = (css: string, tenantId: string | number | null): string => {
  if (tenantId == null) return css
  return css.replace(/url\(\s*(['"]?)(\.\.?\/[^'")]+|\/[^'")]+)\1\s*\)/gi, (match, quote, path) => {
    if (path.startsWith("//") || path.startsWith("data:")) return match
    // Already absolute under our route → don't double-prefix.
    if (path.startsWith(`/api/tenant-assets/${tenantId}/`)) return match
    const normalized = path.startsWith("./") ? path.slice(2)
      : path.startsWith("../") ? path.replace(/^(\.\.\/)+/, "")
      : path.startsWith("/") ? path.slice(1)
      : path
    return `url(${quote}/api/tenant-assets/${tenantId}/${normalized}${quote})`
  })
}

const rootFontPx = (css: string): number => {
  const htmlRule = css.match(/(?:^|[{}])\s*html\s*\{[^}]*font-size\s*:\s*([0-9]*\.?[0-9]+)px\b/i)
  const value = htmlRule ? Number(htmlRule[1]) : 16
  return Number.isFinite(value) && value > 0 ? value : 16
}

const formatPx = (value: number): string => {
  const rounded = Math.round(value * 10_000) / 10_000
  const normalized = Object.is(rounded, -0) ? 0 : rounded
  let text = String(normalized)
  if (text.includes(".")) text = text.replace(/0+$/, "").replace(/\.$/, "")
  return `${text}px`
}

const replaceRemUnitsInChunk = (chunk: string, remPx: number): string =>
  chunk.replace(/(?<![\w-])(-?(?:\d+\.?\d*|\.\d+))rem\b(?!\\)/gi, (_match, raw) => {
    return formatPx(Number(raw) * remPx)
  })

const replaceEscapedRemUnitsInChunk = (chunk: string, remPx: number): string =>
  chunk.replace(/\\\[(-?(?:\d+\.?\d*|\.\d+))rem\\\]/gi, (_match, raw) => {
    return `\\[${formatPx(Number(raw) * remPx)}\\]`
  })

const normalizeRemUnits = (css: string, remPx: number): string => {
  if (remPx === 16) return css
  let out = ""
  let i = 0
  const n = css.length

  while (i < n) {
    const ch = css[i]
    if (ch === "/" && css[i + 1] === "*") {
      const end = css.indexOf("*/", i + 2)
      const j = end === -1 ? n : end + 2
      out += css.slice(i, j)
      i = j
      continue
    }
    if (ch === '"' || ch === "'") {
      const quote = ch
      let j = i + 1
      while (j < n) {
        if (css[j] === "\\") { j += 2; continue }
        if (css[j] === quote) { j++; break }
        j++
      }
      out += css.slice(i, j)
      i = j
      continue
    }

    let j = i + 1
    while (j < n) {
      const c = css[j]
      if ((c === "/" && css[j + 1] === "*") || c === '"' || c === "'") break
      j++
    }
    out += replaceEscapedRemUnitsInChunk(replaceRemUnitsInChunk(css.slice(i, j), remPx), remPx)
    i = j
  }

  return out
}

export const __transformForTest = (raw: string, tenantId: string | number | null = null): string => {
  // 1. Hoist @import / @charset lines to the top. We can't use a regex —
  // `@import url("data:text/css;base64,…")` contains `;` inside the URL
  // value, so a `[^;]*;` pattern truncates the rule mid-base64. Walk the
  // source string while skipping string literals and `/* */` comments.
  const { extracted: importLines, rest: body } = extractStatementAtRules(raw, ["import", "charset"])

  // 1b. Drop @import lines the browser can't resolve against the canvas
  // document URL. The raw tenant bundle (pre-OBS-46) contains the source
  // file's own @imports — `@import 'tailwindcss';`, `@import
  // '@fontsource-variable/foo/index.css';`, `@import './rich-text.css';`,
  // etc. Bare module specifiers obviously fail, but path-relative refs
  // fail too: they resolve against the canvas page URL
  // (`/sites/<tenant>/pages/<id>`), not the tenant data dir, so the dev
  // server returns the SPA HTML fallback and the browser rejects the
  // stylesheet with a MIME-type error. Tenant build pipelines concatenate
  // those referenced files into the bundle already, so the @imports are
  // redundant in practice. Keep only refs the browser can actually fetch:
  // http(s):// and data:. Non-`@import` lines (e.g. @charset) are
  // preserved intact.
  const resolvableImports = importLines.filter((line) => {
    if (!line.match(/^\s*@import\b/i)) return true // keep @charset etc. intact
    const m = line.match(/@import\s+(?:url\(\s*)?['"]?([^'")]+)['"]?/i)
    const ref = m?.[1]?.trim()
    if (!ref) return false // unparseable @import — drop rather than risk
    return /^https?:\/\//i.test(ref) || ref.startsWith("data:")
  })

  // 1c. Rewrite top-level `@theme { … }` blocks to `:root { … }` so the
  //     browser treats them as real custom-property declarations. Tailwind v4
  //     uses `@theme` to declare design tokens; browsers ignore the at-rule
  //     entirely, so every `--color-*`, `--font-*`, etc. inside it would be
  //     lost. The existing scopeBlock() already maps `:root` → `.rt-canvas`,
  //     so this single substitution is all that's needed.
  //
  //     We use the same brace-balancing approach as scopeBlock() to handle
  //     nested `{ }` inside values (e.g. `content: "{"`) without mis-parsing.
  //     Only `@theme` at the top level (depth 0 in the walker) is rewritten;
  //     `@theme` nested inside `@media` or another at-rule is left as-is
  //     because it can't produce `:root` declarations anyway.
  const tenantFontDecls: string[] = []
  const tenantColorDecls: string[] = []

  const bodyWithThemeExpanded = (() => {
    let out2 = ""
    let idx = 0
    const src = body
    const len = src.length

    const skipString2 = (start: number): number => {
      const q = src[start]
      let j = start + 1
      while (j < len) {
        if (src[j] === "\\") { j += 2; continue }
        if (src[j] === q) { j++; break }
        j++
      }
      return j
    }

    const skipComment2 = (start: number): number => {
      const end = src.indexOf("*/", start + 2)
      return end === -1 ? len : end + 2
    }

    while (idx < len) {
      const ch = src[idx] as string // guarded by `idx < len`
      // Pass through whitespace verbatim.
      if (/\s/.test(ch)) { out2 += ch; idx++; continue }
      // Pass through comments.
      if (ch === "/" && src[idx + 1] === "*") {
        const end = skipComment2(idx)
        out2 += src.slice(idx, end)
        idx = end
        continue
      }
      // Look for `@theme` (case-insensitive, followed by whitespace or `{`).
      if (ch === "@") {
        const rest = src.slice(idx)
        const m = rest.match(/^@theme(?=[\s{])/i)
        if (m) {
          // Found `@theme` at the top level — scan past the keyword.
          let j = idx + m[0].length
          // Skip optional whitespace between `@theme` and `{`.
          while (j < len && /\s/.test(src[j] as string)) { j++ }
          if (src[j] === "{") {
            // Find the matching `}`, balancing nested braces and skipping strings/comments.
            let depth2 = 1
            let k = j + 1
            while (k < len && depth2 > 0) {
              const c2 = src[k]
              if (c2 === "/" && src[k + 1] === "*") { k = skipComment2(k); continue }
              if (c2 === '"' || c2 === "'") { k = skipString2(k); continue }
              if (c2 === "{") depth2++
              else if (c2 === "}") depth2--
              k++
            }
            // Emit as `:root { … }` instead of `@theme { … }`.
            const themeBody = src.slice(j + 1, k - 1)
            out2 += `:root {${themeBody}}`
            // Also extract --font-* declarations for admin-scope re-emission
            // (so the inspector — outside .rt-canvas — can read tenant fonts
            // through --rt-tenant-font-*). Rename both the declared name and
            // any var() references in the value to the prefixed namespace so
            // they resolve against the admin-scope siblings we'll emit
            // alongside, never against admin's own --font-sans.
            for (const fm of themeBody.matchAll(/(--font-[a-z0-9-]+)\s*:\s*([^;]+);/gi)) {
              const name = (fm[1] as string).replace(/^--font-/, "--rt-tenant-font-")
              const value = (fm[2] as string).trim().replace(/var\(\s*--font-/g, "var(--rt-tenant-font-")
              tenantFontDecls.push(`${name}:${value}`)
            }
            // Also extract --color-* declarations for admin-scope re-emission
            // so editor chips (rendered outside .rt-canvas) can resolve
            // tenant colors via --rt-tenant-color-*. Same pattern as fonts.
            for (const cm of themeBody.matchAll(/(--color-[a-z0-9-]+)\s*:\s*([^;]+);/gi)) {
              const name = (cm[1] as string).replace(/^--color-/, "--rt-tenant-color-")
              const value = (cm[2] as string).trim().replace(/var\(\s*--color-/g, "var(--rt-tenant-color-")
              tenantColorDecls.push(`${name}:${value}`)
            }
            idx = k
            continue
          }
        }
      }
      // Everything else (non-@theme rules, other at-rules) — copy one char and
      // let scopeBlock() handle the full rule processing below.
      out2 += ch
      idx++
    }
    return out2
  })()

  // 2. Scope every style rule under .rt-canvas.
  const scopedBody = scopeBlock(bodyWithThemeExpanded)

  const header = resolvableImports.length ? resolvableImports.join("\n") + "\n" : ""
  const tenantFontHeader = tenantFontDecls.length
    ? `:root{${tenantFontDecls.join(";")}}\n`
    : ""
  const tenantColorHeader = tenantColorDecls.length
    ? `:root{${tenantColorDecls.join(";")}}\n`
    : ""
  const remPx = rootFontPx(raw)
  const finalBody = rewriteAssetUrls(normalizeRemUnits(scopedBody, remPx), tenantId)
  const finalHeader = rewriteAssetUrls(header, tenantId)
  return `${finalHeader}${tenantFontHeader}${tenantColorHeader}/* tenant CSS — every rule scoped under ${SCOPE} */\n${finalBody}`
}

/**
 * Load a tenant's COMPILED CSS bundle (Tailwind-compiled — utilities resolved,
 * design tokens as `:root` custom properties, fonts as `@font-face`) and
 * transform it for safe injection into the canvas surface:
 *
 *   1. Hoist `@import` / `@charset` to the top — they're illegal anywhere else.
 *   2. Scope EVERY style rule under `.rt-canvas`. This is two-way isolation:
 *        - tenant utility classes (`.rounded-full`, `.border`, …) and tokens
 *          no longer leak out and clobber the CMS admin's identically-named
 *          classes;
 *        - the canvas no longer inherits the CMS admin's tokens (e.g. the
 *          admin's yellow `--ring`), so it renders purely in the tenant theme.
 *      `:root` / `:host` / `html` / `body` collapse to `.rt-canvas` itself;
 *      every other selector becomes `.rt-canvas <selector>`. Conditional-group
 *      at-rules (`@media`, `@supports`, `@layer`, `@container`) are recursed
 *      into; `@font-face` / `@property` / `@keyframes` are left global (they
 *      are registrations, not visual rules, and are harmless out of scope).
 *
 * Returns null if absent — caller falls back to admin form-mode styles.
 */
export type CanvasTenantCssContext = {
  id: string | number
  slug?: string | null
  domain?: string | null
}

/**
 * Loads scoped tenant canvas CSS for generated/self-serve tenants.
 * Tenant renderers (Amicare) use bundled site-renderer styles instead of the
 * compiled `cms-editor.css` artifact under `DATA_DIR/tenants/<id>/`.
 */
export const loadCanvasTenantCss = async (
  tenant: CanvasTenantCssContext,
): Promise<string | null> => {
  if (resolveTenantRenderer({ tenantSlug: tenant.slug, domain: tenant.domain })) {
    return null
  }
  return loadTenantCss(tenant.id)
}

export const loadTenantCss = async (
  tenantId: string | number,
): Promise<string | null> => {
  const path = resolve(DATA_DIR, "tenants", String(tenantId), "cms-editor.css")
  let raw: string
  try {
    raw = await fs.readFile(path, "utf-8")
  } catch (e: any) {
    if (e?.code === "ENOENT") return null
    console.error("[tenantCss] read error", { tenantId, error: e?.message })
    return null
  }
  return __transformForTest(raw, tenantId)
}

/** Exported for unit testing the scoping transform in isolation. */
export const __scopeTenantCssForTest = scopeBlock
