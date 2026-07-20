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
    const fingerprint = fingerprints.variants[variant.upstreamName]
    if (!fingerprint) {
      failures.push(`${variant.upstreamName}: no fingerprint entry`)
      continue
    }

    const variantDir = new URL(`${variant.upstreamName}/`, variantsRoot)
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
    const missing = missingStructuralClasses(adaptedNormalized, uniqueRequired, variant.upstreamName)

    if (missing.length > 0) {
      failures.push(`${variant.upstreamName}: missing ${missing.join(", ")}`)
    }
  }

  assert.equal(failures.length, 0, failures.join("\n"))
})
