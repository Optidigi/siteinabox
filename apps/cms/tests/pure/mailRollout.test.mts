import { test } from 'node:test'
import assert from 'node:assert/strict'
import { requireMailDomainEnabled } from '../../src/lib/microsoftMailProvisioning/rollout.ts'
const env = { MICROSOFT_MAIL_ALLOWED_DOMAINS: 'customer.test' }
test('rollout fails closed and isolates other customers', () => {
 assert.throws(() => requireMailDomainEnabled('customer.test', {}))
 assert.throws(() => requireMailDomainEnabled('other.test', env))
 assert.doesNotThrow(() => requireMailDomainEnabled('customer.test', env))
})
