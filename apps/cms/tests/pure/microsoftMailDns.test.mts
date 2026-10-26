import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { planMicrosoftMailDns } from "../../src/lib/microsoftMailProvisioning/dns.ts"

describe("Microsoft mail DNS planner", () => {
  it("prepares verification and mail records while retaining the Cloudflare MX until cutover", () => {
    const plan = planMicrosoftMailDns({
      domain: "tap2case.nl",
      existing: [
        { id: "cf-mx-1", type: "MX", name: "tap2case.nl", content: "route1.mx.cloudflare.net", priority: 70, proxied: false },
        { id: "spf", type: "TXT", name: "tap2case.nl", content: "v=spf1 include:_spf.google.com ~all", proxied: false },
      ],
      verificationRecords: [{ recordType: "Txt", label: "@", text: "MS=ms123" }],
      serviceRecords: [
        { recordType: "Mx", label: "@", mailExchange: "tap2case-nl.mail.protection.outlook.com", preference: 0 },
        { recordType: "CName", label: "autodiscover", canonicalName: "autodiscover.outlook.com" },
      ],
      dkimRecords: [
        { selector: "selector1", target: "selector1-tap2case-nl._domainkey.tenant.onmicrosoft.com" },
        { selector: "selector2", target: "selector2-tap2case-nl._domainkey.tenant.onmicrosoft.com" },
      ],
    })

    assert.ok(plan.prepare.some((change) => change.action === "create" && change.record.type === "TXT" && change.record.content === "MS=ms123"))
    assert.ok(plan.prepare.some((change) => change.action === "update" && change.record.type === "TXT" && change.record.content.includes("include:_spf.google.com") && change.record.content.includes("include:spf.protection.outlook.com")))
    assert.ok(plan.prepare.some((change) => change.action === "create" && change.record.name === "autodiscover.tap2case.nl"))
    assert.ok(plan.prepare.some((change) => change.action === "create" && change.record.name === "selector1._domainkey.tap2case.nl"))
    assert.equal(plan.cutover[0]?.action, "create")
    assert.equal(plan.cutover[0]?.record?.type, "MX")
    assert.deepEqual(plan.cutover.slice(1).filter((change) => change.action === "delete").map((change) => change.id), ["cf-mx-1"])
  })

  it("refuses ambiguous SPF and unknown competing MX providers", () => {
    assert.throws(() => planMicrosoftMailDns({
      domain: "tap2case.nl",
      existing: [
        { id: "spf-1", type: "TXT", name: "tap2case.nl", content: "v=spf1 include:a.example ~all", proxied: false },
        { id: "spf-2", type: "TXT", name: "tap2case.nl", content: "v=spf1 include:b.example ~all", proxied: false },
      ],
      verificationRecords: [],
      serviceRecords: [{ recordType: "Mx", label: "@", mailExchange: "tenant.mail.protection.outlook.com", preference: 0 }],
      dkimRecords: [],
    }), /Multiple SPF/)

    assert.throws(() => planMicrosoftMailDns({
      domain: "tap2case.nl",
      existing: [{ id: "other-mx", type: "MX", name: "tap2case.nl", content: "mx.google.com", priority: 10, proxied: false }],
      verificationRecords: [],
      serviceRecords: [{ recordType: "Mx", label: "@", mailExchange: "tenant.mail.protection.outlook.com", preference: 0 }],
      dkimRecords: [],
    }), /other than Cloudflare Email Routing or Microsoft 365/)
  })
})
