import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"
import bindings from "../packages/site-renderer/src/providers/shadcnui-blocks/bindings.json" with { type: "json" }
import { adaptLiteralImports } from "./shadcnui-blocks/adapt-literal.mjs"
import {
  VARIANT_SPECIAL_CASE_IDS,
  VARIANT_SPECIAL_CASES,
  applyVariantLiteralAdaptations,
  hasDirectBindings,
  shouldSkipBindingCompilation,
} from "./shadcnui-blocks/variant-special-cases.mjs"
import { assertScaffoldAllowed, buildTypedScaffold } from "./shadcnui-blocks/scaffold-typed.mjs"

const VARIANT_NAME_PATTERN = /\b(?:hero|cta|faq|features|contact|pricing|logo-cloud|navbar|footer|not-found)-\d{2}\b/g

test("generic adaptLiteralImports has no variant-id branches", async () => {
  const source = await readFile(new URL("./shadcnui-blocks/adapt-literal.mjs", import.meta.url), "utf8")
  const matches = source.match(VARIANT_NAME_PATTERN) ?? []
  assert.deepEqual(matches, [], `variant names in generic adapter: ${matches.join(", ")}`)
})

test("variant special-case table is the only transform module with variant-id branches", async () => {
  const modules = [
    "./shadcnui-blocks/adapt-literal.mjs",
    "./shadcnui-blocks/compile-bindings.mjs",
    "./shadcnui-blocks/import.mjs",
  ]
  for (const modulePath of modules) {
    const source = await readFile(new URL(modulePath, import.meta.url), "utf8")
    const matches = source.match(VARIANT_NAME_PATTERN) ?? []
    assert.deepEqual(matches, [], `${modulePath} must not contain variant-id branches (${matches.join(", ")})`)
  }
  const specialCases = await readFile(new URL("./shadcnui-blocks/variant-special-cases.mjs", import.meta.url), "utf8")
  for (const variantId of VARIANT_SPECIAL_CASE_IDS) {
    assert.match(specialCases, new RegExp(`"${variantId}"`), `special-case table missing ${variantId}`)
  }
})

test("direct-binding variants skip compileBlockBindings", () => {
  for (const upstreamName of Object.keys(bindings.direct ?? {})) {
    assert.equal(
      shouldSkipBindingCompilation(upstreamName, "cta.tsx", bindings),
      true,
      `${upstreamName} must skip binding compilation`,
    )
  }
  assert.equal(shouldSkipBindingCompilation("hero-01", "hero.tsx", bindings), true)
  assert.equal(shouldSkipBindingCompilation("hero-03", "navbar.tsx", bindings), true)
})

test("applyVariantLiteralAdaptations delegates only through the special-case table", () => {
  const input = "background: rgba(75, 85, 99, 0.08)"
  const adapted = applyVariantLiteralAdaptations("pricing-09", {
    contents: input,
    filename: "pricing.tsx",
    isEntryFile: false,
  })
  assert.match(adapted, /var\(--provider-grid-line/)
  assert.equal(
    applyVariantLiteralAdaptations("hero-01", { contents: input, filename: "hero.tsx", isEntryFile: false }),
    input,
  )
})

test("buildTypedScaffold emits generic-normalized literal and typed skeleton without ProviderField injection", () => {
  const upstreamLiteral = `"use client"
import Link from "next/link"
export default function Hero() {
  return <section><h1>Hello</h1><Link href="#">Go</Link></section>
}`
  const scaffold = buildTypedScaffold({
    upstreamName: "hero-99",
    blockType: "hero",
    mainStem: "hero.tsx",
    directFields: ["headline", "primary"],
    upstreamLiteral,
  })
  assert.match(scaffold.files["upstream-literal.tsx"], /runtime\/link/)
  assert.doesNotMatch(scaffold.files["hero.tsx"], /from ["'].*runtime\/content["']/)
  assert.doesNotMatch(scaffold.files["hero.tsx"], /<ProviderField\b/)
  assert.match(scaffold.files["view.tsx"], /providerBlockAttributes/)
  assert.match(scaffold.files["../../typed/fixtures/hero-99.ts"], /hero99Literal/)
})

test("assertScaffoldAllowed rejects typed pilots and direct bindings without force", () => {
  assert.throws(
    () => assertScaffoldAllowed(bindings, "cta-01"),
    /already a typed pilot/i,
  )
  assert.throws(
    () => assertScaffoldAllowed(bindings, "features-03"),
    /already a typed pilot/i,
  )
  assert.throws(
    () => assertScaffoldAllowed(bindings, "hero-02"),
    /already a typed pilot/i,
  )
  assert.doesNotThrow(() => assertScaffoldAllowed(bindings, "pricing-01"))
})

test("hasDirectBindings mirrors bindings.direct manifest", () => {
  assert.equal(hasDirectBindings(bindings, "faq-01"), true)
  assert.equal(hasDirectBindings(bindings, "hero-01"), true)
  assert.deepEqual(Object.keys(VARIANT_SPECIAL_CASES).sort(), VARIANT_SPECIAL_CASE_IDS)
})
