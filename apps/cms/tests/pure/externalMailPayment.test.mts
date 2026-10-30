import assert from 'node:assert/strict'
import {test} from 'node:test'
import {externalMailPaymentSchema,externalMailPaymentForQuote} from '../../src/lib/microsoftMailProvisioning/externalPayment.ts'
const approval={id:'00000000-0000-4000-8000-000000000001',domain:'customer.test',productId:'1bdd7ebb-f994-421f-ae98-b6a57bd9f947',quantity:2,term:'annual',maxGrossMinor:13562,reference:'Manager confirmed external payment',approvedBy:1,approvedByEmail:'manager@example.test',approvedAt:'2026-10-29T00:00:00.000Z',consumedOrderId:null}
const quote={domain:'customer.test',operation:'initial',quantity:2,totalGrossMinor:13562,productId:approval.productId}
test('external payment covers exactly one approved initial product/domain/seat count',()=>{
 assert.equal(externalMailPaymentForQuote(approval,quote)?.id,approval.id)
 assert.equal(externalMailPaymentForQuote(approval,{...quote,operation:'seats'}),null)
 assert.equal(externalMailPaymentForQuote(approval,{...quote,operation:'renewal'}),null)
 assert.equal(externalMailPaymentForQuote({...approval,consumedOrderId:7},quote),null)
 assert.throws(()=>externalMailPaymentForQuote(approval,{...quote,quantity:3}),/approved prepaid mailbox count/)
 assert.throws(()=>externalMailPaymentForQuote(approval,{...quote,domain:'other.test'}),/domain or product/)
 assert.throws(()=>externalMailPaymentForQuote(approval,{...quote,productId:'other'}),/domain or product/)
 assert.throws(()=>externalMailPaymentForQuote(approval,{...quote,totalGrossMinor:13563}),/covered amount/)
 assert.equal(externalMailPaymentForQuote(null,quote),null)
})
test('external payment authority requires manager identity, reference and real approval date',()=>{
 assert.equal(externalMailPaymentSchema.safeParse({...approval,reference:''}).success,false)
 assert.equal(externalMailPaymentSchema.safeParse({...approval,approvedBy:0}).success,false)
 assert.equal(externalMailPaymentSchema.safeParse({...approval,quantity:0}).success,false)
})
