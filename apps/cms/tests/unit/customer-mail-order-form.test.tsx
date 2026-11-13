// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, expect, it, vi } from "vitest"
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: vi.fn() }) }))
vi.mock("next-intl", () => ({ useTranslations: () => (key: string) => key }))
vi.mock("@/app/(frontend)/(admin)/email/actions", () => ({ submitCustomerMicrosoftMailRequest: vi.fn() }))
import { CustomerMailOrderForm } from "@/app/(frontend)/(admin)/email/CustomerMailOrderForm"
import { parseMicrosoftMailProvisioningRequest } from "@/lib/microsoftMailProvisioning/model"
beforeEach(() => vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} }))
afterEach(() => { cleanup(); vi.unstubAllGlobals() })
const customer = { companyName: "Fixture company", website: "https://customer.test", phone: "+31201234567", address: { street: "Fixture 1", city: "Amsterdam", postalCode: "1000AA", country: "NL" }, primaryContact: { firstName: "Operations", lastName: "Fixture", email: "operator@example.test", phone: "+31201234567" } }
function setup() {
 const view=render(<CustomerMailOrderForm tenantId={56} tenantName="Fixture company" tenantDomain="customer.test" userName="Fixture Owner" userEmail="operator@example.test" />)
 fireEvent.change(screen.getByLabelText("mailboxName"),{target:{value:"ardi"}})
 fireEvent.change(screen.getByLabelText("displayName"),{target:{value:"Ardi"}})
 fireEvent.change(screen.getByLabelText("setupEmail"),{target:{value:"setup@example.test"}})
 const form=view.container.querySelector("form");if(!form)throw Error("Mail form missing")
 return ()=>new window.FormData(form)
}
it("offers no alias or shared inbox options",()=>{
 const data=setup()()
 expect(data.get("infoAliasTarget")).toBeNull()
 expect(screen.queryByRole("button",{name:"addInfoAlias"})).toBeNull()
})
it("offers info@ and admin@ as paid-account name suggestions and never a shared inbox",()=>{
 const read=setup()
 expect(screen.queryByRole("checkbox",{name:/Shared info@/})).toBeNull()
 fireEvent.click(screen.getByRole("button",{name:"addMailbox"}))
 fireEvent.click(screen.getByRole("button",{name:"info@"}))
 fireEvent.change(screen.getAllByLabelText("displayName")[1]!,{target:{value:"Info"}})
 fireEvent.change(screen.getAllByLabelText("setupEmail")[1]!,{target:{value:"info.setup@example.test"}})
 const data=read()
 expect(data.get("infoSharedMailbox")).toBeNull()
 const parsed=parseMicrosoftMailProvisioningRequest({tenantId:56,domain:"customer.test",customer,mailboxUsers:JSON.parse(String(data.get("mailboxUsers"))),retainInfoForward:false,infoAliasTarget:String(data.get("infoAliasTarget")??"")})
 expect(parsed, parsed.ok ? "" : parsed.issues.map(issue=>issue.message).join(" ")).toMatchObject({ok:true,value:{quantity:2,infoAliasTarget:null}})
 expect(parsed.ok && parsed.value.mailboxUsers.map(user=>user.userPrincipalName)).toEqual(["ardi@customer.test","info@customer.test"])
 expect(parsed.ok && "infoSharedMailbox" in parsed.value).toBe(false)
})
it("keeps an initial manager-approved mailbox count bounded",()=>{
 render(<CustomerMailOrderForm tenantId={56} tenantName="Fixture" tenantDomain="customer.test" userName="Owner" userEmail="operator@example.test" approvedMailboxCount={2} />)
 expect(screen.getAllByLabelText("mailboxName")).toHaveLength(2)
 expect(screen.getByRole("button",{name:"addMailbox"}).hasAttribute("disabled")).toBe(true)
 expect(screen.getAllByRole("button",{name:"removeMailbox"}).every(button=>button.hasAttribute("disabled"))).toBe(true)
})


it("keeps legal acceptance and the final price together in the original form",()=>{
 const view=render(<CustomerMailOrderForm tenantId={56} tenantName="Fixture" tenantDomain="customer.test" userName="Owner" userEmail="operator@example.test" approvedMailboxCount={2}
  orderPricing={{unitNetMinor:5604,platformNetMinor:0,prepaidMaxGrossMinor:13562}}
  legalDocuments={[{locale:"nl",version:"registered-terms-and-privacy",termsHref:"/legal/terms?locale=nl",privacyHref:"/legal/privacy?locale=nl",statement:"Ik ga akkoord met de voorwaarden."}]} />)
 const form=view.container.querySelector("form");if(!form)throw new Error("Mail form missing")
 expect(form.querySelector('[name="acceptOrderTerms"]')).not.toBeNull()
 expect(form.querySelector('[name="expectedGrossMinor"]')?.getAttribute("value")).toBe("13562")
 expect(form.textContent).toContain("€0.00")
 expect(view.container.querySelectorAll("form")).toHaveLength(1)
 expect(form.querySelector('[name="legalLocale"]')?.getAttribute("value")).toBe("")
})


it("requires renewed acceptance when the selected legal document identity changes",()=>{
 const props={tenantId:56,tenantName:"Fixture",tenantDomain:"customer.test",userName:"Owner",userEmail:"owner@example.test",userLocale:"nl" as const,orderPricing:{unitNetMinor:5604,platformNetMinor:0}}
 const document={locale:"nl" as const,version:"version-one",termsHref:"/terms",privacyHref:"/privacy",statement:"Fixture legal statement"}
 const view=render(<CustomerMailOrderForm {...props} legalDocuments={[document]} />)
 const label=[...view.container.querySelectorAll("label")].find(element=>element.textContent?.includes(document.statement))
 const checkbox=label?.querySelector('[role="checkbox"]');if(!checkbox)throw new Error("Legal checkbox missing")
 fireEvent.click(checkbox)
 expect(checkbox.getAttribute("aria-checked")).toBe("true")
 view.rerender(<CustomerMailOrderForm {...props} legalDocuments={[{...document,version:"version-two",statement:"Changed legal statement"}]} />)
 const changed=[...view.container.querySelectorAll("label")].find(element=>element.textContent?.includes("Changed legal statement"))?.querySelector('[role="checkbox"]')
 expect(changed?.getAttribute("aria-checked")).toBe("false")
})
it("shows a prorated addition's actual commitment end before acceptance",()=>{
 const view=render(<CustomerMailOrderForm tenantId={56} tenantName="Fixture" tenantDomain="customer.test" userName="Owner" userEmail="owner@example.test" orderPricing={{unitNetMinor:1000,platformNetMinor:0,operation:"seats",periodEndsAt:"2027-03-10T00:00:00.000Z"}} />)
 expect(view.container.textContent).toContain("Until 10 Mar 2027")
 expect(view.container.textContent).toContain("Remaining commitment excluding VAT")
 expect(view.container.textContent).not.toContain("Annual total excluding VAT")
})
