import { beforeEach, describe, expect, it, vi } from "vitest"

import { asGenerationRun, asMockDoc, asPublishedSnapshot, asTenant } from "../_helpers/cast"
import type { Tenant, SiteGenerationRun, PublishedSiteSnapshot, IntakeSubmission, User } from "@/payload-types"
import type { MockDoc } from "../_helpers/mockPayload"
import { createInitializedTestPayload, createTestPayload } from "../_helpers/testPayload"
import { tenantFixture, generationRunFixture, publishedSnapshotFixture, intakeSubmissionFixture, userFixture, agreementAcceptanceFixture, operationalAlertFixture, paginatedFixture } from "../_helpers/generatedDocs"
const mocks = vi.hoisted(() => ({
  sendEmail: vi.fn(),
  signInMagicLink: vi.fn(),
}))

vi.mock("@/lib/email/sendEmail", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/email/sendEmail")>()
  return {
    ...actual,
    getPlatformMailSender: () => "noreply@siteinabox.nl",
    sendEmail: mocks.sendEmail,
  }
})

vi.mock("@/lib/betterAuth", () => ({
  auth: {
    api: {
      signInMagicLink: mocks.signInMagicLink,
    },
  },
}))

import { MailSendError } from "@/lib/email/sendEmail"
import { activatePublishedSnapshot } from "@/lib/publish/siteSnapshots"
import { sendLiveHandoffEmailAfterActivation } from "@/lib/publish/liveHandoffEmail"

const approvedPaidRun = generationRunFixture({
  id: 500,
  intakeSubmission: 700,
  tenant: 1,
  normalizedIntake: {
    contact: {
      email: "Customer@Example.com",
    },
  },
  clientApproval: { status: "approved" },
  payment: { status: "completed" },
})

const verifiedTenant = tenantFixture({
  id: 1,
  domain: "clientsite.nl",
  status: "provisioning",
  domainVerification: { status: "verified" },
  emailSending: {
    provider: "cloudflare",
    mode: "subdomain",
    status: "verified",
    sendingDomain: "mail.clientsite.nl",
    senderEmail: "noreply@mail.clientsite.nl",
  },
})

const draftedSnapshot = publishedSnapshotFixture({
  id: 10,
  tenant: verifiedTenant.id,
  domain: verifiedTenant.domain,
  sourceGenerationRun: approvedPaidRun.id,
  status: "drafted",
  snapshot: {
    siteUrl: "https://clientsite.nl",
  },
})

