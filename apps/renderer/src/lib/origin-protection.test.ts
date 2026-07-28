import assert from "node:assert/strict"
import { mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import test from "node:test"
import {
  publicHostFromProtectedRequest,
  RENDERER_ORIGIN_VERIFICATION_HEADER,
} from "./origin-protection"

const secret = "renderer-origin-test-secret-0000000001"
const production = {
  NODE_ENV: "production",
  SIAB_RENDERER_ORIGIN_SECRET: secret,
}

function request(headers: HeadersInit): Request {
  return new Request("http://renderer:4321/", { headers })
}

function protectedHeaders(host = "studio-example.be"): HeadersInit {
  return {
    host,
    "x-forwarded-host": host,
    "x-forwarded-proto": "https",
    [RENDERER_ORIGIN_VERIFICATION_HEADER]: secret,
  }
}

test("accepts a protected HTTPS request for any normalized public TLD", () => {
  assert.equal(publicHostFromProtectedRequest(request(protectedHeaders()), production), "studio-example.be")
  const withoutForwardedHost = protectedHeaders()
  delete (withoutForwardedHost as Record<string, string>)["x-forwarded-host"]
  assert.equal(publicHostFromProtectedRequest(request(withoutForwardedHost), production), "studio-example.be")
  assert.equal(
    publicHostFromProtectedRequest(request(protectedHeaders("voorbeeld.example.nl")), production),
    "voorbeeld.example.nl",
  )
})

test("fails closed for a missing or weak production origin secret", () => {
  assert.equal(publicHostFromProtectedRequest(request(protectedHeaders()), { NODE_ENV: "production" }), null)
  assert.equal(publicHostFromProtectedRequest(request(protectedHeaders()), {
    NODE_ENV: "production",
    SIAB_RENDERER_ORIGIN_SECRET: "too-short",
  }), null)
})

test("reads the production origin secret from a mounted secret file", () => {
  const directory = mkdtempSync(join(tmpdir(), "siab-renderer-secret-"))
  const secretFile = join(directory, "origin-secret")
  try {
    writeFileSync(secretFile, `${secret}\n`, { mode: 0o600 })
    assert.equal(publicHostFromProtectedRequest(request(protectedHeaders()), {
      NODE_ENV: "production",
      SIAB_RENDERER_ORIGIN_SECRET_FILE: secretFile,
    }), "studio-example.be")
  } finally {
    rmSync(directory, { recursive: true })
  }
})

test("rejects direct-origin, non-HTTPS, malformed, and cross-host requests", () => {
  const withoutSecret = protectedHeaders()
  delete (withoutSecret as Record<string, string>)[RENDERER_ORIGIN_VERIFICATION_HEADER]
  assert.equal(publicHostFromProtectedRequest(request(withoutSecret), production), null)
  assert.equal(publicHostFromProtectedRequest(request({
    ...protectedHeaders(),
    [RENDERER_ORIGIN_VERIFICATION_HEADER]: "guessed-origin-secret-000000000000000",
  }), production), null)
  assert.equal(publicHostFromProtectedRequest(request({
    ...protectedHeaders(),
    "x-forwarded-proto": "http",
  }), production), null)
  assert.equal(publicHostFromProtectedRequest(request({
    ...protectedHeaders(),
    "x-forwarded-host": "another.example.com",
  }), production), null)
  assert.equal(publicHostFromProtectedRequest(request(protectedHeaders("127.0.0.1")), production), null)
  assert.equal(publicHostFromProtectedRequest(request({
    ...protectedHeaders(),
    "x-forwarded-host": "studio-example.be, attacker.example",
  }), production), null)
})

test("keeps localhost development compatible when protection is not configured", () => {
  assert.equal(publicHostFromProtectedRequest(request({ host: "localhost:4321" }), {
    NODE_ENV: "development",
  }), "localhost")
})
