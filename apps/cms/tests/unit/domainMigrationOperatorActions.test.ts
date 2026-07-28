import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  getPayload: vi.fn(),
  start: vi.fn(),
  complete: vi.fn(),
  fail: vi.fn(),
  requestWork: vi.fn(),
  rollback: vi.fn(),
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
vi.mock("@/lib/domains/assistedMigration", () => ({
  completeMigrationOperatorWork: mocks.complete,
  failMigrationOperatorWork: mocks.fail,
  requestMigrationOperatorWork: mocks.requestWork,
  requestDomainMigrationRollback: mocks.rollback,
  startMigrationOperatorWork: mocks.start,
}))

import {
  classifySiteinaboxIncidentAction,
  requestDomainMigrationRollbackAction,
  startMigrationOperatorWorkAction,
} from "@/app/(frontend)/(admin)/operations/migrations/actions"

const form = (extra: Record<string, string> = {}) => {
  const data = new FormData()
  data.set("migrationId", "10")
  for (const [key, value] of Object.entries(extra)) data.set(key, value)
  return data
}

describe("domain migration operator actions", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getPayload.mockResolvedValue({ auth: mocks.auth })
    mocks.start.mockResolvedValue({ id: 10 })
    mocks.requestWork.mockResolvedValue({ migration: { id: 10 } })
    mocks.rollback.mockResolvedValue({ id: 10 })
  })

  it("rejects non-super-admin callers before any migration mutation", async () => {
    mocks.auth.mockResolvedValue({
      user: {
        id: 3,
        email: "owner@example.com",
        role: "owner",
      },
    })

    await expect(startMigrationOperatorWorkAction(form())).rejects.toMatchObject({
      location: "/operations/migrations/10?result=start-failed",
    })
    expect(mocks.start).not.toHaveBeenCalled()
    expect(mocks.requestWork).not.toHaveBeenCalled()
    expect(mocks.rollback).not.toHaveBeenCalled()
  })

  it("binds the authenticated super-admin to paid operator work", async () => {
    const user = {
      id: 99,
      email: "operator@siteinabox.nl",
      role: "super-admin",
    }
    mocks.auth.mockResolvedValue({ user })

    await expect(startMigrationOperatorWorkAction(form())).rejects.toMatchObject({
      location: "/operations/migrations/10?result=started",
    })
    expect(mocks.start).toHaveBeenCalledWith(expect.anything(), {
      migrationId: "10",
      actor: user,
    })
  })

  it("classifies only explicitly bounded Siteinabox incident recovery", async () => {
    mocks.auth.mockResolvedValue({
      user: {
        id: 99,
        email: "operator@siteinabox.nl",
        role: "super-admin",
      },
    })

    await expect(classifySiteinaboxIncidentAction(form({
      workScopeCode: "restore_siab_website_records",
    }))).rejects.toMatchObject({
      location: "/operations/migrations/10?result=incident-authorized",
    })
    expect(mocks.requestWork).toHaveBeenCalledWith(expect.anything(), {
      migrationId: "10",
      requestedClassification: "assisted_standard",
      workCause: "siteinabox_incident_recovery",
      workScope: "restore_siab_website_records",
    })
  })

  it("queues rollback only with an approved redacted reason code", async () => {
    const user = {
      id: 99,
      email: "operator@siteinabox.nl",
      role: "super-admin",
    }
    mocks.auth.mockResolvedValue({ user })

    await expect(requestDomainMigrationRollbackAction(form({
      reasonCode: "operator_detected_dns_mismatch",
    }))).rejects.toMatchObject({
      location: "/operations/migrations/10?result=rollback-requested",
    })
    expect(mocks.rollback).toHaveBeenCalledWith(expect.anything(), {
      migrationId: "10",
      actor: user,
      reasonCode: "operator_detected_dns_mismatch",
    })
  })
})
