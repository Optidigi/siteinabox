import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mailActorCanOrder } from '../../src/lib/microsoftMailProvisioning/customerAuthority.ts'
test('mail support records the actual privileged actor without granting cross-workspace owner access', () => {
 assert.equal(mailActorCanOrder({role:'super-admin',tenants:[]},56),true)
 assert.equal(mailActorCanOrder({role:'super-admin',tenants:[{tenant:56}]},56),false)
 assert.equal(mailActorCanOrder({role:'owner',tenants:[{tenant:56}]},56),true)
 assert.equal(mailActorCanOrder({role:'owner',tenants:[{tenant:57}]},56),false)
 assert.equal(mailActorCanOrder({role:'editor',tenants:[{tenant:56}]},56),false)
 assert.equal(mailActorCanOrder({role:'owner',tenants:[{tenant:56},{tenant:57}]},56),false)
})
