import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { parseMicrosoftMailProvisioningRequest, parseStoredMicrosoftMailProvisioningRequest } from "../../src/lib/microsoftMailProvisioning/model.ts"

const customer = {
  companyName: "Tap2Case B.V.",
  website: "https://tap2case.nl",
  phone: "+31101234567",
  address: { street: "Teststraat 1", city: "Rotterdam", postalCode: "3011AA", country: "NL" },
  registrationNumber: "12345678",
  primaryContact: {
    firstName: "Ardi",
    lastName: "Example",
    email: "admin@tap2case-contact.example",
    phone: "+31101234567",
  },
}

describe("Microsoft mail provisioning request model", () => {
  it("derives each address from the selected domain without hardcoded users", () => {
    const result = parseMicrosoftMailProvisioningRequest({
      tenantId: 42,
      domain: " TAP2CASE.NL ",
      tenantPrefix: "tap2case",
      customer,
      mailboxUsers: [
        { localPart: " ardi ", displayName: "Ardi Example", setupEmail: "ardi.personal@example.net" },
        { localPart: "aslan", displayName: "Aslan Example", setupEmail: "aslan.personal@example.net" },
      ],
      infoForwardTo: "info@amapromotions.nl",
    })

    assert.deepEqual(result, {
      ok: true,
      value: {
        tenantId: 42,
        domain: "tap2case.nl",
        tenantPrefix: "tap2case",
        customer,
        product: "m365-business-basic-eea-no-teams",
        commitment: "annual",
        billing: "annual",
        mailboxUsers: [
          {
            localPart: "ardi",
            displayName: "Ardi Example",
            userPrincipalName: "ardi@tap2case.nl",
            setupEmail: "ardi.personal@example.net",
          },
          {
            localPart: "aslan",
            displayName: "Aslan Example",
            userPrincipalName: "aslan@tap2case.nl",
            setupEmail: "aslan.personal@example.net",
          },
        ],
        quantity: 2,
        retainInfoForward: true,
        infoAliasTarget: null,
        infoForwardTo: "info@amapromotions.nl",
      },
    })
  })

  it("rejects duplicate addresses and invalid setup delivery addresses", () => {
    const result = parseMicrosoftMailProvisioningRequest({
      tenantId: 42,
      domain: "tap2case.nl",
      customer,
      mailboxUsers: [
        { localPart: "ardi", displayName: "Ardi", setupEmail: "ardi.personal@example.net" },
        { localPart: "ARDI", displayName: "Duplicate Ardi", setupEmail: "not-an-email" },
      ],
      infoForwardTo: "info@amapromotions.nl",
    })

    assert.equal(result.ok, false)
    if (result.ok) throw new Error("Expected invalid request")
    assert.ok(result.issues.some((issue) => issue.code === "duplicate_mailbox"))
    assert.ok(result.issues.some((issue) => issue.code === "invalid_mailbox_user"))
  })

  it("rejects a mailbox batch without a site tenant, valid domain, or mailbox user", () => {
    const result = parseMicrosoftMailProvisioningRequest({
      tenantId: 0,
      domain: "not a domain",
      tenantPrefix: "tap2case",
      customer,
      mailboxUsers: [],
      infoForwardTo: "info@amapromotions.nl",
    })

    assert.equal(result.ok, false)
    if (result.ok) throw new Error("Expected invalid request")
    assert.deepEqual(new Set(result.issues.map((issue) => issue.code)), new Set([
      "invalid_tenant",
      "invalid_domain",
      "empty_mailbox_list",
    ]))
  })
})

it("keeps shared info separate from paid seats and rejects mixed info modes", () => {
 const input = { tenantId: 42, domain: 'tap2case.nl', customer, retainInfoForward: false, infoSharedMailbox: true,
   mailboxUsers: [{ localPart: 'ardi', displayName: 'Ardi', setupEmail: 'setup@example.net' }, { localPart: 'aslan', displayName: 'Aslan', setupEmail: 'setup@example.net' }] }
 const parsed = parseMicrosoftMailProvisioningRequest(input)
 assert.equal(parsed.ok, true)
 if (!parsed.ok) return
 assert.equal(parsed.value.infoSharedMailbox, true)
 assert.equal(parsed.value.quantity, 2)
 assert.equal(parseMicrosoftMailProvisioningRequest({ ...input, mailboxUsers: [{ localPart: ' INFO ', displayName: 'Info', setupEmail: 'setup@example.net' }] }).ok, false)
 assert.equal(parsed.value.infoForwardTo, null)
 assert.equal(parseMicrosoftMailProvisioningRequest({ ...input, infoAliasTarget: 'ardi@tap2case.nl' }).ok, false)
 assert.equal(parseMicrosoftMailProvisioningRequest({ ...input, retainInfoForward: true, infoForwardTo: 'old@example.net' }).ok, false)
})


it("round-trips persisted requests while keeping raw form input strict", () => {
  const raw = { tenantId: 56, domain: "tap2case.nl", tenantPrefix: "tap2case", customer, mailboxUsers: [{ localPart: "ardi", displayName: "Ardi", setupEmail: "setup@example.test" }], retainInfoForward: false, infoSharedMailbox: true }
  const normalized = parseMicrosoftMailProvisioningRequest(raw)
  assert.equal(normalized.ok, true)
  if (!normalized.ok) throw Error("Invalid fixture")
  assert.equal(parseMicrosoftMailProvisioningRequest(normalized.value).ok, false)
  assert.deepEqual(parseStoredMicrosoftMailProvisioningRequest(normalized.value), normalized)
  for (const altered of [
    { ...normalized.value, product: "another-product" },
    { ...normalized.value, quantity: 2 },
    { ...normalized.value, mailboxUsers: [{ ...normalized.value.mailboxUsers[0], userPrincipalName: "ardi@other.test" }] },
    { ...normalized.value, unexpected: true },
    { ...normalized.value, infoSharedMailbox: "true" },
    { ...normalized.value, retainInfoForward: "false" },
  ]) assert.equal(parseStoredMicrosoftMailProvisioningRequest(altered).ok, false)
})
