import { beforeEach, expect, it, vi } from "vitest"
import { renderToStaticMarkup } from "react-dom/server"
import type { User } from "@/payload-types"
import { asTenant, cast } from "../_helpers/cast"
const mocks=vi.hoisted(()=>({find:vi.fn(),legal:vi.fn(),confirmation:vi.fn(()=>null)}))
vi.mock("payload",()=>({getPayload:async()=>({find:mocks.find})}))
vi.mock("@/payload.config",()=>({default:{}}))
vi.mock("next-intl/server",()=>({getTranslations:async()=>((key:string)=>key)}))
vi.mock("next/navigation",()=>({notFound:()=>{throw Error("not found")},useRouter:()=>({replace:vi.fn()})}))
vi.mock("@/components/page-header",()=>({PageHeader:()=>null}))
vi.mock("@/lib/legal/checkoutLegal",()=>({checkoutLegalDocuments:mocks.legal}))
vi.mock("@/app/(frontend)/(admin)/email/actions",()=>({refreshCustomerMailQuote:vi.fn(),submitCustomerMicrosoftMailRequest:vi.fn()}))
vi.mock("@/app/(frontend)/(admin)/email/MailProgressRefresh",()=>({MailProgressRefresh:()=>null}))
vi.mock("@/app/(frontend)/(admin)/email/MailOrderConfirmation",()=>({MailOrderConfirmation:mocks.confirmation}))
import { CustomerEmailWorkspace } from "@/app/(frontend)/(admin)/email/CustomerEmailWorkspace"
const workspace={user:cast<User>({id:1,email:"operator@example.test",name:"Operator",role:"super-admin",language:"en",tenants:[]}),ctx:{mode:"tenant" as const,tenant:asTenant({id:56,name:"Fixture",status:"active",enabledServices:["email"]})},basePath:"/accounts/56/email"}
const legal={locale:"nl",terms:{id:4,contentHash:"terms-hash"},privacy:{id:5,contentHash:"privacy-hash"},termsHref:"/terms-nl",privacyHref:"/privacy-nl",statement:{version:"fixture",text:"Ik ga akkoord met de algemene voorwaarden."}}
beforeEach(()=>{
 vi.clearAllMocks()
 const now=new Date().toISOString()
 const quote={version:2,serviceId:1,productId:"1bdd7ebb-f994-421f-ae98-b6a57bd9f947",operation:"initial",baseQuantity:0,targetQuantity:2,annualUnitNetMinor:5604,providerAnnualUnitCostMinor:4932,servicePeriodStartsAt:null,servicePeriodEndsAt:null,providerCommitmentStartsAt:null,providerCommitmentEndsAt:null,commitmentTermId:"annual",quantity:2,currency:"EUR",unitNetMinor:5604,providerUnitCostMinor:4932,platformNetMinor:0,platformDiscountNetMinor:0,subtotalNetMinor:11208,vatAmountMinor:2354,totalGrossMinor:13562,issuedAt:now,expiresAt:new Date(Date.now()+900000).toISOString(),pricingHash:"fixture",paymentProvider:"manual",sponsored:true,legacyInfoForwardTo:null,routingHash:"0".repeat(64)}
 mocks.find.mockImplementation(async({collection}:{collection:string})=>({docs:collection==="microsoft-mail-services"?[{id:1,domain:"customer.test",status:"draft"}]:collection==="microsoft-mail-provisioning-runs"?[{id:11,tenantId:56,state:"prepared",domain:"customer.test",createdAt:now,request:{mailboxUsers:[]},data:{customerConsent:{},quote}}]:[]}))
 mocks.legal.mockImplementation(async(_payload:unknown,locale:string)=>locale==="nl"?legal:null)
})
it("explains missing English legal records and offers an explicit Dutch choice for the saved request",async()=>{
 const html=renderToStaticMarkup(await CustomerEmailWorkspace({workspace,searchParams:Promise.resolve({request:"11"})}))
 expect(html).toContain("English legal documents are not available")
 expect(html).toContain('/accounts/56/email?request=11&amp;legalLocale=nl')
 expect(mocks.legal).toHaveBeenCalledTimes(1)
 expect(mocks.legal.mock.calls[0]?.[1]).toBe("en")
 expect(mocks.confirmation).not.toHaveBeenCalled()
})
it("shows Dutch confirmation only after explicitly selecting it without changing the actor language",async()=>{
 renderToStaticMarkup(await CustomerEmailWorkspace({workspace,searchParams:Promise.resolve({request:"11",legalLocale:"nl"})}))
 expect(mocks.legal.mock.calls[0]?.[1]).toBe("nl")
 expect(mocks.confirmation).toHaveBeenCalledWith(expect.objectContaining({legalLocale:"nl",acceptanceStatement:legal.statement.text}),undefined)
 expect(workspace.user.language).toBe("en")
})
it("rejects unsupported legal languages instead of silently switching documents",async()=>{
 await expect(CustomerEmailWorkspace({workspace,searchParams:Promise.resolve({request:"11",legalLocale:"fr"})})).rejects.toThrow("not found")
})
