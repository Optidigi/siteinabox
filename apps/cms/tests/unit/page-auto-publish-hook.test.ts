import { beforeEach, describe, expect, it, vi } from "vitest"
import type { User } from "@/payload-types"

import { cast } from "../_helpers/cast"
import { hookArgsFor } from "../_helpers/hookFixtures"
import { asPayload } from "../_helpers/mockPayload"

const mocks = vi.hoisted(() => ({ publishCurrentTenantState: vi.fn() }))
vi.mock("@/lib/publish/currentState", () => mocks)

import {
  publishPageAfterUserSave,
} from "@/hooks/publishPageAfterUserSave"
import { DEFER_PAGE_AUTO_PUBLISH_HEADER } from "@/lib/publish/pageEditorSaveContract"

const user = cast<User>({ id: 8, role: "editor", tenants: [{ tenant: 7 }], updatedAt: "", createdAt: "", email: "editor@test.local" })
const sessionHeaders = () => new Headers({ cookie: "payload-token=test-session" })
const payload = asPayload({ marker: "payload" })

const invoke = (overrides: Record<string, unknown> = {}) => publishPageAfterUserSave(hookArgsFor(publishPageAfterUserSave, {
  doc: { id: 24, tenant: 7, status: "published" },
  req: { user, payload, headers: sessionHeaders() },
  ...overrides,
}))

describe("page save publication fallback", () => {
  beforeEach(() => mocks.publishCurrentTenantState.mockReset())

  it("publishes authenticated legacy editor saves", async () => {
    await invoke()

    expect(mocks.publishCurrentTenantState).toHaveBeenCalledWith(
      payload,
      {
        tenantId: "7",
        user,
        reason: "auto-publish current CMS state after page 24 save",
      },
    )
  })

  it("defers current editor saves until related writes finish", async () => {
    await invoke({
      req: {
        user,
        payload,
        headers: new Headers({
          cookie: "payload-token=test-session",
          [DEFER_PAGE_AUTO_PUBLISH_HEADER]: "1",
        }),
      },
    })

    expect(mocks.publishCurrentTenantState).not.toHaveBeenCalled()
  })

  it("does not publish unauthenticated or draft writes", async () => {
    await invoke({ req: { user: null, payload: asPayload({}), headers: new Headers() } })
    await invoke({ doc: { id: 24, tenant: 7, status: "draft" } })

    expect(mocks.publishCurrentTenantState).not.toHaveBeenCalled()
  })

  it("does not publish Local API or API-key writes without a browser session", async () => {
    await invoke({ req: { user, payload: asPayload({}), headers: new Headers() } })
    await invoke({
      req: {
        user,
        payload: asPayload({}),
        headers: new Headers({ authorization: "users API-Key test" }),
      },
    })

    expect(mocks.publishCurrentTenantState).not.toHaveBeenCalled()
  })
})
