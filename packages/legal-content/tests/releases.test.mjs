import assert from 'node:assert/strict'
import test from 'node:test'
import { publicAnalyticsConsentApproval } from '../src/consent-approval.js'

import {
  createPublicLegalManifest,
  getCurrentLegalDocument,
  getLegalRelease,
  validateLegalReleases,
} from '../src/index.js'

test('public analytics approval is anchored to the current privacy release', () => {
  const privacy = getCurrentLegalDocument('platform-privacy', 'nl', new Date('2026-07-11T00:00:00Z'))

  assert.equal(publicAnalyticsConsentApproval.privacyDocumentVersion, privacy.documentVersion)
  assert.equal(publicAnalyticsConsentApproval.consentVersion, null)
  assert.equal(publicAnalyticsConsentApproval.maxEventRetentionDays, 396)
})

test('the immutable release registry is valid', () => {
  assert.deepEqual(validateLegalReleases(), [])
})

test('initial approved source content remains unchanged', () => {
  const terms = getLegalRelease('platform-terms', 'nl', '2026-07-07.1')
  const privacy = getLegalRelease('platform-privacy', 'nl', '2026-07-07.1')

  assert.equal(terms.contentHash, 'sha256:69f61bfc1f70a05ae95ff358d0a001b98b8a2ed00fc81fac53e2c3cc98dee8a9')
  assert.equal(privacy.contentHash, 'sha256:6b60978f50d461f9a3daa3ec6a54c5ca9033a1f3b97859236cebb1a990e883b2')
  assert.match(terms.markdown, /een handelsnaam van Optidigi/)
  assert.match(privacy.markdown, /een handelsnaam van Optidigi/)
})

test('current aliases and permanent paths come from the same release', () => {
  const terms = getCurrentLegalDocument('platform-terms', 'nl', new Date('2026-07-10T00:00:00Z'))

  assert.equal(terms.documentVersion, '2026-07-07.1')
  assert.equal(terms.stablePath, '/algemene-voorwaarden')
  assert.equal(terms.permanentPath, '/juridisch/algemene-voorwaarden/2026-07-07.1')
  assert.match(terms.html, /<h1>Algemene voorwaarden Site in a Box<\/h1>/)
})

test('public manifest exposes hashes and current release paths', () => {
  const manifest = createPublicLegalManifest(new Date('2026-07-10T00:00:00Z'))

  assert.equal(manifest.schemaVersion, 1)
  assert.equal(manifest.documents.length, 2)
  assert.ok(manifest.documents.every((document) => document.status === 'current'))
  assert.ok(manifest.documents.every((document) => document.contentHash.startsWith('sha256:')))
})
