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
import Features01View from "./variants/features-01/view.tsx"
import Features02View from "./variants/features-02/view.tsx"
import Features03View from "./variants/features-03/view.tsx"
import Features04View from "./variants/features-04/view.tsx"
import Features05View from "./variants/features-05/view.tsx"
import Features06View from "./variants/features-06/view.tsx"
import Features07View from "./variants/features-07/view.tsx"
import Features08View from "./variants/features-08/view.tsx"
import Features09View from "./variants/features-09/view.tsx"
import Features10View from "./variants/features-10/view.tsx"
import Features11View from "./variants/features-11/view.tsx"
import Features12View from "./variants/features-12/view.tsx"
import Features13View from "./variants/features-13/view.tsx"
import Features14View from "./variants/features-14/view.tsx"
import Features15View from "./variants/features-15/view.tsx"
import Features16View from "./variants/features-16/view.tsx"
import Features17View from "./variants/features-17/view.tsx"
import Features18View from "./variants/features-18/view.tsx"
import Hero01View from "./variants/hero-01/view.tsx"
import Hero02View from "./variants/hero-02/view.tsx"
import Hero03View from "./variants/hero-03/view.tsx"
import Hero04View from "./variants/hero-04/view.tsx"
import Hero05View from "./variants/hero-05/view.tsx"
import Hero06View from "./variants/hero-06/view.tsx"
import Hero07View from "./variants/hero-07/view.tsx"
import Hero08View from "./variants/hero-08/view.tsx"
import LogoCloud01View from "./variants/logo-cloud-01/view.tsx"
import LogoCloud02View from "./variants/logo-cloud-02/view.tsx"
import LogoCloud03View from "./variants/logo-cloud-03/view.tsx"
import LogoCloud04View from "./variants/logo-cloud-04/view.tsx"
import LogoCloud05View from "./variants/logo-cloud-05/view.tsx"
import LogoCloud06View from "./variants/logo-cloud-06/view.tsx"
import LogoCloud07View from "./variants/logo-cloud-07/view.tsx"
import LogoCloud08View from "./variants/logo-cloud-08/view.tsx"
import LogoCloud09View from "./variants/logo-cloud-09/view.tsx"
import LogoCloud10View from "./variants/logo-cloud-10/view.tsx"
import LogoCloud11View from "./variants/logo-cloud-11/view.tsx"
import LogoCloud12View from "./variants/logo-cloud-12/view.tsx"
import LogoCloud13View from "./variants/logo-cloud-13/view.tsx"
import LogoCloud14View from "./variants/logo-cloud-14/view.tsx"
import LogoCloud15View from "./variants/logo-cloud-15/view.tsx"
import Stats01View from "./variants/stats-01/view.tsx"
import Stats02View from "./variants/stats-02/view.tsx"
import Stats03View from "./variants/stats-03/view.tsx"
import Stats04View from "./variants/stats-04/view.tsx"
import Stats05View from "./variants/stats-05/view.tsx"
import Stats06View from "./variants/stats-06/view.tsx"
import Stats07View from "./variants/stats-07/view.tsx"
import Stats08View from "./variants/stats-08/view.tsx"
import Stats09View from "./variants/stats-09/view.tsx"
import Stats10View from "./variants/stats-10/view.tsx"
import Stats11View from "./variants/stats-11/view.tsx"
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
  "shadcnui-blocks.logo-cloud-02": LogoCloud02View,
  "shadcnui-blocks.logo-cloud-03": LogoCloud03View,
  "shadcnui-blocks.logo-cloud-04": LogoCloud04View,
  "shadcnui-blocks.logo-cloud-05": LogoCloud05View,
  "shadcnui-blocks.logo-cloud-06": LogoCloud06View,
  "shadcnui-blocks.logo-cloud-07": LogoCloud07View,
  "shadcnui-blocks.logo-cloud-08": LogoCloud08View,
  "shadcnui-blocks.logo-cloud-09": LogoCloud09View,
  "shadcnui-blocks.logo-cloud-10": LogoCloud10View,
  "shadcnui-blocks.logo-cloud-11": LogoCloud11View,
  "shadcnui-blocks.logo-cloud-12": LogoCloud12View,
  "shadcnui-blocks.logo-cloud-13": LogoCloud13View,
  "shadcnui-blocks.logo-cloud-14": LogoCloud14View,
  "shadcnui-blocks.logo-cloud-15": LogoCloud15View,
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
  "shadcnui-blocks.features-01": Features01View,
  "shadcnui-blocks.features-02": Features02View,
  "shadcnui-blocks.features-03": Features03View,
  "shadcnui-blocks.features-04": Features04View,
  "shadcnui-blocks.features-05": Features05View,
  "shadcnui-blocks.features-06": Features06View,
  "shadcnui-blocks.features-07": Features07View,
  "shadcnui-blocks.features-08": Features08View,
  "shadcnui-blocks.features-09": Features09View,
  "shadcnui-blocks.features-10": Features10View,
  "shadcnui-blocks.features-11": Features11View,
  "shadcnui-blocks.features-12": Features12View,
  "shadcnui-blocks.features-13": Features13View,
  "shadcnui-blocks.features-14": Features14View,
  "shadcnui-blocks.features-15": Features15View,
  "shadcnui-blocks.features-16": Features16View,
  "shadcnui-blocks.features-17": Features17View,
  "shadcnui-blocks.features-18": Features18View,
  "shadcnui-blocks.hero-01": Hero01View,
  "shadcnui-blocks.hero-02": Hero02View,
  "shadcnui-blocks.hero-03": Hero03View,
  "shadcnui-blocks.hero-04": Hero04View,
  "shadcnui-blocks.hero-05": Hero05View,
  "shadcnui-blocks.hero-06": Hero06View,
  "shadcnui-blocks.hero-07": Hero07View,
  "shadcnui-blocks.hero-08": Hero08View,
  "shadcnui-blocks.stats-01": Stats01View,
  "shadcnui-blocks.stats-02": Stats02View,
  "shadcnui-blocks.stats-03": Stats03View,
  "shadcnui-blocks.stats-04": Stats04View,
  "shadcnui-blocks.stats-05": Stats05View,
  "shadcnui-blocks.stats-06": Stats06View,
  "shadcnui-blocks.stats-07": Stats07View,
  "shadcnui-blocks.stats-08": Stats08View,
  "shadcnui-blocks.stats-09": Stats09View,
  "shadcnui-blocks.stats-10": Stats10View,
  "shadcnui-blocks.stats-11": Stats11View,
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
