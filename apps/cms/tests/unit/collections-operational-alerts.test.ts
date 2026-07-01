import { describe, expect, it } from "vitest"
import {
  OperationalAlerts,
  operationalAlertSeverities,
  operationalAlertSources,
  operationalAlertStatuses,
} from "@/collections/OperationalAlerts"

const findField = (name: string): any => OperationalAlerts.fields.find((field: any) => field.name === name)

describe("OperationalAlerts collection config", () => {
  it("is a super-admin operational queue with filterable metadata fields", () => {
    expect(OperationalAlerts.slug).toBe("operational-alerts")
    expect(OperationalAlerts.admin?.defaultColumns).toEqual([
      "severity",
      "status",
      "source",
      "message",
      "tenant",
      "occurrenceCount",
      "lastSeenAt",
    ])
    expect(OperationalAlerts.admin?.listSearchableFields).toEqual(["message", "dedupeKey"])

    expect(findField("severity")).toMatchObject({ type: "select", index: true })
    expect(findField("severity").options.map((option: any) => option.value)).toEqual([...operationalAlertSeverities])
    expect(findField("status")).toMatchObject({ type: "select", index: true })
    expect(findField("status").options.map((option: any) => option.value)).toEqual([...operationalAlertStatuses])
    expect(findField("source")).toMatchObject({ type: "select", index: true })
    expect(findField("source").options.map((option: any) => option.value)).toEqual([...operationalAlertSources])

    for (const fieldName of ["dedupeKey", "tenant", "firstSeenAt", "lastSeenAt"]) {
      expect(findField(fieldName), fieldName).toMatchObject({ index: true })
    }
    expect(findField("metadata").admin.description).toContain("Non-secret")
  })
})
