import { beforeEach, describe, expect, it, vi } from "vitest"

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

import { activatePublishedSnapshot } from "@/lib/publish/siteSnapshots"
import { sendLiveHandoffEmailAfterActivation } from "@/lib/publish/liveHandoffEmail"

const approvedPaidRun = {
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
} as any

const verifiedTenant = {
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
} as any

const draftedSnapshot = {
  id: 10,
  tenant: verifiedTenant.id,
  domain: verifiedTenant.domain,
  sourceGenerationRun: approvedPaidRun.id,
  status: "drafted",
  snapshot: {
    siteUrl: "https://clientsite.nl",
  },
} as any

const createActivationPayload = (input?: {
  tenant?: any
  run?: any
  snapshot?: any
  intake?: any
  users?: any[]
}) => {
  const tenant = { ...(input?.tenant ?? verifiedTenant) }
  const run = input?.run ?? approvedPaidRun
  const snapshot = { ...(input?.snapshot ?? draftedSnapshot) }
  const intake = input?.intake ?? {
    id: 700,
    contactEmail: "intake@example.com",
    normalized: { contact: { email: "normalized-intake@example.com" } },
  }
  const users = [...(input?.users ?? [])]
  const acceptances = [{ id: 880, tenant: tenant.id, actorEmail: "customer@example.com" }]
  const updates: any[] = []
  const payload = {
    findByID: vi.fn(async ({ collection, id }: any) => {
      if (collection === "published-site-snapshots" && String(id) === String(snapshot.id)) return snapshot
      if (collection === "tenants" && String(id) === String(tenant.id)) return tenant
      if (collection === "site-generation-runs" && String(id) === String(run.id)) return run
      if (collection === "intake-submissions" && String(id) === String(intake.id)) return intake
      throw new Error(`Missing ${collection} ${id}`)
    }),
    find: vi.fn(async ({ collection, where }: any = {}) => {
      if (collection === "users") {
        const email = where?.email?.equals
        return { docs: users.filter((user) => user.email === email) }
      }
      if (collection === "agreement-acceptances") {
        const clauses = where?.and ?? []
        const tenantId = clauses.find((clause: any) => clause.tenant)?.tenant?.equals
        const actorEmail = clauses.find((clause: any) => clause.actorEmail)?.actorEmail?.equals
        return { docs: acceptances.filter((item) => String(item.tenant) === String(tenantId) && item.actorEmail === actorEmail) }
      }
      return { docs: [] }
    }),
    create: vi.fn(async ({ collection, data }: any) => {
      if (collection === "users") {
        const created = { id: users.length + 100, ...data }
        users.push(created)
        return created
      }
      return { id: 900, ...data }
    }),
    update: vi.fn(async ({ collection, id, data }: any) => {
      updates.push({ collection, data })
      if (collection === "tenants") {
        Object.assign(tenant, data)
        return tenant
      }
      if (collection === "published-site-snapshots") {
        Object.assign(snapshot, data)
        return snapshot
      }
      if (collection === "users") {
        const user = users.find((candidate) => String(candidate.id) === String(id))
        if (!user) throw new Error(`Missing user ${id}`)
        Object.assign(user, data)
        return user
      }
      return { ...data }
    }),
    logger: { warn: vi.fn(), error: vi.fn() },
  }
  return { payload: payload as any, tenant, run, snapshot, updates, users }
}

