/**
 * @vitest-environment jsdom
 */
import { fireEvent, render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import type {
  CustomerLegalAcceptance,
  CustomerLegalRequirement,
} from "@/lib/legal/customerRequirements"

vi.mock("@/app/(frontend)/(admin)/settings/actions", () => ({
  acceptLegalRequirementAction: vi.fn(),
  objectLegalRequirementAction: vi.fn(),
}))

import { LegalAgreementsSection } from "@/components/legal/LegalAgreementsSection"
import { LegalRequirementBanner } from "@/components/legal/LegalRequirementBanner"

const requirement = (overrides: Partial<CustomerLegalRequirement> = {}): CustomerLegalRequirement => ({
  id: "requirement-1",
  requirementKey: "terms:2026-07",
  action: "mandatory_reaccept",
  status: "notified",
  enforceAt: "2026-07-10T00:00:00.000Z",
  objectionDeadlineAt: null,
  noticeDeliveredAt: null,
  qualifyingUseAt: null,
  resolutionBasis: null,
  canObject: false,
  documentId: "document-1",
  documentType: "platform-terms",
  documentVersion: "2026-07-11.1",
  acceptanceVersion: "customer-reacceptance-2026-07-11.1",
  changeSummary: "We hebben de afspraken over betaling en opzegging verduidelijkt.",
  effectiveAt: "2026-07-01T00:00:00.000Z",
  href: "/juridisch/algemene-voorwaarden/2026-07-11.1",
  requiresAcceptance: true,
  overdue: true,
  isInitialRelease: false,
  ...overrides,
})

const acceptance: CustomerLegalAcceptance = {
  id: "acceptance-1",
  documentVersion: "2026-01-15.1",
  acceptanceVersion: "customer-reacceptance-2026-01-15.1",
  acceptedAt: "2026-01-16T12:00:00.000Z",
  actorEmail: "owner@example.test",
  href: "/juridisch/algemene-voorwaarden/2026-01-15.1",
}

describe("customer legal notices", () => {
  beforeEach(() => {
    document.documentElement.lang = "nl"
  })

  it("uses neutral styling with an inline default acceptance action", () => {
    render(<LegalRequirementBanner requirements={[requirement()]} canAccept locale="nl-NL" />)

    const alert = screen.getByRole("alert")
    expect(alert.className).toContain("bg-card")
    expect(alert.className).not.toContain("warning")
    expect(alert.className).not.toContain("destructive")
    expect(screen.getByRole("button", { name: "Akkoord" }).getAttribute("data-variant")).toBe("default")
  })

  it("shows a meaningful change summary without exposing the active document version", () => {
    const item = requirement()
    const { container } = render(
      <LegalAgreementsSection requirements={[item]} acceptanceHistory={[]} locale="nl-NL" />,
    )

    expect(screen.getByText(item.changeSummary)).toBeTruthy()
    expect(screen.getByRole("heading", { name: "Algemene voorwaarden" })).toBeTruthy()
    expect(screen.getByText("Acceptatie vereist").className).toContain("rounded-sm")
    expect(screen.getByText("Acceptatie vereist").className).toContain("border-warning")
    expect(screen.getByText("Acceptatie vereist").className).toContain("bg-transparent")
    expect(screen.getByText("Acceptatie vereist").className).toContain("text-warning")
    expect(container.textContent).not.toContain(item.documentVersion)
    expect(container.textContent).not.toMatch(/eerste versie/i)
  })

  it("explains an initial release in terms of the customer's required action", () => {
    render(
      <LegalAgreementsSection
        requirements={[requirement({ isInitialRelease: true, changeSummary: "Eerste versie van de algemene voorwaarden voor Site in a Box." })]}
        acceptanceHistory={[]}
        locale="nl-NL"
      />,
    )

    expect(screen.getByText("Deze voorwaarden gelden voor je gebruik van Site in a Box. Bekijk en accepteer ze om de dienstverlening te blijven gebruiken.")).toBeTruthy()
    expect(screen.queryByText(/eerste versie/i)).toBeNull()
  })

  it("keeps document versions inside collapsed acceptance history", () => {
    render(
      <LegalAgreementsSection
        requirements={[requirement()]}
        acceptanceHistory={[acceptance]}
        locale="nl-NL"
      />,
    )

    const disclosure = screen.getByRole("button", { name: /Acceptatiegeschiedenis/ })
    expect(disclosure.getAttribute("aria-expanded")).toBe("false")
    expect(screen.queryByText(new RegExp(acceptance.documentVersion.replaceAll(".", "\\.")))).toBeNull()

    fireEvent.click(disclosure)

    expect(disclosure.getAttribute("aria-expanded")).toBe("true")
    expect(screen.getByText(new RegExp(acceptance.documentVersion.replaceAll(".", "\\.")))).toBeTruthy()
  })
})