const createActivationPayload = async (input?: {
  tenant?: Partial<Tenant>; run?: Partial<SiteGenerationRun> | null; snapshot?: Partial<PublishedSiteSnapshot>; intake?: Partial<IntakeSubmission>; users?: Partial<User>[]
}) => {
  const tenant = tenantFixture(input?.tenant ?? verifiedTenant)
  const run = input?.run === null ? null : generationRunFixture(input?.run ?? approvedPaidRun)
  const snapshot = publishedSnapshotFixture(input?.snapshot ?? draftedSnapshot)
  const intake = intakeSubmissionFixture(input?.intake ?? { id: 700, contactEmail: "intake@example.com", normalized: { contact: { email: "normalized-intake@example.com" } } })
  const users = (input?.users ?? []).map(user => userFixture(user))
  const acceptances = [agreementAcceptanceFixture({ id: 880, tenant: tenant.id, actorEmail: "customer@example.com" })]
  const alerts: ReturnType<typeof operationalAlertFixture>[] = []
  const updates: MockDoc[] = []
  const payload = createTestPayload()
  payload.logger = (await createInitializedTestPayload()).logger
  vi.spyOn(payload, "findByID").mockImplementation(async ({ collection, id }) => {
    if (collection === "published-site-snapshots" && String(id) === String(snapshot.id)) return snapshot
    if (collection === "tenants" && String(id) === String(tenant.id)) return tenant
    if (collection === "site-generation-runs" && run && String(id) === String(run.id)) return run
    if (collection === "intake-submissions" && String(id) === String(intake.id)) return intake
    throw new Error("Missing " + collection + " " + id)
  })
  const find = vi.spyOn(payload, "find").mockImplementation(async ({ collection, where }) => {
    if (collection === "operational-alerts") return paginatedFixture(alerts.filter(alert => alert.dedupeKey === asMockDoc(where?.dedupeKey).equals))
    if (collection === "users") {
      const email = asMockDoc(asMockDoc(where).email).equals
      return paginatedFixture(users.filter(user => user.email === email))
    }
    if (collection === "agreement-acceptances") {
      const clauses = Array.isArray(where?.and) ? where.and : []
      const tenantId = asMockDoc(clauses.find(clause => clause.tenant)?.tenant).equals
      const actorEmail = asMockDoc(clauses.find(clause => clause.actorEmail)?.actorEmail).equals
      return paginatedFixture(acceptances.filter(item => String(item.tenant) === String(tenantId) && item.actorEmail === actorEmail))
    }
    return paginatedFixture([])
  })
  vi.spyOn(payload, "create").mockImplementation(async ({ collection, data }) => {
    if (collection === "operational-alerts") {
      const alert = operationalAlertFixture({ id: alerts.length + 900 })
      Object.assign(alert, data)
      alerts.push(alert)
      return alert
    }
    if (collection !== "users") throw new Error("Unexpected create " + collection)
    const created = userFixture({ id: users.length + 100 })
    Object.assign(created, data)
    users.push(created)
    return created
  })
  vi.spyOn(payload, "update").mockImplementation(async ({ collection, id, data }) => {
    updates.push({ collection, data })
    if (collection === "tenants") return Object.assign(tenant, data)
    if (collection === "published-site-snapshots") return Object.assign(snapshot, data)
    if (collection === "users") {
      const user = users.find(candidate => String(candidate.id) === String(id))
      if (!user) throw new Error("Missing user " + id)
      return Object.assign(user, data)
    }
    throw new Error("Unexpected update " + collection)
  })
  vi.spyOn(payload.logger, "warn")
  vi.spyOn(payload.logger, "error")
  return { payload, find, tenant, run, snapshot, updates, users, alerts }
}

