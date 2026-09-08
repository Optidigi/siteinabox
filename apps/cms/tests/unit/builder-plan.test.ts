import { describe, expect, it, vi } from "vitest"
import { heuristicExtractBuilderFacts } from "@/lib/builder/facts"
import { composeFirstSiteReply, composeUnavailableReply } from "@/lib/builder/catalogHonesty"
import { BuilderTurnPlanSchema, overlayMastraPlan } from "@/lib/builder/planTurn"

const kapperFacts = heuristicExtractBuilderFacts(
  "Ik ben kapper in Tilburg en doe knippen, kleur en baard. Bezoekers kunnen een afspraak maken.",
  null,
)

describe("overlayMastraPlan", () => {
  it("keeps the catalog refuse when Mastra tries to generate a FAQ site", () => {
    const safe = BuilderTurnPlanSchema.parse({
      facts: heuristicExtractBuilderFacts("Ik wil een FAQ pagina en een portfolio.", null),
      decision: "refuse",
      reply: composeUnavailableReply(["FAQ", "portfolio"]),
      maintainerKind: "none",
    })
    const mastra = BuilderTurnPlanSchema.parse({
      facts: kapperFacts,
      decision: "generate",
      reply: "Ik maak nu een complete website met FAQ-pagina en portfolio.",
      maintainerKind: "none",
    })
    const plan = overlayMastraPlan(safe, mastra)
    expect(plan.decision).toBe("refuse")
    expect(plan.reply).toMatch(/catalogus/i)
    expect(plan.reply).not.toMatch(/complete website/i)
  })

  it("keeps the brief ask when Mastra tries to generate from a greeting", () => {
    const safe = BuilderTurnPlanSchema.parse({
      facts: heuristicExtractBuilderFacts("hey, help", null),
      decision: "ask",
      reply: "Vertel welk vak je doet, in welke plaats, en wat je aanbiedt.",
      maintainerKind: "none",
    })
    const mastra = BuilderTurnPlanSchema.parse({
      facts: kapperFacts,
      decision: "generate",
      reply: "Hier is je volledige website, klaar om live te gaan.",
      maintainerKind: "none",
    })
    expect(overlayMastraPlan(safe, mastra).decision).toBe("ask")
  })

  it("accepts Mastra copy for a first homepage when policy already chose generate", () => {
    const safe = BuilderTurnPlanSchema.parse({
      facts: kapperFacts,
      decision: "generate",
      reply: composeFirstSiteReply(kapperFacts, { unavailable: [] }),
      maintainerKind: "none",
    })
    const mastra = BuilderTurnPlanSchema.parse({
      facts: kapperFacts,
      decision: "generate",
      reply: "Hier is een eerste homepage met hero, diensten en afspraken uit de live catalogus. Geen FAQ.",
      maintainerKind: "none",
    })
    expect(overlayMastraPlan(safe, mastra).reply).toMatch(/live catalogus/i)
  })

  it("lets Mastra fill a catalog variant on maintain without changing policy", () => {
    const safe = BuilderTurnPlanSchema.parse({
      facts: kapperFacts,
      decision: "maintain",
      reply: "Ik pas het aan.",
      maintainerKind: "none",
    })
    const mastra = BuilderTurnPlanSchema.parse({
      facts: kapperFacts,
      decision: "maintain",
      reply: "Ik zet het hero-blok op hero-02.",
      maintainerKind: "replaceSection",
      variant: "hero-02",
    })
    const plan = overlayMastraPlan(safe, mastra)
    expect(plan.decision).toBe("maintain")
    expect(plan.maintainerKind).toBe("replaceSection")
    expect(plan.variant).toBe("hero-02")
  })
})

const generateMock = vi.hoisted(() => vi.fn())

vi.mock("@mastra/core/agent", () => ({
  Agent: class {
    generate = generateMock
  },
}))

describe("planBuilderTurn first site", () => {
  it("does not call the Mastra conductor for a first generate", async () => {
    const previousProvider = process.env.SITE_GENERATION_PROVIDER
    const previousKey = process.env.OPENAI_API_KEY
    process.env.SITE_GENERATION_PROVIDER = "mastra"
    process.env.OPENAI_API_KEY = "sk-test"
    generateMock.mockClear()
    const { planBuilderTurn } = await import("@/lib/builder/planTurn")
    const plan = await planBuilderTurn({
      message: "Ik ben kapper in Tilburg en doe knippen, kleur en baard. Bezoekers kunnen een afspraak maken. Strak blauw, modern.",
      previous: null,
      hasExistingSite: false,
    })
    process.env.SITE_GENERATION_PROVIDER = previousProvider
    process.env.OPENAI_API_KEY = previousKey
    expect(generateMock).not.toHaveBeenCalled()
    expect(plan.decision).toBe("generate")
  })
})
