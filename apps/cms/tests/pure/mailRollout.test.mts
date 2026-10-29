import { test } from 'node:test'
import assert from 'node:assert/strict'
import { requireMailDomainEnabled, mailOrderSponsored } from '../../src/lib/microsoftMailProvisioning/rollout.ts'
const env = { MICROSOFT_MAIL_ALLOWED_DOMAINS: 'customer.test', MICROSOFT_MAIL_SPONSORED_DOMAINS: 'customer.test' }
const tenant = { emailPaymentMethod: 'manual', platformPricing: { mode: 'exempt' as const, reason: 'Approved sponsorship' } }
test('rollout fails closed and isolates other customers', () => {
 assert.throws(() => requireMailDomainEnabled('customer.test', {}))
 assert.throws(() => requireMailDomainEnabled('other.test', env))
 assert.doesNotThrow(() => requireMailDomainEnabled('customer.test', env))
})
test('sponsorship requires explicit scope, manual billing and current exemption', () => {
 assert.equal(mailOrderSponsored(tenant, 'customer.test', env), true)
 assert.equal(mailOrderSponsored(tenant, 'other.test', env), false)
 assert.equal(mailOrderSponsored(tenant, 'customer.test', {}), false)
 assert.equal(mailOrderSponsored({ ...tenant, emailPaymentMethod: 'mollie' }, 'customer.test', env), false)
 assert.equal(mailOrderSponsored({ ...tenant, platformPricing: { mode: 'standard' } }, 'customer.test', env), false)
 assert.equal(mailOrderSponsored({ ...tenant, platformPricing: { ...tenant.platformPricing, expiresAt: '2020-01-01' } }, 'customer.test', env), false)
})
