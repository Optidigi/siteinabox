import { readFileSync } from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"

const read = (relativePath: string) => readFileSync(path.resolve(process.cwd(), relativePath), "utf8")

describe("tenant email preference settings", () => {
  it("keeps personal preference writes bound to the authenticated user", () => {
    const source = read("src/app/(frontend)/(admin)/settings/actions.ts")
    expect(source).toContain("email: user.email")
    expect(source).toContain("userId: user.id")
    expect(source).toContain("tenantId,")
    expect(source).toContain('type: "marketing" as const')
    expect(source).toContain('type: "product_notification" as const')
  })

  it("allows only owners to configure tenant operational routing", () => {
    const source = read("src/app/(frontend)/(admin)/settings/actions.ts")
    expect(source).toContain('if (user.role !== "owner") redirect("/?error=forbidden")')
    expect(source).toContain("targetTenantId !== tenantId")
    expect(source).toContain("upsertTenantNotificationSubscription")

    const operationalAction = source.slice(source.indexOf("export async function updateTenantNotificationSubscriptionAction"))
    expect(operationalAction).not.toContain('mutation: { type: "marketing"')
  })

  it("shows personal preferences to tenant members and owner-only routing controls", () => {
    const page = read("src/app/(frontend)/(admin)/settings/page.tsx")
    expect(page).toContain("<EmailPreferencesSection")
    expect(page).toContain("canManageTenantNotifications={isOwner}")
    expect(page).toContain("{isOwner && settings && (")
  })
})
