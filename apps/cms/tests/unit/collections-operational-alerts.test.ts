import { describe, expect, it } from "vitest"
import {
  OperationalAlerts,
  operationalAlertSeverities,
  operationalAlertSources,
  operationalAlertStatuses,
} from "@/collections/OperationalAlerts"

import { asMockDoc } from "../_helpers/cast"
import { expectNamedField, fieldOptionValues, fieldOptions } from "../_helpers/payloadFields"

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

    expect(expectNamedField(OperationalAlerts.fields, "severity")).toMatchObject({ type: "select", index: true })
    expect(fieldOptionValues(fieldOptions(expectNamedField(OperationalAlerts.fields, "severity")))).toEqual([...operationalAlertSeverities])
    expect(expectNamedField(OperationalAlerts.fields, "status")).toMatchObject({ type: "select", index: true })
    expect(fieldOptionValues(fieldOptions(expectNamedField(OperationalAlerts.fields, "status")))).toEqual([...operationalAlertStatuses])
    expect(expectNamedField(OperationalAlerts.fields, "source")).toMatchObject({ type: "select", index: true })
    expect(fieldOptionValues(fieldOptions(expectNamedField(OperationalAlerts.fields, "source")))).toEqual([...operationalAlertSources])

    for (const fieldName of ["dedupeKey", "tenant", "firstSeenAt", "lastSeenAt"]) {
      expect(expectNamedField(OperationalAlerts.fields, fieldName), fieldName).toMatchObject({ index: true })
    }
    expect(asMockDoc(expectNamedField(OperationalAlerts.fields, "metadata").admin).description).toEqual({
      en: "Non-secret operational metadata only.",
      nl: "Alleen niet-geheime operationele metadata.",
    })
  })
})
