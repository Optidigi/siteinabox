import assert from "node:assert/strict"
import { test } from "node:test"
import { appointmentDateKey, addDaysToDateKey, previewAppointmentAvailability } from "./appointment-behavior.ts"

test("appointment preview availability is deterministic and bounded to weekdays", () => {
  const first = previewAppointmentAvailability("2026-09-07", "2026-09-13")
  const second = previewAppointmentAvailability("2026-09-07", "2026-09-13")

  assert.deepEqual(first, second)
  assert.equal(first.from, "2026-09-07")
  assert.equal(first.to, "2026-09-13")
  assert.equal(first.slots.length, 15)
  assert.ok(first.slots.every((slot) => {
    const weekday = new Date(slot.startAt).getUTCDay()
    return weekday !== 0 && weekday !== 6
  }))
})

test("appointment date helpers use stable local-date values", () => {
  assert.equal(appointmentDateKey(2026, 9, 7), "2026-09-07")
  assert.equal(addDaysToDateKey("2026-09-30", 1), "2026-10-01")
  assert.equal(addDaysToDateKey("2026-12-31", 1), "2027-01-01")
})
