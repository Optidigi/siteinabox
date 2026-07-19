import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"
import bindings from "./bindings.json" with { type: "json" }
import Cta01View from "./variants/cta-01/view.tsx"
import Cta02View from "./variants/cta-02/view.tsx"
import Cta03View from "./variants/cta-03/view.tsx"
import Cta04View from "./variants/cta-04/view.tsx"
import Cta05View from "./variants/cta-05/view.tsx"
import Cta06View from "./variants/cta-06/view.tsx"
import Cta07View from "./variants/cta-07/view.tsx"
import Faq01View from "./variants/faq-01/view.tsx"
import Faq02View from "./variants/faq-02/view.tsx"
import Faq03View from "./variants/faq-03/view.tsx"
import Faq04View from "./variants/faq-04/view.tsx"
import Faq05View from "./variants/faq-05/view.tsx"
import Faq06View from "./variants/faq-06/view.tsx"
import Faq07View from "./variants/faq-07/view.tsx"
import Faq08View from "./variants/faq-08/view.tsx"
import Faq09View from "./variants/faq-09/view.tsx"
import Faq10View from "./variants/faq-10/view.tsx"
import Faq11View from "./variants/faq-11/view.tsx"
import Faq12View from "./variants/faq-12/view.tsx"
import Faq13View from "./variants/faq-13/view.tsx"
import Faq14View from "./variants/faq-14/view.tsx"
import LogoCloud01View from "./variants/logo-cloud-01/view.tsx"
import {
  BEHAVIOR_ADAPTER_IDS,
  LEGACY_BEHAVIOR_ADAPTER_IDS,
  TYPED_PILOT_IDS,
  TYPED_PILOT_REGISTRY,
} from "./typed/registry.ts"

const viewById = {
  "shadcnui-blocks.cta-01": Cta01View,
  "shadcnui-blocks.cta-02": Cta02View,
  "shadcnui-blocks.cta-03": Cta03View,
  "shadcnui-blocks.cta-04": Cta04View,
  "shadcnui-blocks.cta-05": Cta05View,
  "shadcnui-blocks.cta-06": Cta06View,
  "shadcnui-blocks.cta-07": Cta07View,
  "shadcnui-blocks.logo-cloud-01": LogoCloud01View,
  "shadcnui-blocks.faq-01": Faq01View,
  "shadcnui-blocks.faq-02": Faq02View,
  "shadcnui-blocks.faq-03": Faq03View,
  "shadcnui-blocks.faq-04": Faq04View,
  "shadcnui-blocks.faq-05": Faq05View,
  "shadcnui-blocks.faq-06": Faq06View,
  "shadcnui-blocks.faq-07": Faq07View,
  "shadcnui-blocks.faq-08": Faq08View,
  "shadcnui-blocks.faq-09": Faq09View,
  "shadcnui-blocks.faq-10": Faq10View,
  "shadcnui-blocks.faq-11": Faq11View,
  "shadcnui-blocks.faq-12": Faq12View,
  "shadcnui-blocks.faq-13": Faq13View,
  "shadcnui-blocks.faq-14": Faq14View,
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
