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
it("does not silently add an info alias when typing the first mailbox",()=>{
 const data=setup()()
 expect(data.get("infoAliasTarget")).toBe("")
})
it("submits a valid shared info request after entering a mailbox",()=>{
 const read=setup()
 fireEvent.click(screen.getByRole("button",{name:"addMailbox"}))
 fireEvent.change(screen.getAllByLabelText("mailboxName")[1]!,{target:{value:"aslan"}})
 fireEvent.change(screen.getAllByLabelText("displayName")[1]!,{target:{value:"Aslan"}})
 fireEvent.change(screen.getAllByLabelText("setupEmail")[1]!,{target:{value:"aslan.setup@example.test"}})
 fireEvent.click(screen.getByRole("checkbox",{name:/Shared info@customer.test/}))
 const data=read()
 const parsed=parseMicrosoftMailProvisioningRequest({tenantId:56,domain:"customer.test",customer,mailboxUsers:JSON.parse(String(data.get("mailboxUsers"))),infoSharedMailbox:data.get("infoSharedMailbox")==="on",retainInfoForward:false,infoAliasTarget:String(data.get("infoAliasTarget")??"")})
 expect(parsed, parsed.ok ? "" : parsed.issues.map(issue=>issue.message).join(" ")).toMatchObject({ok:true,value:{infoSharedMailbox:true,infoAliasTarget:null,quantity:2}})
})
it("keeps an explicitly selected alias following its mailbox and clears it when removed",()=>{
 const read=setup()
 fireEvent.click(screen.getByRole("button",{name:"addInfoAlias"}))
 expect(read().get("infoAliasTarget")).toBe("ardi@customer.test")
 fireEvent.change(screen.getByLabelText("mailboxName"),{target:{value:"aslan"}})
 expect(read().get("infoAliasTarget")).toBe("aslan@customer.test")
 fireEvent.click(screen.getByRole("button",{name:"removeAlias"}))
 expect(read().get("infoAliasTarget")).toBe("")
 fireEvent.click(screen.getByRole("checkbox",{name:/Shared info@customer.test/}))
 expect(read().get("infoAliasTarget")).toBe("")
})
