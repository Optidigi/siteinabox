import { describe, expect, it } from "vitest"
import { choicesForFirstSite, choicesFromAssistantText } from "@/lib/builder/choices"
import { applyModuleAnswer, canGenerateFirstHomepage, firstSiteMissing, heuristicExtractBuilderFacts, isBuilderBriefReady } from "@/lib/builder/facts"
import { buildRawIntakeFromBuilderFacts } from "@/lib/builder/rawIntake"
import { normalizeIntakeSubmission } from "@/lib/intake/normalizeIntake"
import { sitegenEligibilityFromIntake } from "@/lib/ai-generation/siteGenerationInput"

describe("builder facts and intake", () => {
  it("extracts enough services for Sitegen eligibility", () => {
    const facts = heuristicExtractBuilderFacts(
      "Ik ben kapper in Tilburg en doe knippen, kleur en baard.",
      null,
    )
    expect(facts.businessName).toBe("Kapper Tilburg")
    expect(facts.offers.map((offer) => offer.value)).toEqual(["Knippen", "Kleur", "Baard"])
    expect(isBuilderBriefReady("Ik ben kapper in Tilburg en doe knippen, kleur en baard.", facts)).toBe(true)
    expect(isBuilderBriefReady("hey, help", facts)).toBe(false)
    const themed = { ...facts, colorSchemeId: "emerald-calm" as const, appearanceMode: "dark" as const }
    const intake = buildRawIntakeFromBuilderFacts({
      facts: themed,
      contact: { name: "Anna Kapper", email: "anna@example.com", phone: "0612345678" },
      legal: { businessUseAccepted: true, termsAccepted: true, marketingOptIn: false },
      recordedAt: "2026-09-03T10:00:00.000Z",
    })
    expect(intake.source).toBe("builder")
    const normalized = normalizeIntakeSubmission(intake)
    const eligibility = sitegenEligibilityFromIntake(normalized)
    expect(eligibility.serviceCount).toBeGreaterThanOrEqual(2)
    expect(normalized.intakeBrief?.visualPreferences.colorSchemeId).toBe("emerald-calm")
    expect(normalized.intakeBrief?.visualPreferences.fontSchemeId).toBe("clear-modern")
    expect(normalized.intakeBrief?.visualPreferences.shapeSchemeId).toBe("soft")
  })

  it("takes services after doe, not the whole sentence", () => {
    const facts = heuristicExtractBuilderFacts(
      "Ik ben hovenier in Eindhoven en doe tuinaanleg, onderhoud en schuttingen",
      null,
    )
    expect(facts.offers.map((offer) => offer.value)).toEqual(["Tuinaanleg", "Onderhoud", "Schuttingen"])
    expect(facts.offers.some((offer) => /ik ben|doe /i.test(offer.value))).toBe(false)
  })

  it("keeps stored offers when the follow-up is only a place", () => {
    const previous = heuristicExtractBuilderFacts(
      "Ik ben hovenier in Eindhoven en doe tuinaanleg, onderhoud en schuttingen",
      null,
    )
    const next = heuristicExtractBuilderFacts("in eindhoven", previous)
    expect(next.offers.map((offer) => offer.value)).toEqual(["Tuinaanleg", "Onderhoud", "Schuttingen"])
    expect(next.businessName).toBe(previous.businessName)
  })

  it("does not spend Sitegen on a thin first line or off-topic follow-up", () => {
    const thin = heuristicExtractBuilderFacts("hoi, ik ben een brandweerman die dildos verkoopt", null)
    expect(firstSiteMissing(thin)).toEqual(expect.arrayContaining(["plaats", "diensten", "contactvoorkeur", "uitstraling"]))
    expect(canGenerateFirstHomepage(thin, "hoi, ik ben een brandweerman die dildos verkoopt")).toBe(false)
    const ready = {
      ...heuristicExtractBuilderFacts(
        "Ik ben kapper in Tilburg en doe knippen, kleur en baard. Bezoekers kunnen een afspraak maken.",
        null,
      ),
      lookConfirmed: true as const,
    }
    expect(canGenerateFirstHomepage(ready, "wat vind je van israel", ready)).toBe(false)
    expect(canGenerateFirstHomepage(ready, "Ik ben kapper in Tilburg en doe knippen, kleur en baard. Bezoekers kunnen een afspraak maken.")).toBe(true)
  })

  it("treats a short X-en-Y list as diensten and ignores contact-only lists", () => {
    const previous = {
      ...applyModuleAnswer(
        "bellen",
        heuristicExtractBuilderFacts("Ik ben loodgieter in Roermond en doe lekkages, cv en afvoer.", null),
      ),
      lookConfirmed: true,
    }
    const listed = heuristicExtractBuilderFacts("blowjobs en badkamerwerk", previous)
    expect(listed.offers.map((offer) => offer.value)).toEqual(["Blowjobs", "Badkamerwerk"])
    expect(firstSiteMissing(listed)).toEqual([])
    expect(canGenerateFirstHomepage(listed, "blowjobs en badkamerwerk", previous)).toBe(true)
    const contactOnly = heuristicExtractBuilderFacts("bellen en whatsapp", previous)
    expect(contactOnly.offers).toEqual(previous.offers)
    const chitchat = heuristicExtractBuilderFacts("hoi hoe is het", null)
    expect(chitchat.businessName).toBe("Nieuw bedrijf")
    expect(canGenerateFirstHomepage(listed, "je bent een beetje een idioot of niet?", listed)).toBe(false)
    expect(canGenerateFirstHomepage(listed, "oke, prima dat klinkt goed", listed)).toBe(true)
    const kapper = heuristicExtractBuilderFacts("Ik ben kapper in Tilburg en doe knippen, kleur en baard.", null)
    expect(choicesForFirstSite(kapper, false).some((choice) => choice.id === "phone")).toBe(true)
    expect(choicesForFirstSite(listed, false).map((choice) => choice.id)).toEqual(["generate"])
  })

  it("does not treat chip labels as a business name and accepts nationwide area", () => {
    const previous = {
      ...applyModuleAnswer(
        "bellen",
        heuristicExtractBuilderFacts("Ik ben loodgieter in Roermond en doe lekkages, cv en afvoer.", null),
      ),
      lookConfirmed: true,
    }
    const fromChip = heuristicExtractBuilderFacts("Bellen en WhatsApp", previous)
    expect(fromChip.businessName).toBe(previous.businessName)
    expect(fromChip.selectedActions).toEqual(["phone"])
    const withBoth = applyModuleAnswer("Bellen en WhatsApp", fromChip)
    expect(withBoth.selectedActions).toEqual(["phone", "whatsapp"])
    expect(withBoth.businessName).toBe("Loodgieter Roermond")

    const nationwide = heuristicExtractBuilderFacts("Heel Nederland, handjobs en blowjobs", withBoth)
    expect(nationwide.region).toBe("Heel Nederland")
    expect(nationwide.offers.map((offer) => offer.value)).toEqual(["Handjobs", "Blowjobs"])
    expect(nationwide.businessName).toBe("Loodgieter Roermond")
    expect(firstSiteMissing(nationwide)).toEqual([])
    expect(canGenerateFirstHomepage(nationwide, "Maak de homepage", nationwide)).toBe(true)

    const starter = heuristicExtractBuilderFacts("hey, help", null)
    expect(choicesForFirstSite(starter, false)).toEqual([])
  })

  it("refuses legal skip", () => {
    const facts = heuristicExtractBuilderFacts("Schilderbedrijf in Breda voor binnen en buiten.", null)
    expect(() => buildRawIntakeFromBuilderFacts({
      facts,
      contact: { name: "Jan", email: "jan@example.com", phone: "" },
      legal: { businessUseAccepted: false, termsAccepted: true, marketingOptIn: false },
    })).toThrow(/zakelijke verklaring/)
  })

  it("does not title-case a vibe into a company name", () => {
    const facts = heuristicExtractBuilderFacts("ik ben speciaal", null)
    expect(facts.businessName).toBe("Nieuw bedrijf")
    expect(firstSiteMissing(facts)).toEqual(expect.arrayContaining(["diensten", "plaats", "contactvoorkeur"]))
  })

  it("treats a leading place before a service list as gebied, not a dienst", () => {
    const facts = heuristicExtractBuilderFacts("mars, badkamers omdraaien en gras aanraken", null)
    expect(facts.region).toBe("Mars")
    expect(facts.offers.map((offer) => offer.value)).toEqual(["Badkamers Omdraaien", "Gras Aanraken"])
    expect(facts.offers.some((offer) => /^Mars$/i.test(offer.value))).toBe(false)
    const messy = heuristicExtractBuilderFacts("mars, ik die badkamers omdraaien en gras aanraken", null)
    expect(messy.region).toBe("Mars")
    expect(messy.offers.map((offer) => offer.value)).toEqual(["Badkamers Omdraaien", "Gras Aanraken"])
  })

  it("asks look after contact is known, then generates when look is chosen or deferred", () => {
    const afterContact = applyModuleAnswer(
      "bellen",
      heuristicExtractBuilderFacts("Ik ben kapper in Tilburg en doe knippen, kleur en baard.", null),
    )
    expect(firstSiteMissing(afterContact)).toEqual(["uitstraling"])
    expect(choicesForFirstSite(afterContact, false).map((choice) => choice.id)).toEqual([
      "feel-terracotta",
      "feel-blue",
      "feel-emerald",
      "feel-red",
    ])
    expect(canGenerateFirstHomepage(afterContact, "bellen", heuristicExtractBuilderFacts("Ik ben kapper in Tilburg en doe knippen, kleur en baard.", null))).toBe(false)
    const withLook = heuristicExtractBuilderFacts("Strak blauw, modern", afterContact)
    expect(withLook.lookConfirmed).toBe(true)
    expect(withLook.colorSchemeId).toBe("blue-professional")
    expect(canGenerateFirstHomepage(withLook, "Strak blauw, modern", afterContact)).toBe(true)
    expect(canGenerateFirstHomepage(afterContact, "kies maar", afterContact)).toBe(true)
  })

  it("does not overlay contact chips on a mixed identity question", () => {
    const facts = heuristicExtractBuilderFacts("ik ben speciaal", null)
    expect(choicesFromAssistantText(
      "Wat is je bedrijfsnaam, welke diensten bied je, en hoe nemen bezoekers contact op? Bellen of WhatsApp?",
      facts,
    )).toEqual([])
    expect(choicesFromAssistantText("Hoe nemen bezoekers contact op?", heuristicExtractBuilderFacts(
      "Ik ben kapper in Tilburg en doe knippen, kleur en baard.",
      null,
    )).some((choice) => choice.id === "phone")).toBe(true)
  })
})
