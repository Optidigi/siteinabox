import assert from "node:assert/strict"
import { readdir, readFile } from "node:fs/promises"
import test from "node:test"
import inventory from "./inventory.json" with { type: "json" }
import fingerprints from "./structural-fingerprints.json" with { type: "json" }
import {
  extractClassTokens,
  missingStructuralClasses,
  normalizeAdaptedClasses,
  referenceRootTokens,
  structuralUpstreamClasses,
} from "./structural-classes.mjs"

const variantsRoot = new URL("./variants/", import.meta.url)

/** Upstream names used by apps/cms mock Provider Smoke generation pages. */
const PROVIDER_SMOKE_UPSTREAM_NAMES = [
  "hero-01", "logo-cloud-01", "features-01", "stats-01", "testimonials-01", "blog-01", "cta-01",
  "hero-02", "features-02", "pricing-01", "timeline-01", "stats-02", "faq-01", "cta-02",
  "hero-03", "features-03", "timeline-02", "stats-03", "team-01", "testimonials-02", "cta-03",
  "hero-04", "logo-cloud-02", "carousel-block-01", "testimonials-03", "team-02", "blog-02", "cta-04",
  "hero-05", "features-04", "pricing-02", "faq-02", "team-03", "contact-02", "cta-05",
]

/**
 * @param {string} upstreamName
 * @returns {Promise<{ missing: string[], adaptedClasses: Set<string> }>}
 */
async function compareVariantStructuralClasses(upstreamName) {
  const variant = inventory.variants.find((entry) => entry.upstreamName === upstreamName)
  assert.ok(variant, `inventory missing ${upstreamName}`)
  const fingerprint = fingerprints.variants[upstreamName]
  assert.ok(fingerprint, `fingerprint missing ${upstreamName}`)

  const variantDir = new URL(`${upstreamName}/`, variantsRoot)
  const entries = await readdir(variantDir, { withFileTypes: true })
  /** @type {Set<string>} */
  const adaptedClasses = new Set()

  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith(".tsx") || entry.name === "view.tsx") continue
    const source = await readFile(new URL(entry.name, variantDir), "utf8")
    for (const token of extractClassTokens(source)) adaptedClasses.add(token)
  }

  const adaptedNormalized = normalizeAdaptedClasses(adaptedClasses)
  const requiredStructural = [
    ...structuralUpstreamClasses(fingerprint.classes),
    ...structuralUpstreamClasses(referenceRootTokens(variant.referenceRootClassName)),
  ]
  const uniqueRequired = [...new Set(requiredStructural)]
  return {
    missing: missingStructuralClasses(adaptedNormalized, uniqueRequired, upstreamName),
    adaptedClasses,
  }
}

test("structural fingerprints match pinned inventory commit", () => {
  assert.equal(fingerprints.provider, inventory.provider)
  assert.equal(fingerprints.commit, inventory.commit)
})

test("every inventory variant has a structural fingerprint", () => {
  const missing = inventory.variants
    .map((variant) => variant.upstreamName)
    .filter((upstreamName) => !fingerprints.variants[upstreamName])
  assert.deepEqual(missing, [], `missing fingerprints for: ${missing.join(", ")}`)
})

test("adapted variants preserve upstream structural classes", async () => {
  /** @type {string[]} */
  const failures = []

  for (const variant of inventory.variants) {
    const { missing } = await compareVariantStructuralClasses(variant.upstreamName)
    if (missing.length > 0) {
      failures.push(`${variant.upstreamName}: missing ${missing.join(", ")}`)
    }
  }

  assert.equal(failures.length, 0, failures.join("\n"))
})

test("Provider Smoke variants preserve upstream structural classes", async () => {
  /** @type {string[]} */
  const failures = []
  for (const upstreamName of PROVIDER_SMOKE_UPSTREAM_NAMES) {
    const { missing } = await compareVariantStructuralClasses(upstreamName)
    if (missing.length > 0) {
      failures.push(`${upstreamName}: missing ${missing.join(", ")}`)
    }
  }
  assert.equal(failures.length, 0, failures.join("\n"))
})

test("hero-01 keeps the upstream root layout class string", async () => {
  const variant = inventory.variants.find((entry) => entry.upstreamName === "hero-01")
  assert.ok(variant)
  const source = await readFile(new URL("./hero-01/hero.tsx", variantsRoot), "utf8")
  assert.match(
    source,
    /className="relative flex min-h-screen items-center justify-center overflow-hidden px-6"/,
  )
  assert.equal(
    variant.referenceRootClassName,
    "relative flex min-h-screen items-center justify-center overflow-hidden px-6",
  )
})

test("hero-01 DreamyBackground keeps upstream blobs with CSS blur (no SVG feGaussianBlur)", async () => {
  const source = await readFile(new URL("./hero-01/hero.tsx", variantsRoot), "utf8")
  assert.match(source, /function DreamyBackground/)
  assert.match(source, /--provider-accent-/)
  assert.match(source, /--provider-accent-secondary-/)
  assert.match(source, /linearGradient/)
  assert.match(source, /M291\.402 416\.77/)
  assert.match(source, /M811\.933 441\.279/)
  assert.match(source, /blur\(64px\)/)
  assert.match(source, /scale\(1\.38, 1\.12\)/)
  assert.doesNotMatch(source, /feGaussianBlur/)
  assert.doesNotMatch(source, /radial-gradient/)
})
