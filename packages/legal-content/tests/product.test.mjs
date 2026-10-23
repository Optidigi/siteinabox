import test from 'node:test'
import assert from 'node:assert/strict'
import { getLegalReleases, createPublicLegalManifest } from '../src/index.js'
import { productLegalReleases, getProductLegalRelease, assertProductLegalReviewable, productLegalState, validateProductLegalReleases } from '../src/product.js'

test('drafts validate without entering the historical landing registry/manifest', () => {
  assert.deepEqual(validateProductLegalReleases(), [])
  assert.equal(getLegalReleases().length, 3)
  assert(createPublicLegalManifest(new Date('2099-01-01')).documents.every(doc => doc.documentVersion !== '2026-10-23.1'))
  const bundle = getProductLegalRelease(productLegalReleases[0].releaseKey)
  assert.equal(bundle.documents.length, 4)
  assert.throws(() => assertProductLegalReviewable(bundle), /Unresolved/)
  assert.equal(productLegalState(bundle, null, null, new Date('2099-01-01')), 'draft')
})

test('review and activation are separately bound to exact immutable content', () => {
  const original = getProductLegalRelease(productLegalReleases[0].releaseKey)
  const bundle = { ...original, draftBlockers: [] }
  const review = { bundleHash: bundle.bundleHash, approvalRef: 'synthetic-owner-review', actorId: '1' }
  assert.equal(productLegalState(bundle, review), 'reviewed')
  const activation = { bundleHash: bundle.bundleHash, reviewRef: review.approvalRef,
    authorizationRef: 'synthetic-publication-approval', actorId: '1', occurredAt: '2026-10-23T00:00:00Z' }
  assert.equal(productLegalState(bundle, review, activation, new Date('2026-10-24')), 'active')
  assert.equal(productLegalState(bundle, review, { ...activation, bundleHash: 'changed' }), 'reviewed')
  assert.equal(productLegalState(bundle, { ...review, approvalRef: '' }, activation), 'draft')
  assert.equal(productLegalState(original, review, activation), 'draft')
})
