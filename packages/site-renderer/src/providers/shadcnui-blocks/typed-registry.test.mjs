import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"
import bindings from "./bindings.json" with { type: "json" }
import Cta01View from "./variants/cta-01/view.tsx"
import Faq01View from "./variants/faq-01/view.tsx"
import LogoCloud01View from "./variants/logo-cloud-01/view.tsx"
import {
  BEHAVIOR_ADAPTER_IDS,
  LEGACY_BEHAVIOR_ADAPTER_IDS,
  TYPED_PILOT_IDS,
  TYPED_PILOT_REGISTRY,
} from "./typed/registry.ts"

const viewById = {
  "shadcnui-blocks.cta-01": Cta01View,
  "shadcnui-blocks.logo-cloud-01": LogoCloud01View,
  "shadcnui-blocks.faq-01": Faq01View,
}

test("typed pilot registry is exhaustive for migrated pilots", () => {
  assert.deepEqual(Object.keys(TYPED_PILOT_REGISTRY).sort(), [...TYPED_PILOT_IDS].sort())
  assert.deepEqual(
    [...BEHAVIOR_ADAPTER_IDS].sort(),
    [...TYPED_PILOT_IDS, ...LEGACY_BEHAVIOR_ADAPTER_IDS].sort(),
  )
})

test("typed pilot registry matches direct bindings, views, and generated block types", async () => {
  const generated = await readFile(new URL("./block-views.generated.tsx", import.meta.url), "utf8")

  for (const id of TYPED_PILOT_IDS) {
    const entry = TYPED_PILOT_REGISTRY[id]
    const direct = bindings.direct?.[entry.upstreamName] ?? []
    assert.deepEqual([...entry.directFields].sort(), [...direct].sort(), `${id} direct fields`)
    assert.equal(entry.View, viewById[id], `${id} view module`)
    assert.match(generated, new RegExp(`"${id}": \\{ blockType: "${entry.blockType}"`), `${id} generated block type`)
  }
})
