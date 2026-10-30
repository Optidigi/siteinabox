import { afterAll, afterEach, beforeAll, expect, it, vi } from "vitest"
import type { Payload } from "payload"
import { getTestPayload } from "./_helpers"
import { register } from "@/instrumentation"

let payload: Payload
beforeAll(async () => { payload = await getTestPayload() })
afterAll(async () => { await payload?.destroy() })
afterEach(() => { vi.unstubAllEnvs() })

it("starts the configured Node scheduler once at boot and respects build, edge and disabled modes", async () => {
  expect(process.env.PAYLOAD_DISABLE_JOBS_AUTORUN).toBe("1")
  expect(payload.crons).toHaveLength(0)
  vi.stubEnv("NEXT_RUNTIME", "nodejs")
  await register()
  expect(payload.crons).toHaveLength(0)
  vi.stubEnv("PAYLOAD_DISABLE_JOBS_AUTORUN", "0")
  vi.stubEnv("NEXT_RUNTIME", "edge")
  await register()
  expect(payload.crons).toHaveLength(0)
  vi.stubEnv("NEXT_RUNTIME", "nodejs")
  vi.stubEnv("NEXT_PHASE", "phase-production-build")
  await register()
  expect(payload.crons).toHaveLength(0)
  vi.stubEnv("NEXT_PHASE", "")
  vi.stubEnv("npm_lifecycle_event", "build")
  await register()
  expect(payload.crons).toHaveLength(0)
  vi.stubEnv("npm_lifecycle_event", "")
  await register()
  expect(payload.crons).toHaveLength(1)
  await register()
  expect(payload.crons).toHaveLength(1)
  vi.stubEnv("PAYLOAD_DISABLE_JOBS_AUTORUN", "1")
})
