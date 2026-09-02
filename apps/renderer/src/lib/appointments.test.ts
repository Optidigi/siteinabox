import assert from "node:assert/strict"
import test from "node:test"
import {
  cmsAppointmentsAvailabilityEndpoint,
  parseAppointmentAvailabilityResponse,
  parseAppointmentBookingResponse,
  readPublicAppointmentBody,
} from "./appointments"

test("builds a tenant-scoped CMS availability endpoint", () => {
  const previous = process.env.SIAB_CMS_URL
  process.env.SIAB_CMS_URL = "https://cms.example.test"
  try {
    assert.equal(
      cmsAppointmentsAvailabilityEndpoint("7", { from: "2026-09-07", to: "2026-09-08" })?.toString(),
      "https://cms.example.test/api/renderer/appointments/availability?tenantId=7&from=2026-09-07&to=2026-09-08",
    )
  } finally {
    if (previous == null) delete process.env.SIAB_CMS_URL
    else process.env.SIAB_CMS_URL = previous
  }
})

test("normalizes a public booking body without trusting its tenant", async () => {
  const request = new Request("https://ami-care.nl/api/appointments", {
    method: "POST",
    headers: { "content-type": "application/json", referer: "https://ami-care.nl/contact" },
    body: JSON.stringify({
      startAt: "2026-09-07T09:00:00+02:00",
      visitorName: "Ada",
      visitorEmail: "ada@example.test",
    }),
  })
  assert.deepEqual(await readPublicAppointmentBody(request), {
    startAt: "2026-09-07T09:00:00+02:00",
    visitorName: "Ada",
    visitorEmail: "ada@example.test",
    pageUrl: "https://ami-care.nl/contact",
  })
})

test("rejects oversized public bodies and validates proxied responses", async () => {
  const request = new Request("https://ami-care.nl/api/appointments", {
    method: "POST",
    headers: { "content-length": "20000" },
    body: "{}",
  })
  assert.equal(await readPublicAppointmentBody(request), null)
  assert.equal(parseAppointmentAvailabilityResponse({ timezone: "Europe/Amsterdam", from: "2026-09-07", to: "2026-09-07", slots: [] }).success, true)
  assert.equal(parseAppointmentAvailabilityResponse({ slots: "not-an-array" }).success, false)
  assert.equal(parseAppointmentBookingResponse({ ok: true, status: "confirmed", managementToken: "a".repeat(43) }).success, true)
  assert.equal(parseAppointmentBookingResponse({ ok: true, status: "cancelled" }).success, false)
})

test("fails closed when the public request body cannot be read", async () => {
  const request = {
    headers: new Headers({ "content-type": "application/json" }),
    text: async () => { throw new Error("body stream failed") },
  } as unknown as Request
  assert.equal(await readPublicAppointmentBody(request), null)
})
