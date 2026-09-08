import { describe, expect, it } from "vitest"
import { defaultLocale, localeFromAcceptLanguage, normaliseLocale, resolveLocale } from "@/i18n/config"
import { encodeWorkflowTextKey, sanitizeWorkflowTextMessages } from "@/i18n/workflowText"

describe("i18n locale config", () => {
  it("normalises supported regional variants to their base locale", () => {
    expect(normaliseLocale("nl-NL")).toBe("nl")
    expect(normaliseLocale("en-US")).toBe("en")
    expect(normaliseLocale("de-DE")).toBeNull()
  })

  it("uses Accept-Language quality values when resolving browser locale", () => {
    expect(localeFromAcceptLanguage("de-DE,de;q=0.9,nl-NL;q=0.8,en;q=0.7")).toBe("nl")
    expect(localeFromAcceptLanguage("en-US;q=0.4,nl;q=0.9")).toBe("nl")
  })

  it("falls back to the default locale when no candidate is supported", () => {
    expect(defaultLocale).toBe("nl")
    expect(resolveLocale("fr", null, undefined)).toBe(defaultLocale)
  })
})

describe("operations workflowText keys", () => {
  it("encodes periods so next-intl does not treat sentence keys as nested paths", () => {
    const source = "A workflow step needs operator recovery."
    expect(source).toContain(".")
    expect(encodeWorkflowTextKey(source)).not.toContain(".")
    expect(sanitizeWorkflowTextMessages({ [source]: "Herstel" })[encodeWorkflowTextKey(source)]).toBe("Herstel")
  })
})
