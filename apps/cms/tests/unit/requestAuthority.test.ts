import { describe, expect, it } from "vitest"

import {
  browserOriginMatchesAuthority,
  canonicalRequestAuthority,
  isPreviewRequestAuthority,
} from "@/lib/requestAuthority"

describe("canonical request authority", () => {
  it("requires Host and forwarded Host to agree exactly", () => {
    expect(canonicalRequestAuthority(new Headers({
      host: "preview.siteinabox.nl",
      "x-forwarded-host": "attacker.example",
    }))).toBeNull()
    expect(canonicalRequestAuthority(new Headers({
      host: "preview.siteinabox.nl",
      "x-forwarded-host": "preview.siteinabox.nl, attacker.example",
    }))).toBeNull()
  })

  it("forces HTTPS in production despite a spoofed forwarded protocol", () => {
    const headers = new Headers({
      host: "preview.siteinabox.nl",
      "x-forwarded-host": "preview.siteinabox.nl",
      "x-forwarded-proto": "http",
      origin: "http://preview.siteinabox.nl",
    })
    expect(canonicalRequestAuthority(headers, {
      NODE_ENV: "production",
    })).toMatchObject({
      origin: "https://preview.siteinabox.nl",
    })
    expect(browserOriginMatchesAuthority(headers, {
      env: { NODE_ENV: "production" },
      originRequired: true,
    })).toBe(false)
  })

  it("allows only an exact loopback HTTP origin during development", () => {
    const accepted = new Headers({
      host: "localhost:3000",
      "x-forwarded-host": "localhost:3000",
      origin: "http://localhost:3000",
    })
    expect(isPreviewRequestAuthority(accepted, {
      NODE_ENV: "development",
    })).toBe(true)
    expect(browserOriginMatchesAuthority(accepted, {
      env: { NODE_ENV: "development" },
      originRequired: true,
    })).toBe(true)
    expect(browserOriginMatchesAuthority(new Headers({
      host: "localhost:3000",
      "x-forwarded-host": "localhost:3000",
      origin: "https://localhost:3000",
    }), {
      env: { NODE_ENV: "development" },
      originRequired: true,
    })).toBe(false)
    expect(isPreviewRequestAuthority(new Headers({
      host: "dev.example.test",
      "x-forwarded-host": "dev.example.test",
    }), {
      NODE_ENV: "development",
    })).toBe(false)
  })
})
