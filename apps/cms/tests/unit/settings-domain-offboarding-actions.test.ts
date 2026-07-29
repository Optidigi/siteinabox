import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  captureEvidence: vi.fn(),
  getContext: vi.fn(),
  getPayload: vi.fn(),
  recoverBilling: vi.fn(),
  queuePreparation: vi.fn(),
  requestOffboarding: vi.fn(),
}))

class RedirectSignal extends Error {
  constructor(readonly location: string) {
    super(`redirect:${location}`)
  }
}

vi.mock("next/headers", () => ({
  headers: vi.fn(async () => new Headers({ "x-request-id": "request-1" })),
}))
vi.mock("next/navigation", () => ({
  redirect: vi.fn((location: string): never => {
    throw new RedirectSignal(location)
  }),
}))
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }))
vi.mock("payload", () => ({ getPayload: mocks.getPayload }))
vi.mock("@/payload.config", () => ({ default: {} }))
vi.mock("@/lib/context", () => ({ getSiabContext: mocks.getContext }))
vi.mock("@/lib/billing/billingLifecycle", () => ({
  scheduleCancellationAtPeriodEnd: vi.fn(),
}))
vi.mock("@/lib/payments/molliePayments", () => ({
  createMandateRecoveryMolliePayment: mocks.recoverBilling,
}))
vi.mock("@/lib/legal/customerRequirements", () => ({
  acceptCustomerLegalRequirement: vi.fn(),
  objectToNoticeAndContinuedUse: vi.fn(),
}))
vi.mock("@/lib/legal/statements", () => ({ legalStatements: {} }))
vi.mock("@/lib/legal/communicationPreferences", () => ({
  findCommunicationPreference: vi.fn(),
  mutateCommunicationPreference: vi.fn(),
  mutateCommunicationPreferenceSet: vi.fn(),
  upsertTenantNotificationSubscription: vi.fn(),
}))
vi.mock("@/lib/domains/offboarding", () => ({
  captureDomainOffboardingContinuityEvidence: mocks.captureEvidence,
  confirmDomainTransferCompletedByCustomer: vi.fn(),
  markDomainTransferOutStarted: vi.fn(),
  requestDomainOffboarding: mocks.requestOffboarding,
  revealDomainTransferOutCode: vi.fn(),
}))
vi.mock("@/lib/jobs/prepareDomainTransferOutTask", () => ({
  queueDomainTransferOutPreparation: mocks.queuePreparation,
}))

import { recoverBillingAgreementAction, requestDomainTransferOutAction } from
  "@/app/(frontend)/(admin)/settings/actions"

const form = () => {
  const data = new FormData()
  data.set("managedDomainId", "10")
  data.set("reason", "Customer requested registrar transfer.")
  data.set("preserveServices", "confirmed")
  return data
}

describe("authenticated domain-offboarding server action", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getPayload.mockResolvedValue({ auth: mocks.auth })
    mocks.getContext.mockResolvedValue({
      mode: "tenant",
      tenant: { id: 1 },
    })
    mocks.captureEvidence.mockResolvedValue({ schemaVersion: 2 })
    mocks.requestOffboarding.mockResolvedValue({ id: 10 })
  })

  it("does not log provider details or customer data when billing recovery fails", async () => {
    mocks.auth.mockResolvedValue({
      user: {
        id: 1,
        email: "owner@example.com",
        role: "owner",
        tenants: [{ tenant: 1 }],
      },
    })
    mocks.recoverBilling.mockRejectedValue(
      new Error("Mollie cst_private failed for owner@example.com"),
    )
    const errorLog = vi.spyOn(console, "error").mockImplementation(() => undefined)
    const data = new FormData()
    data.set("billingAgreementId", "900")

    await expect(recoverBillingAgreementAction(data)).rejects.toMatchObject({
      location: "/settings?billing=recovery-failed#billing",
    })

    expect(errorLog).toHaveBeenCalledWith("Billing recovery checkout failed")
    expect(errorLog).not.toHaveBeenCalledWith(
      expect.stringContaining("cst_private"),
      expect.anything(),
    )
    errorLog.mockRestore()
  })

  it("rejects unauthenticated and cross-tenant callers before offboarding", async () => {
    mocks.auth.mockResolvedValueOnce({ user: null })
    await expect(requestDomainTransferOutAction(form())).rejects.toMatchObject({
      location: "/login",
    })
    mocks.auth.mockResolvedValueOnce({
      user: {
        id: 2,
        email: "owner@example.com",
        role: "owner",
        tenants: [{ tenant: 2 }],
      },
    })
    await expect(requestDomainTransferOutAction(form())).rejects.toMatchObject({
      location: "/?error=forbidden",
    })
    expect(mocks.captureEvidence).not.toHaveBeenCalled()
    expect(mocks.requestOffboarding).not.toHaveBeenCalled()
  })

  it("binds the authenticated owner email and tenant to the reviewed service", async () => {
    mocks.auth.mockResolvedValue({
      user: {
        id: 1,
        email: "owner@example.com",
        role: "owner",
        tenants: [{ tenant: 1 }],
      },
    })
    await expect(requestDomainTransferOutAction(form())).rejects.toMatchObject({
      location: "/settings?domainTransfer=requested#domain-transfer",
    })
    expect(mocks.captureEvidence).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        managedDomainId: "10",
        actor: { email: "owner@example.com", tenantId: "1" },
      }),
    )
    expect(mocks.requestOffboarding).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        managedDomainId: "10",
        actor: { email: "owner@example.com", tenantId: "1" },
        requestId: "request-1",
      }),
    )
    expect(mocks.queuePreparation).toHaveBeenCalledWith(
      expect.anything(),
      10,
    )
  })
})
