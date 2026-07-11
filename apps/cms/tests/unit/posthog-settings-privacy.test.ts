import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { describe, expect, it } from "vitest"

const source = readFileSync(resolve(process.cwd(), "scripts/sync-posthog-project-settings.mjs"), "utf8")

describe("PostHog privacy settings sync", () => {
  it("pins the public analytics privacy baseline", () => {
    expect(source).toContain("const DEFAULT_EVENT_RETENTION_MONTHS = 13")
    expect(source).toContain("anonymize_ips: true")
    expect(source).toContain("autocapture_opt_out: true")
    expect(source).toContain("capture_console_log_opt_in: false")
    expect(source).toContain("session_recording_opt_in: false")
    expect(source).toContain("heatmaps_opt_in: false")
    expect(source).toContain("capture_dead_clicks: false")
    expect(source).toContain("events_retention_enforced: true")
  })

  it("supports an explicit bounded retention override", () => {
    expect(source).toContain("POSTHOG_EVENT_RETENTION_MONTHS")
    expect(source).toContain("retentionMonths < 1 || retentionMonths > 120")
  })

  it("provides a read-only production drift gate", () => {
    expect(source).toContain('arg === "--check"')
    expect(source).toContain("PostHog privacy drift:")
    expect(source).toContain("process.exit(1)")
  })
})
