import { describe, expect, it } from "vitest"
import { buildStatusInventory, normalizeInventoryHostname } from "@/lib/statusInventory"

describe("status inventory", () => {
  it("emits public and CMS checks for active tenants", () => {
    const inventory = buildStatusInventory([
      { id: 42, domain: "Ami-Care.nl", status: "active" },
      { id: 43, domain: "draft.test", status: "provisioning" },
    ], new Date("2026-07-15T20:00:00Z"))
    expect(inventory.generation).toBe("2026-07-15T20:00:00Z")
    expect(inventory.services).toEqual([
      expect.objectContaining({ hostname: "ami-care.nl", tenantId: "42", kind: "tenant-public" }),
      expect.objectContaining({ hostname: "admin.ami-care.nl", tenantId: "42", kind: "tenant-cms" }),
    ])
  })

  it("rejects malformed hostnames", () => {
    expect(normalizeInventoryHostname("not a domain")).toBeNull()
    expect(normalizeInventoryHostname("https://valid.example/path")).toBe("valid.example")
  })

  it("explicitly permits an authoritative empty active-tenant snapshot", () => {
    expect(buildStatusInventory([])).toMatchObject({ allowEmpty: true, services: [] })
  })
})
