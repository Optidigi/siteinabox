import assert from "node:assert/strict"
import test from "node:test"
import { base32, code, parseEnrollment } from "../src/totp.mjs"
test("RFC6238 SHA1 truncation includes leading zeroes and large timestamps", () => {
  const seed = Buffer.from("12345678901234567890")
  for (const [time, expected] of [
    [59, "287082"],
    [1111111109, "081804"],
    [1111111111, "050471"],
    [1234567890, "005924"],
    [2000000000, "279037"],
    [20000000000, "353130"],
  ])
    assert.equal(code(seed, time * 1000), expected)
  assert.equal(base32("GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ").equals(seed), true)
})
test("enrollment is account/issuer bound and cannot weaken the factor algorithm", () => {
  const uri =
    "otpauth://totp/Microsoft:admin%40fixture.onmicrosoft.com?secret=GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ&issuer=Microsoft"
  assert.ok(parseEnrollment(uri, "admin@fixture.onmicrosoft.com"))
  for (const bad of [
    uri + "&secret=OTHER",
    uri + "&period=60",
    uri.replace("totp", "hotp"),
  ])
    assert.throws(() => parseEnrollment(bad, "admin@fixture.onmicrosoft.com"))
  assert.throws(() => parseEnrollment(uri, "other@fixture.onmicrosoft.com"))
})