describe("CMS live handoff email", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.sendEmail.mockResolvedValue({ provider: "test" })
    mocks.signInMagicLink.mockResolvedValue({ ok: true })
  })

  it("ensures customer CMS access and requests one live handoff magic-login email after generated-site activation", async () => {
    const { payload, users } = createActivationPayload()

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
        callbackURL: "https://admin.clientsite.nl",
        errorCallbackURL: "https://admin.clientsite.nl/login",
        metadata: expect.objectContaining({
          intent: "site_live_handoff",
          recipientEmail: "customer@example.com",
          siteUrl: "https://clientsite.nl",
          adminUrl: "https://admin.clientsite.nl",
          tenantId: "1",
          _siabPrivilegedSignature: expect.any(String),
        }),
      }),
      headers: expect.any(Headers),
    }))
    const authHeaders = mocks.signInMagicLink.mock.calls[0]?.[0].headers as Headers
    expect(authHeaders.get("host")).toBe("admin.clientsite.nl")
    expect(authHeaders.get("x-forwarded-host")).toBe("admin.clientsite.nl")
    expect(authHeaders.get("x-forwarded-proto")).toBe("https")
    expect(mocks.sendEmail).not.toHaveBeenCalled()
  })

  it("reuses an existing tenant user and promotes it to owner before handoff", async () => {
    const { payload, users, tenant, snapshot, run } = createActivationPayload({
      users: [{
        id: 77,
        email: "customer@example.com",
        role: "viewer",
        tenants: [{ tenant: 1 }],
      }],
    })

    await expect(sendLiveHandoffEmailAfterActivation(payload, {
      tenant,
      run,
      snapshotDoc: snapshot,
    })).resolves.toBe("sent")

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
    const { payload, tenant, snapshot } = createActivationPayload({
      run: {
        ...approvedPaidRun,
        normalizedIntake: { contact: {} },
        generationInput: { normalizedIntake: { contact: {} } },
      },
      intake: { id: 700, contactEmail: null, normalized: { contact: {} } },
    })

    await expect(sendLiveHandoffEmailAfterActivation(payload, {
      tenant,
      run: await payload.findByID({ collection: "site-generation-runs", id: 500 }),
      snapshotDoc: snapshot,
    })).resolves.toBe("skipped")

    expect(mocks.sendEmail).not.toHaveBeenCalled()
    expect(mocks.signInMagicLink).not.toHaveBeenCalled()
    expect(payload.logger.warn).toHaveBeenCalledWith("[publish] live handoff email skipped", expect.objectContaining({
      reason: "missing_recipient",
      tenant: 1,
      generationRun: 500,
      snapshot: 10,
    }))
  })

  it("keeps activation non-blocking after requesting the live handoff magic-login email", async () => {
    const { payload, tenant, snapshot } = createActivationPayload()

    await expect(activatePublishedSnapshot(payload, { snapshotId: 10 })).resolves.toMatchObject({
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
    const rollback = createActivationPayload()
    await expect(activatePublishedSnapshot(rollback.payload, {
      snapshotId: 10,
      rollback: true,
      manualActivation: true,
      activationReason: "manual rollback",
    })).resolves.toMatchObject({ status: "active" })

    const currentState = createActivationPayload({
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

    const reactivation = createActivationPayload({
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
    const { payload, tenant, snapshot, run } = createActivationPayload()
    mocks.signInMagicLink.mockRejectedValue(new Error("auth down"))

    await expect(sendLiveHandoffEmailAfterActivation(payload, {
      tenant,
      run,
      snapshotDoc: snapshot,
    })).resolves.toBe("failed")

    expect(mocks.sendEmail).not.toHaveBeenCalled()
    expect(payload.logger.warn).toHaveBeenCalledWith("[publish] live handoff email failed after activation", expect.objectContaining({
      tenant: 1,
      generationRun: 500,
      snapshot: 10,
      error: "auth down",
    }))
  })

  it("does not create CMS access without initial terms acceptance evidence", async () => {
    const { payload, tenant, snapshot, run } = createActivationPayload()
    payload.find.mockImplementation(async ({ collection }: any) => {
      if (collection === "agreement-acceptances") return { docs: [] }
      if (collection === "users") return { docs: [] }
      return { docs: [] }
    })

    await expect(sendLiveHandoffEmailAfterActivation(payload, {
      tenant,
      run,
      snapshotDoc: snapshot,
    })).resolves.toBe("failed")

    expect(payload.create).not.toHaveBeenCalledWith(expect.objectContaining({ collection: "users" }))
    expect(mocks.signInMagicLink).not.toHaveBeenCalled()
    expect(payload.logger.warn).toHaveBeenCalledWith(
      "[publish] live handoff email failed after activation",
      expect.objectContaining({ error: "Initial Site in a Box terms acceptance evidence is missing." }),
    )
  })
})
