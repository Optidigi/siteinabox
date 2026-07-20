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
import Pricing01View from "./variants/pricing-01/view.tsx"
import Pricing02View from "./variants/pricing-02/view.tsx"
import Pricing03View from "./variants/pricing-03/view.tsx"
import Pricing04View from "./variants/pricing-04/view.tsx"
import Pricing05View from "./variants/pricing-05/view.tsx"
import Pricing06View from "./variants/pricing-06/view.tsx"
import Pricing07View from "./variants/pricing-07/view.tsx"
import Pricing08View from "./variants/pricing-08/view.tsx"
import Pricing09View from "./variants/pricing-09/view.tsx"
import Pricing10View from "./variants/pricing-10/view.tsx"
import Team01View from "./variants/team-01/view.tsx"
import Team02View from "./variants/team-02/view.tsx"
import Team03View from "./variants/team-03/view.tsx"
import Team04View from "./variants/team-04/view.tsx"
import Team05View from "./variants/team-05/view.tsx"
import Team06View from "./variants/team-06/view.tsx"
import Team07View from "./variants/team-07/view.tsx"
import Team08View from "./variants/team-08/view.tsx"
import Team09View from "./variants/team-09/view.tsx"
import Team10View from "./variants/team-10/view.tsx"
import Team11View from "./variants/team-11/view.tsx"
import Team12View from "./variants/team-12/view.tsx"
import Team13View from "./variants/team-13/view.tsx"
import Testimonials01View from "./variants/testimonials-01/view.tsx"
import Testimonials02View from "./variants/testimonials-02/view.tsx"
import Testimonials03View from "./variants/testimonials-03/view.tsx"
import Testimonials04View from "./variants/testimonials-04/view.tsx"
import Testimonials05View from "./variants/testimonials-05/view.tsx"
import Testimonials06View from "./variants/testimonials-06/view.tsx"
import Testimonials07View from "./variants/testimonials-07/view.tsx"
import Testimonials08View from "./variants/testimonials-08/view.tsx"
import Testimonials09View from "./variants/testimonials-09/view.tsx"
import Testimonials10View from "./variants/testimonials-10/view.tsx"
import Testimonials11View from "./variants/testimonials-11/view.tsx"
import Testimonials12View from "./variants/testimonials-12/view.tsx"
import Testimonials13View from "./variants/testimonials-13/view.tsx"
import Timeline01View from "./variants/timeline-01/view.tsx"
import Timeline02View from "./variants/timeline-02/view.tsx"
import Timeline03View from "./variants/timeline-03/view.tsx"
import Timeline04View from "./variants/timeline-04/view.tsx"
import Timeline05View from "./variants/timeline-05/view.tsx"
import Timeline06View from "./variants/timeline-06/view.tsx"
import Timeline07View from "./variants/timeline-07/view.tsx"
import Integrations01View from "./variants/integrations-01/view.tsx"
import Integrations02View from "./variants/integrations-02/view.tsx"
import Integrations03View from "./variants/integrations-03/view.tsx"
import Integrations04View from "./variants/integrations-04/view.tsx"
import Integrations05View from "./variants/integrations-05/view.tsx"
import Blog01View from "./variants/blog-01/view.tsx"
import Blog02View from "./variants/blog-02/view.tsx"
import Blog03View from "./variants/blog-03/view.tsx"
import Blog04View from "./variants/blog-04/view.tsx"
import Blog05View from "./variants/blog-05/view.tsx"
import Blog06View from "./variants/blog-06/view.tsx"
import Contact01View from "./variants/contact-01/view.tsx"
import Contact02View from "./variants/contact-02/view.tsx"
import Contact03View from "./variants/contact-03/view.tsx"
import CarouselBlock01View from "./variants/carousel-block-01/view.tsx"
import CarouselBlock02View from "./variants/carousel-block-02/view.tsx"
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
  "shadcnui-blocks.pricing-01": Pricing01View,
  "shadcnui-blocks.pricing-02": Pricing02View,
  "shadcnui-blocks.pricing-03": Pricing03View,
  "shadcnui-blocks.pricing-04": Pricing04View,
  "shadcnui-blocks.pricing-05": Pricing05View,
  "shadcnui-blocks.pricing-06": Pricing06View,
  "shadcnui-blocks.pricing-07": Pricing07View,
  "shadcnui-blocks.pricing-08": Pricing08View,
  "shadcnui-blocks.pricing-09": Pricing09View,
  "shadcnui-blocks.pricing-10": Pricing10View,
  "shadcnui-blocks.team-01": Team01View,
  "shadcnui-blocks.team-02": Team02View,
  "shadcnui-blocks.team-03": Team03View,
  "shadcnui-blocks.team-04": Team04View,
  "shadcnui-blocks.team-05": Team05View,
  "shadcnui-blocks.team-06": Team06View,
  "shadcnui-blocks.team-07": Team07View,
  "shadcnui-blocks.team-08": Team08View,
  "shadcnui-blocks.team-09": Team09View,
  "shadcnui-blocks.team-10": Team10View,
  "shadcnui-blocks.team-11": Team11View,
  "shadcnui-blocks.team-12": Team12View,
  "shadcnui-blocks.team-13": Team13View,
  "shadcnui-blocks.testimonials-01": Testimonials01View,
  "shadcnui-blocks.testimonials-02": Testimonials02View,
  "shadcnui-blocks.testimonials-03": Testimonials03View,
  "shadcnui-blocks.testimonials-04": Testimonials04View,
  "shadcnui-blocks.testimonials-05": Testimonials05View,
  "shadcnui-blocks.testimonials-06": Testimonials06View,
  "shadcnui-blocks.testimonials-07": Testimonials07View,
  "shadcnui-blocks.testimonials-08": Testimonials08View,
  "shadcnui-blocks.testimonials-09": Testimonials09View,
  "shadcnui-blocks.testimonials-10": Testimonials10View,
  "shadcnui-blocks.testimonials-11": Testimonials11View,
  "shadcnui-blocks.testimonials-12": Testimonials12View,
  "shadcnui-blocks.testimonials-13": Testimonials13View,
  "shadcnui-blocks.timeline-01": Timeline01View,
  "shadcnui-blocks.timeline-02": Timeline02View,
  "shadcnui-blocks.timeline-03": Timeline03View,
  "shadcnui-blocks.timeline-04": Timeline04View,
  "shadcnui-blocks.timeline-05": Timeline05View,
  "shadcnui-blocks.timeline-06": Timeline06View,
  "shadcnui-blocks.timeline-07": Timeline07View,
  "shadcnui-blocks.integrations-01": Integrations01View,
  "shadcnui-blocks.integrations-02": Integrations02View,
  "shadcnui-blocks.integrations-03": Integrations03View,
  "shadcnui-blocks.integrations-04": Integrations04View,
  "shadcnui-blocks.integrations-05": Integrations05View,
  "shadcnui-blocks.blog-01": Blog01View,
  "shadcnui-blocks.blog-02": Blog02View,
  "shadcnui-blocks.blog-03": Blog03View,
  "shadcnui-blocks.blog-04": Blog04View,
  "shadcnui-blocks.blog-05": Blog05View,
  "shadcnui-blocks.blog-06": Blog06View,
  "shadcnui-blocks.contact-01": Contact01View,
  "shadcnui-blocks.contact-02": Contact02View,
  "shadcnui-blocks.contact-03": Contact03View,
  "shadcnui-blocks.carousel-block-01": CarouselBlock01View,
  "shadcnui-blocks.carousel-block-02": CarouselBlock02View,
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
