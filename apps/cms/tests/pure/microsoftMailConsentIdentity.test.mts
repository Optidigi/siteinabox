import assert from "node:assert/strict"
import { it } from "node:test"
import { microsoftMailProviderConsent, validMicrosoftMailSignatoryName } from "../../src/lib/microsoftMailProvisioning/consentIdentity.ts"

it("preserves original acceptance while applying an audited legal-name correction for the same order and actor", () => {
 const acceptedAt="2026-10-29T12:00:00.000Z"
 const consent={actorUserId:"1",actorEmail:"operator@example.test",acceptedAt,signatoryFirstName:"admin",signatoryLastName:"fixture",mcaAccepted:true,serviceAuthorized:true,confirmSignatoryAuthority:true}
 const correction={id:"12345678-1234-4234-8234-123456789abc",source:"operator-confirmed",orderId:2,actorUserId:"1",actorEmail:"operator@example.test",originalAcceptedAt:acceptedAt,previousFirstName:"admin",previousLastName:"fixture",firstName:"Avery",lastName:"Example",recordedAt:"2026-10-29T13:00:00.000Z",reason:"Authorized actor confirmed their full legal name."}
 const data={commerceOrderId:2,customerConsent:consent,mcaSignatoryCorrection:correction}
 assert.equal(microsoftMailProviderConsent(data).signatoryFirstName,"Avery")
 assert.equal(microsoftMailProviderConsent(data).acceptedAt,acceptedAt)
 assert.equal(consent.signatoryFirstName,"admin")
 assert.equal(microsoftMailProviderConsent({customerConsent:consent}),consent)
 for(const change of [{orderId:3},{actorUserId:"9"},{actorEmail:"other@example.test"},{previousFirstName:"different"},{originalAcceptedAt:"2026-10-29T11:00:00.000Z"},{firstName:"admin"},{recordedAt:"2026-10-28T13:00:00.000Z"},{unexpected:true}])assert.throws(()=>microsoftMailProviderConsent({...data,mcaSignatoryCorrection:{...correction,...change}}))
 assert.equal(validMicrosoftMailSignatoryName("ADMIN"),false)
 assert.equal(validMicrosoftMailSignatoryName("Avery"),true)
})
