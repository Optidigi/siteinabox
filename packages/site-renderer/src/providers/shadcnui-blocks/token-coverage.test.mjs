import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { readFile } from "node:fs/promises"
import { basename, resolve } from "node:path"
import test from "node:test"

const root = resolve(import.meta.dirname, "../../../../..")
const providerRoot = resolve(import.meta.dirname)
const inventory = JSON.parse(await readFile(resolve(providerRoot, "inventory.json"), "utf8"))
const policyBuffer = await readFile(resolve(providerRoot, "token-exceptions.json"))
const policy = JSON.parse(policyBuffer.toString("utf8"))
const sha256 = (value) => `sha256:${createHash("sha256").update(value).digest("hex")}`

const fixedPalette = /\b(?:bg|text|border|ring|fill|stroke|from|via|to)-(?:white|black|slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)(?:-[0-9]{2,3})?(?:\/[0-9]{1,3})?/g
const hexColor = /#[0-9a-fA-F]{3,8}\b/g
const fixedColorFunction = /(?:rgba?|oklch)\(\s*\d[^)]*\)/g
const fixedPaletteVariable = /var\(--color-(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-[0-9]{2,3}\)/g
const fixedSvgPaint = /(?:fill|stroke)=["'](?:black|white|gray|red|orange|yellow|green|blue|purple|pink)["']/g
const arbitraryRadius = /rounded-\[[^\]]+\]/g
const semanticColor = /\b(?:bg|text|border|ring|fill|stroke|from|via|to)-(?:background|foreground|card|popover|primary|secondary|muted|accent|destructive|success|warning|rating|chart-[1-5]|border|input|ring|overlay|on-media)(?:\b|\/)/
const isPalette = (value) => new RegExp(fixedPalette.source).test(value) || new RegExp(fixedPaletteVariable.source).test(value)

const findings = (source) => {
  const audited = source.replace(/var\(--provider-[^,]+,\s*[^)]+\)/g, "")
  return [...new Set([
  ...(audited.match(fixedPalette) ?? []),
  ...(audited.match(hexColor) ?? []),
  ...(audited.match(fixedColorFunction) ?? []),
  ...(audited.match(fixedPaletteVariable) ?? []),
  ...(audited.match(fixedSvgPaint) ?? []),
  ...(audited.match(arbitraryRadius) ?? []).filter((value) => !value.includes("inherit") && !value.includes("var(--siab-radius-") && !value.includes("var(--radius-") && !value.includes("var(--provider-radius-")),
])]
}

const patternMatches = (pattern, value) => new RegExp(`^(?:${pattern.replaceAll("*", ".*")})$`).test(value)
const matchingException = (entries, variant, file, value) => entries.find((entry) =>
  (!entry.variant || entry.variant === variant) &&
  (!entry.variantPattern || patternMatches(entry.variantPattern, variant)) &&
  entry.file === file &&
  (entry.values === "*" || entry.values.includes(value)),
)

test("all 156 variants use semantic tenant tokens or one exact intentional visual exception", async () => {
  assert.equal(inventory.variants.length, 156)
  assert.equal(policy.provider, inventory.provider)
  assert.equal(inventory.tokenExceptions.path, "packages/site-renderer/src/providers/shadcnui-blocks/token-exceptions.json")
  assert.equal(inventory.tokenExceptions.sha256, sha256(policyBuffer))
  const used = new Set()

  for (const variant of inventory.variants) {
    let combined = ""
    for (const file of variant.adaptedFiles) {
      const source = await readFile(resolve(root, file.path), "utf8")
      combined += source
      for (const value of findings(source)) {
        const exception = matchingException(policy.exceptions, variant.upstreamName, basename(file.path), value)
        if (exception) used.add(exception)
        else assert.ok(isPalette(value), `${variant.upstreamName}/${basename(file.path)} has unexplained fixed visual value ${value}`)
      }
      assert.doesNotMatch(source, /font-\[(?!var\(--siab-font-)[^\]]+\]/, `${variant.upstreamName}/${basename(file.path)} bypasses the canonical font roles`)
      assert.doesNotMatch(source, /fontFamily\s*:\s*["'](?!var\(--siab-font-)/, `${variant.upstreamName}/${basename(file.path)} has a fixed inline font family`)
      assert.doesNotMatch(source, /borderRadius\s*:\s*(?:["'](?!var\(--siab-radius-)|\d)/, `${variant.upstreamName}/${basename(file.path)} has a fixed inline radius`)
    }
    if (!variant.upstreamName.startsWith("logo-cloud-")) {
      assert.ok(semanticColor.test(combined) || isPalette(combined), `${variant.upstreamName} has no token-addressable color utility`)
    }
  }
  for (const exception of policy.exceptions) assert.ok(used.has(exception), `Stale token exception: ${exception.variant ?? exception.variantPattern}/${exception.file}`)
})

test("provider primitives use the same token boundary and only structural exceptions", async () => {
  const used = new Set()
  for (const primitive of inventory.compatibilityPrimitives) {
    if (!primitive.path.endsWith(".tsx")) continue
    const source = await readFile(resolve(root, primitive.path), "utf8")
    for (const value of findings(source)) {
      const exception = matchingException(policy.primitiveExceptions, undefined, basename(primitive.path), value)
      if (exception) used.add(exception)
      else assert.ok(isPalette(value), `${primitive.name} has unexplained fixed visual value ${value}`)
    }
  }
  for (const exception of policy.primitiveExceptions) assert.ok(used.has(exception), `Stale primitive token exception: ${exception.file}`)
})

test("theme CSS exposes exact role variables without rewriting literal provider classes", async () => {
  const styles = await readFile(resolve(root, "packages/site-renderer/src/styles.css"), "utf8")
  const cssVars = await readFile(resolve(root, "packages/site-renderer/src/theme/css-vars.ts"), "utf8")
  const resolver = await readFile(resolve(root, "packages/site-renderer/src/theme/resolve.ts"), "utf8")
  for (const role of ["sm", "md", "lg", "xl", "2xl", "3xl", "4xl"]) {
    assert.match(styles, new RegExp(`--radius-${role}: var\\(--siab-radius-${role}\\)`))
    assert.match(cssVars, new RegExp(`--siab-radius-${role}`))
  }
  for (const token of ["destructive", "success", "warning", "rating", "chart-1", "chart-2", "chart-3", "chart-4", "chart-5", "overlay", "on-media"]) {
    assert.match(styles, new RegExp(`--color-${token}: var\\(--${token}\\)`))
    assert.match(cssVars, new RegExp(`--${token}`))
  }
  for (const role of ["body", "heading", "display", "mono"]) assert.match(cssVars, new RegExp(`--siab-font-${role}`))
  for (const family of ["gray", "neutral", "blue", "indigo", "purple", "red", "amber", "green", "emerald"]) assert.match(cssVars, new RegExp(`\\b${family}\\b`))
  assert.match(cssVars, /--provider-surface/)
  assert.match(resolver, /Nunito Variable/)
  assert.doesNotMatch(resolver, /Avenir|Segoe UI/)
})
