import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { readFile } from "node:fs/promises"
import test from "node:test"
import inventory from "./inventory.json" with { type: "json" }
import exclusions from "./exclusions.json" with { type: "json" }
import bindings from "./bindings.json" with { type: "json" }

const root = new URL("../../../../../", import.meta.url)
const sha256 = (value) => `sha256:${createHash("sha256").update(value).digest("hex")}`

const directUpstreamNames = Object.keys(bindings.direct ?? {})
const blockVariants = inventory.variants.filter((entry) => entry.role === "block")
const chromeVariants = inventory.variants.filter((entry) => entry.role === "chrome")
const systemVariants = inventory.variants.filter((entry) => entry.role === "systemTemplate")

test("pinned catalog is complete and every non-imported registry item is explained", () => {
  assert.equal(inventory.commit, bindings.commit)
  assert.equal(inventory.registry, "registry-radix.json")
  assert.equal(directUpstreamNames.length, blockVariants.length, "every public block has a direct binding")
  assert.equal(blockVariants.length, inventory.counts.public - chromeVariants.length, "public block inventory matches catalog counts")
  assert.equal(systemVariants.length, inventory.counts.systemTemplates)
  assert.equal(exclusions.exclusions.length, inventory.counts.excluded)
  assert.equal(inventory.variants.length, blockVariants.length + chromeVariants.length + systemVariants.length)
  assert.ok(exclusions.exclusions.every((entry) => typeof entry.reason === "string" && entry.reason.length > 0))
  assert.equal(
    new Set([...inventory.variants.map((entry) => entry.upstreamName), ...exclusions.exclusions.map((entry) => entry.upstreamName)]).size,
    inventory.counts.upstream,
  )
  for (const variant of blockVariants) {
    assert.ok(directUpstreamNames.includes(variant.upstreamName), `${variant.id} is direct-bound`)
  }
})

test("provider interaction dependencies stay pinned to the upstream-compatible release", async () => {
  for (const path of ["packages/ui/package.json", "packages/site-renderer/package.json", "apps/cms/package.json", "apps/intake/package.json"]) {
    const manifest = JSON.parse(await readFile(new URL(path, root), "utf8"))
    assert.equal(manifest.dependencies?.["radix-ui"], "1.4.3", path)
  }
})

test("every active structured slot has one explicit literal or direct binding", () => {
  for (const variant of blockVariants) {
    const declared = new Set([
      ...variant.bindings.map((binding) => binding.field),
      ...(bindings.direct?.[variant.upstreamName] ?? []),
    ])
    const active = Object.entries(variant.slots).filter(([, slot]) => slot.status !== "inactive").map(([field]) => field)
    assert.ok(active.length > 0, `${variant.id} exposes structured content`)
    assert.deepEqual(active.filter((field) => !declared.has(field)), [], `${variant.id} active slots are explicit`)
    for (const [field, slot] of Object.entries(variant.slots)) {
      if (slot.status === "inactive") assert.ok(slot.reason, `${variant.id}.${field} inactive reason`)
    }
  }
})

test("the generated browser loader covers each structured variant exactly once", async () => {
  const source = await readFile(new URL("packages/site-renderer/src/providers/shadcnui-blocks/block-client-loaders.generated.ts", root), "utf8")
  const ids = [...source.matchAll(/^  "([^"]+)": \(\) => import\(/gm)].map((match) => match[1]).sort()
  const expected = blockVariants.map((entry) => entry.id).sort()
  assert.deepEqual(ids, expected)
})

test("every production block view uses the typed mapper surface", async () => {
  for (const variant of blockVariants) {
    const source = await readFile(new URL(`packages/site-renderer/src/providers/shadcnui-blocks/variants/${variant.upstreamName}/view.tsx`, root), "utf8")
    assert.doesNotMatch(source, /LiteralProviderVariantView/, `${variant.id} must not use literal provider views`)
    assert.doesNotMatch(source, /ProviderField|ProviderItems|ProviderBlockContent/, `${variant.id} must not use Provider* binding runtime`)
    assert.match(source, /providerBlockAttributes/, `${variant.id} maps typed props through provider attributes`)
  }
})

test("obsolete AST binding entries are not retained once variants are direct-bound", () => {
  assert.equal(Object.keys(bindings.variants ?? {}).length, 0, "bindings.variants is empty after direct cutover")
})

test("vendored registry, license, primitives and literal provider files retain recorded hashes", async () => {
  const registry = await readFile(new URL("packages/site-renderer/src/providers/shadcnui-blocks/registry-radix.json", root))
  assert.equal(sha256(registry), inventory.registryHash)
  const license = await readFile(new URL("packages/site-renderer/src/providers/shadcnui-blocks/LICENSE", root), "utf8")
  assert.match(license, /MIT License/)
  for (const entry of [...inventory.compatibilityPrimitives, ...(inventory.providerRuntimeFiles ?? []), ...inventory.variants.flatMap((variant) => variant.adaptedFiles ?? [])]) {
    const source = await readFile(new URL(entry.path, root))
    assert.equal(sha256(source), entry.sha256, entry.path)
  }
  for (const variant of inventory.variants) {
    assert.ok(variant.sourceFiles.length > 0, `${variant.id} records original source hashes`)
    assert.ok(variant.sourceFiles.every((entry) => entry.path.startsWith("src/registry/")), `${variant.id} source provenance points into the pinned repository`)
  }
  for (const variant of blockVariants) {
    assert.ok(variant.adaptedFiles.some((entry) => entry.path.endsWith("/view.tsx")), `${variant.id} view`)
    assert.equal(variant.adaptedFiles.some((entry) => entry.path.endsWith("/adapter.ts")), false, `${variant.id} has no pass-through adapter`)
  }
  assert.equal(inventory.variants.some((variant) => "referenceFiles" in variant), false, "there is no second reference component tree")
})

test("adapted literal copies cannot load upstream demo data or assets", async () => {
  const demoUrl = /https?:\/\/(?!www\.w3\.org\/2000\/svg)/
  for (const variant of inventory.variants) {
    for (const file of variant.adaptedFiles.filter((entry) => /\/variants\/.*\.tsx$/.test(entry.path))) {
      const contents = await readFile(new URL(file.path, root), "utf8")
      assert.doesNotMatch(contents, demoUrl, file.path)
    }
  }
})

test("generated client directives remain in the module prologue", async () => {
  for (const variant of inventory.variants) {
    for (const file of variant.adaptedFiles.filter((entry) => /\/variants\/.*\.tsx$/.test(entry.path))) {
      const contents = await readFile(new URL(file.path, root), "utf8")
      const directive = contents.indexOf('"use client"')
      if (directive < 0) continue
      const firstImport = contents.search(/^import /m)
      assert.ok(directive < firstImport, `${file.path} keeps use client before imports`)
    }
  }
})
