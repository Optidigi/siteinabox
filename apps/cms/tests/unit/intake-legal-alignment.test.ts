import { describe, expect, it } from "vitest"
import { CURRENT_INTAKE_TERMS_ACCEPTANCE } from "@siteinabox/contracts"
import { getCurrentLegalDocument } from "@siteinabox/legal-content"

describe("intake legal release alignment", () => {
  it("requires intake acceptance evidence to match the effective platform terms", () => {
    const terms = getCurrentLegalDocument("platform-terms", "nl")
    expect(CURRENT_INTAKE_TERMS_ACCEPTANCE).toEqual({
      documentVersion: terms.documentVersion,
      acceptanceVersion: terms.acceptanceVersion,
      statementVersion: `platform-terms-acceptance-${terms.documentVersion}`,
      contentHash: terms.contentHash,
      url: `https://www.siteinabox.nl${terms.permanentPath}`,
    })
  })
})