describe("CMS live handoff email", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.sendEmail.mockResolvedValue({ provider: "test" })
    mocks.signInMagicLink.mockResolvedValue({ ok: true })
  })

  it("ensures customer CMS access and requests one live handoff magic-login email after generated-site activation", async () => {
    const { payload, users } = await createActivationPayload()

    await expect(activatePublishedSnapshot(payload, {
      snapshotId: 10,
      manualActivation: true,
      activatedBy: 1,
      activationReason: "manual activation",
    })).resolves.toMatchObject({ id: 10, status: "active" })

    expect(payload.create).toHaveBeenCalledWith(expect.objectContaining({
      collection: "users",
      data: expect.objectContaining({
        email: "customer@example.com",
        role: "owner",
        tenants: [{ tenant: 1 }],
        password: expect.any(String),
      }),
      overrideAccess: true,
    }))
    expect(users[0]).toMatchObject({
      email: "customer@example.com",
      role: "owner",
      tenants: [{ tenant: 1 }],
    })
    expect(mocks.signInMagicLink).toHaveBeenCalledWith(expect.objectContaining({
      body: expect.objectContaining({
        email: "customer@example.com",
        callbackURL: "https://admin.siteinabox.nl",
        errorCallbackURL: "https://admin.siteinabox.nl/login",
        metadata: expect.objectContaining({
          intent: "site_live_handoff",
          recipientEmail: "customer@example.com",
          siteUrl: "https://clientsite.nl",
          adminUrl: "https://admin.siteinabox.nl",
          tenantId: "1",
          _siabPrivilegedSignature: expect.any(String),
        }),
      }),
      headers: expect.any(Headers),
    }))
    const authHeaders = mocks.signInMagicLink.mock.calls[0]?.[0].headers as Headers
    expect(authHeaders.get("host")).toBe("admin.siteinabox.nl")
    expect(authHeaders.get("x-forwarded-host")).toBe("admin.siteinabox.nl")
    expect(authHeaders.get("x-forwarded-proto")).toBe("https")
    expect(mocks.sendEmail).not.toHaveBeenCalled()
  })

  it("reuses an existing tenant user and promotes it to owner before handoff", async () => {
    const { payload, users, tenant, snapshot, run } = await createActivationPayload({
      users: [{
        id: 77,
        email: "customer@example.com",
        role: "viewer",
        tenants: [{ tenant: 1 }],
      }],
    })

    const result = await sendLiveHandoffEmailAfterActivation(payload, {
      tenant: asTenant(tenant),
      run: asGenerationRun(run),
      snapshotDoc: asPublishedSnapshot(snapshot),
    })
    expect(result).toBe("sent")

    expect(payload.create).not.toHaveBeenCalled()
    expect(payload.update).toHaveBeenCalledWith(expect.objectContaining({
      collection: "users",
      id: 77,
      data: expect.objectContaining({
        role: "owner",
        tenants: [{ tenant: 1 }],
      }),
      overrideAccess: true,
    }))
    expect(users[0]).toMatchObject({ role: "owner", tenants: [{ tenant: 1 }] })
    expect(mocks.signInMagicLink).toHaveBeenCalledTimes(1)
    expect(mocks.sendEmail).not.toHaveBeenCalled()
  })

  it("skips live handoff when a generated run has no customer recipient", async () => {
    const { payload, tenant, snapshot } = await createActivationPayload({
      run: {
        ...approvedPaidRun,
        normalizedIntake: { contact: {} },
        generationInput: { normalizedIntake: { contact: {} } },
      },
      intake: { id: 700, contactEmail: null, normalized: { contact: {} } },
    })

    await expect(sendLiveHandoffEmailAfterActivation(payload, {
      tenant: asTenant(tenant),
      run: asGenerationRun(await payload.findByID({ collection: "site-generation-runs", id: 500 })),
      snapshotDoc: asPublishedSnapshot(snapshot),
    })).resolves.toBe("skipped")

    expect(mocks.sendEmail).not.toHaveBeenCalled()
    expect(mocks.signInMagicLink).not.toHaveBeenCalled()
    expect(payload.logger.warn).toHaveBeenCalledWith(expect.objectContaining({
      reason: "missing_recipient",
      tenant: 1,
      generationRun: 500,
      snapshot: 10,
    }), "[publish] live handoff email skipped")
  })

  it("keeps activation non-blocking after requesting the live handoff magic-login email", async () => {
    const { payload, tenant, snapshot } = await createActivationPayload()

    await expect(activatePublishedSnapshot(payload, {
      snapshotId: 10,
      manualActivation: true,
    })).resolves.toMatchObject({
      id: 10,
      status: "active",
    })

    expect(tenant.status).toBe("active")
    expect(snapshot.status).toBe("active")
    expect(mocks.signInMagicLink).toHaveBeenCalledTimes(1)
    expect(mocks.sendEmail).not.toHaveBeenCalled()
    expect(payload.logger.warn).not.toHaveBeenCalled()
  })

  it("does not send normal live handoff for rollback, current-state activation, or reactivation", async () => {
    const rollback = await createActivationPayload()
    await expect(activatePublishedSnapshot(rollback.payload, {
      snapshotId: 10,
      rollback: true,
      manualActivation: true,
      activationReason: "manual rollback",
    })).resolves.toMatchObject({ status: "active" })

    const currentState = await createActivationPayload({
      run: null,
      snapshot: {
        ...draftedSnapshot,
        sourceGenerationRun: null,
      },
    })
    await expect(activatePublishedSnapshot(currentState.payload, {
      snapshotId: 10,
      manualActivation: true,
    })).resolves.toMatchObject({ status: "active" })

    const reactivation = await createActivationPayload({
      snapshot: {
        ...draftedSnapshot,
        status: "superseded",
      },
    })
    await expect(activatePublishedSnapshot(reactivation.payload, {
      snapshotId: 10,
      manualActivation: true,
    })).resolves.toMatchObject({ status: "active" })

    expect(mocks.sendEmail).not.toHaveBeenCalled()
    expect(mocks.signInMagicLink).not.toHaveBeenCalled()
  })

  it("does not send final handoff when the CMS access magic link cannot be created", async () => {
    const { payload, tenant, snapshot, run } = await createActivationPayload()
    mocks.signInMagicLink.mockRejectedValue(new Error("auth down"))

    await expect(sendLiveHandoffEmailAfterActivation(payload, {
      tenant: asTenant(tenant),
      run: asGenerationRun(run),
      snapshotDoc: asPublishedSnapshot(snapshot),
    })).resolves.toBe("failed")

    expect(mocks.sendEmail).not.toHaveBeenCalled()
    expect(payload.logger.warn).toHaveBeenCalledWith(expect.objectContaining({
      tenant: 1,
      generationRun: 500,
      snapshot: 10,
      error: "auth down",
    }), "[publish] live handoff email failed after activation")
  })

  it("keeps an activated snapshot successful when direct handoff mail is uncertain", async () => {
    const { payload, tenant, snapshot, alerts } = await createActivationPayload()
    mocks.signInMagicLink.mockRejectedValueOnce(new MailSendError({ provider: "test", providerErrorCode: "E_PROVIDER_WRITE_INDETERMINATE", providerErrorMessage: "response lost", retryState: "permanent" }))
    await expect(activatePublishedSnapshot(payload, { snapshotId: snapshot.id, manualActivation: true })).resolves.toMatchObject({ status: "active" })
    expect(tenant.status).toBe("active")
    expect(snapshot.status).toBe("active")
    expect(alerts).toEqual([expect.objectContaining({ status: "open", tenant: tenant.id, dedupeKey: `commerce:domains:live_handoff_mail_failed:${snapshot.id}` })])
    expect(payload.logger.warn).toHaveBeenCalledWith(expect.objectContaining({ tenant: tenant.id }), "[publish] live handoff email failed after activation")
    expect(mocks.signInMagicLink).toHaveBeenCalledOnce()
  })

  it("preserves uncertain mail acceptance from magic-link dispatch", async () => {
    const { payload, tenant, snapshot, run } = await createActivationPayload()
    const error = new MailSendError({ provider: "test", providerErrorCode: "E_PROVIDER_WRITE_INDETERMINATE", providerErrorMessage: "response lost", retryState: "permanent" })
    mocks.signInMagicLink.mockRejectedValueOnce(error)
    await expect(sendLiveHandoffEmailAfterActivation(payload, { tenant, run, snapshotDoc: snapshot, propagateMailErrors: true })).rejects.toBe(error)
    expect(mocks.sendEmail).not.toHaveBeenCalled()
  })

  it("does not create CMS access without initial terms acceptance evidence", async () => {
    const { payload, find, tenant, snapshot, run } = await createActivationPayload()
    find.mockImplementation(async () => paginatedFixture([]))

    await expect(sendLiveHandoffEmailAfterActivation(payload, {
      tenant: asTenant(tenant),
      run: asGenerationRun(run),
      snapshotDoc: asPublishedSnapshot(snapshot),
    })).resolves.toBe("failed")

    expect(payload.create).not.toHaveBeenCalledWith(expect.objectContaining({ collection: "users" }))
    expect(mocks.signInMagicLink).not.toHaveBeenCalled()
    expect(payload.logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({ error: "Initial Site in a Box terms acceptance evidence is missing." }),
      "[publish] live handoff email failed after activation",
    )
  })
})
