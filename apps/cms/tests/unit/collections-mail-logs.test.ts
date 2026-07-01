import { describe, expect, it } from "vitest"
import { MailLogs } from "@/collections/MailLogs"

const findField = (name: string): any => MailLogs.fields.find((field: any) => field.name === name)

describe("MailLogs collection config", () => {
  it("uses a metadata-only admin list that supports operational filtering", () => {
    expect(MailLogs.slug).toBe("mail-logs")
    expect(MailLogs.admin?.defaultColumns).toEqual([
      "flow",
      "status",
      "retryState",
      "provider",
      "sender",
      "recipient",
      "tenant",
      "createdAt",
    ])
    expect(MailLogs.admin?.listSearchableFields).toEqual(["sender", "recipient", "provider"])
  })

  it("indexes the fields operators need for admin list filters", () => {
    for (const fieldName of ["flow", "tenant", "status", "retryState", "provider", "sender", "recipient"]) {
      expect(findField(fieldName), fieldName).toMatchObject({ index: true })
    }
  })
})
