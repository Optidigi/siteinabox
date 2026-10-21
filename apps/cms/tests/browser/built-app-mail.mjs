import assert from "node:assert/strict"

// Only messages belonging to the fixed synthetic browser fixture are eligible.
// This recognizes payloads; the caller never forwards them to a provider.
export function builtAppMailVerification(body) {
  const recipients = Array.isArray(body.to) ? body.to : [body.to]
  assert.equal(recipients.length, 1, "E_TEST_MAIL_DOUBLE_RECIPIENT")
  if (recipients[0] === "admin@siteinabox.nl" &&
      body.subject === "Nieuwe intake opgeslagen: M14 Schilders Breda" &&
      String(body.text ?? "").includes("E-mail: m14-free@test.invalid")) return null
  assert.equal(recipients[0], "m14-free@test.invalid", "E_TEST_MAIL_DOUBLE_RECIPIENT")
  const candidates = String(body.text ?? "").match(/https:\/\/[^\s<>"']+/g) ?? []
  const verification = candidates.map(value => new URL(value)).find(url => url.protocol === "https:" &&
    url.hostname === "admin.siteinabox.nl" && url.pathname === "/api/preview-auth/magic-link/verify" && url.searchParams.has("token"))
  assert(verification, "E_TEST_MAIL_DOUBLE_VERIFICATION_LINK")
  return verification.href
}
