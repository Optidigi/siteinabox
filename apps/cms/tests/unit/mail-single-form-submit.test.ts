import { beforeEach, expect, it, vi } from "vitest"
const mocks=vi.hoisted(()=>({workspace:vi.fn(),quote:vi.fn(),accept:vi.fn(),fund:vi.fn(),payment:vi.fn(),findRun:vi.fn(),createRun:vi.fn(),updateRun:vi.fn(),getRun:vi.fn(),findOrder:vi.fn(),service:vi.fn(),claim:vi.fn(),log:vi.fn(),lockDepth:0}))
vi.mock("payload",()=>({getPayload:async()=>({findByID:mocks.findOrder,logger:{info:mocks.log}})}))
vi.mock("@/payload.config",()=>({default:{}}))
vi.mock("next/cache",()=>({revalidatePath:vi.fn()}))
vi.mock("next/navigation",()=>({redirect:(url:string)=>{throw new Error(`TEST_REDIRECT:${url}`)}}))
vi.mock("@/app/(frontend)/(admin)/email/workspaceAccess",()=>({requireMailWorkspace:mocks.workspace}))
vi.mock("@/lib/microsoftMailProvisioning/commerce",()=>({prepareMailQuote:mocks.quote,acceptMailOrder:mocks.accept,fundPrepaidMailOrder:mocks.fund,createMailPayment:mocks.payment,loadMailService:mocks.service}))
vi.mock("@/lib/microsoftMailProvisioning/payloadStore",()=>({PayloadMicrosoftMailProvisioningStore:class {
 findByIdempotencyKey=mocks.findRun
 create=mocks.createRun
 get=mocks.getRun
 update=mocks.updateRun
}}))
vi.mock("@/lib/commerce/orderLock",()=>({withCommerceOrderLock:async(_payload:unknown,_key:unknown,operation:()=>Promise<unknown>)=>{
 mocks.lockDepth++;try{return await operation()}finally{mocks.lockDepth--}
}}))
vi.mock("@/lib/microsoftMailProvisioning/setupTokenStore",()=>({consumeMicrosoftMailSetupCredential:mocks.claim}))
import { encryptMicrosoftMailSetupCredential } from "@/lib/microsoftMailProvisioning/setupCredentialCrypto"
import { submitCustomerMicrosoftMailRequest, revealCustomerMailboxCredential } from "@/app/(frontend)/(admin)/email/actions"

function form(){
 const data=new FormData()
 const values={tenantId:"56",domain:"customer.test",tenantPrefix:"customer",companyName:"Fixture",website:"https://customer.test",companyPhone:"+31201234567",street:"Fixture 1",city:"Amsterdam",postalCode:"1000AA",country:"NL",signatoryFirstName:"Fixture",signatoryLastName:"Owner",signatoryEmail:"owner@example.test",acceptMca:"on",authorizeService:"on",acceptOrderTerms:"on",legalLocale:"nl",legalVersion:"4:terms:5:privacy",expectedGrossMinor:"6781",expectedAmountDueMinor:"0",mailboxUsers:JSON.stringify([{localPart:"ardi",displayName:"Ardi",setupEmail:"setup@example.test"}])}
 for(const [key,value]of Object.entries(values))data.set(key,value)
 return data
}
beforeEach(()=>{
 vi.clearAllMocks();mocks.lockDepth=0
 vi.stubEnv("PAX8_ORDER_EMAIL","operations@example.test")
 mocks.workspace.mockResolvedValue({user:{id:10,role:"owner",email:"owner@example.test",language:"nl",name:"Fixture Owner"},ctx:{mode:"tenant",tenant:{id:56,status:"active"}},basePath:"/accounts/56/email"})
 mocks.quote.mockResolvedValue({serviceId:1,totalGrossMinor:6781,prepaidAuthorizationId:"prepaid"})
 mocks.findRun.mockResolvedValue(null)
 mocks.createRun.mockImplementation(async(value:Record<string,unknown>)=>({...value,id:99}))
 mocks.accept.mockImplementation(async()=>{expect(mocks.lockDepth).toBe(0);return {id:111,state:"accepted",paymentProvider:"manual"}})
 mocks.fund.mockResolvedValue(111)
 mocks.payment.mockResolvedValue("https://checkout.example.test/payment")
 mocks.getRun.mockResolvedValue({id:99,mode:"live",tenantId:56,state:"ready",data:{commerceOrderId:111},request:{mailboxUsers:[{userPrincipalName:"ardi@customer.test"}]}})
 mocks.findOrder.mockResolvedValue({id:111,tenant:56,paymentStatus:"paid",state:"fulfilled"})
 mocks.service.mockResolvedValue({status:"active"})
 vi.stubEnv("MICROSOFT_MAIL_SETUP_ENCRYPTION_KEY",Buffer.alloc(32,27).toString("base64"))
})
it("accepts all agreements in the original submission and queues prepaid fulfillment without another screen",async()=>{
 await expect(submitCustomerMicrosoftMailRequest(null,form())).rejects.toThrow("TEST_REDIRECT:/accounts/56/email?request=99")
 expect(mocks.accept).toHaveBeenCalledExactlyOnceWith(expect.anything(),expect.objectContaining({runId:99,tenantId:56,legalAccepted:true,legalLocale:"nl",legalVersion:"4:terms:5:privacy"}))
 expect(mocks.fund).toHaveBeenCalledOnce()
 expect(mocks.payment).not.toHaveBeenCalled()
})
it("redirects a normally paid order to checkout from that same submission",async()=>{
 mocks.quote.mockResolvedValue({serviceId:1,totalGrossMinor:6781,prepaidAuthorizationId:null})
 mocks.accept.mockResolvedValue({id:111,state:"accepted",paymentProvider:"mollie"})
 const data=form();data.set("expectedAmountDueMinor","6781")
 await expect(submitCustomerMicrosoftMailRequest(null,data)).rejects.toThrow("TEST_REDIRECT:https://checkout.example.test/payment")
 expect(mocks.payment).toHaveBeenCalledExactlyOnceWith(expect.anything(),111)
})
it("rejects missing legal acceptance and changed displayed amounts before order acceptance",async()=>{
 const missing=form();missing.delete("acceptOrderTerms")
 expect(await submitCustomerMicrosoftMailRequest(null,missing)).toMatchObject({ok:false})
 expect(mocks.quote).not.toHaveBeenCalled()
 const changed=form();changed.set("expectedGrossMinor","1")
 expect(await submitCustomerMicrosoftMailRequest(null,changed)).toMatchObject({ok:false,message:expect.stringMatching(/price or prepaid coverage changed/)})
 expect(mocks.createRun).not.toHaveBeenCalled()
 expect(mocks.accept).not.toHaveBeenCalled()
 expect(mocks.payment).not.toHaveBeenCalled()
})


