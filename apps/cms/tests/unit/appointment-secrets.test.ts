import { describe, expect, it } from "vitest"
import {
  APPOINTMENT_MANAGEMENT_KEY_ENV,
  openAppointmentSecret,
  sealAppointmentSecret,
} from "@/lib/appointments/secrets"

const env: NodeJS.ProcessEnv = {
  NODE_ENV: "test",
  APPOINTMENT_CALENDAR_ENCRYPTION_KEY: Buffer.alloc(32, 7).toString("base64"),
  [APPOINTMENT_MANAGEMENT_KEY_ENV]: Buffer.alloc(32, 9).toString("base64"),
}

describe("appointment secret storage", () => {
  it("round-trips calendar and management secrets with separate keys", () => {
    const calendarValue = sealAppointmentSecret("calendar-token", "calendar", env)
    const managementValue = sealAppointmentSecret("management-token", "management", env, APPOINTMENT_MANAGEMENT_KEY_ENV)

    expect(openAppointmentSecret(calendarValue, "calendar", env)).toBe("calendar-token")
    expect(openAppointmentSecret(managementValue, "management", env, APPOINTMENT_MANAGEMENT_KEY_ENV)).toBe("management-token")
    expect(() => openAppointmentSecret(calendarValue, "calendar", env, APPOINTMENT_MANAGEMENT_KEY_ENV)).toThrow()
    expect(() => openAppointmentSecret(managementValue, "management", env)).toThrow()
  })

  it("binds ciphertext to its purpose and requires an exact 32-byte key", () => {
    const sealed = sealAppointmentSecret("value", "one", env)
    expect(() => openAppointmentSecret(sealed, "two", env)).toThrow()
    expect(() => sealAppointmentSecret("value", "one", { NODE_ENV: "test" })).toThrow(/APPOINTMENT_CALENDAR_ENCRYPTION_KEY/)
    expect(() => sealAppointmentSecret("value", "one", { NODE_ENV: "test", APPOINTMENT_CALENDAR_ENCRYPTION_KEY: "too-short" })).toThrow(/32 bytes/)
  })
})