it("reveals a paid ready mailbox only inside its authenticated workspace, without logging secrets",async()=>{
 const password="Synthetic-Initial-Password-42!"
 const encryptedPassword=encryptMicrosoftMailSetupCredential(password,process.env.MICROSOFT_MAIL_SETUP_ENCRYPTION_KEY!)
 mocks.claim.mockResolvedValue({userPrincipalName:"ardi@customer.test",encryptedPassword})
 expect(await revealCustomerMailboxCredential({tenantId:56,runId:99,userPrincipalName:"ardi@customer.test"})).toMatchObject({ok:true,password})
 expect(mocks.workspace).toHaveBeenCalledWith("56")
 expect(mocks.claim).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({runId:99,userPrincipalName:"ardi@customer.test"}))
 expect(mocks.log).toHaveBeenCalledWith(expect.objectContaining({actorId:10,tenantId:56,runId:99}))
 expect(JSON.stringify(mocks.log.mock.calls)).not.toContain(password)
 expect(JSON.stringify(mocks.log.mock.calls)).not.toContain(encryptedPassword)
})
it("denies another workspace, another mailbox, or unpaid provisioning before claiming credentials",async()=>{
 const input={tenantId:56,runId:99,userPrincipalName:"ardi@customer.test"}
 mocks.getRun.mockResolvedValueOnce({mode:"live",tenantId:57,state:"ready",data:{commerceOrderId:111},request:{mailboxUsers:[{userPrincipalName:input.userPrincipalName}]}})
 expect(await revealCustomerMailboxCredential(input)).toMatchObject({ok:false})
 expect(await revealCustomerMailboxCredential({...input,userPrincipalName:"other@customer.test"})).toMatchObject({ok:false})
 mocks.findOrder.mockResolvedValueOnce({tenant:56,paymentStatus:"pending",state:"accepted"})
 expect(await revealCustomerMailboxCredential(input)).toMatchObject({ok:false})
 expect(mocks.claim).not.toHaveBeenCalled()
})


it("resumes an already accepted prepaid order after funding failure without repricing its consumed approval",async()=>{
 mocks.fund.mockRejectedValueOnce(new Error("Synthetic queue failure"))
 expect(await submitCustomerMicrosoftMailRequest(null,form())).toMatchObject({ok:false})
 const created=await mocks.createRun.mock.results[0]?.value
 mocks.findRun.mockResolvedValue({...created,data:{...created.data,commerceOrderId:111}})
 mocks.quote.mockClear()
 mocks.quote.mockResolvedValue({serviceId:1,totalGrossMinor:6781,prepaidAuthorizationId:null})
 await expect(submitCustomerMicrosoftMailRequest(null,form())).rejects.toThrow("TEST_REDIRECT:/accounts/56/email?request=99")
 expect(mocks.quote).not.toHaveBeenCalled()
 expect(mocks.fund).toHaveBeenCalledTimes(2)
 expect(mocks.createRun).toHaveBeenCalledOnce()
})
