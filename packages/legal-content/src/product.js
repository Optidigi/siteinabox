import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { marked } from 'marked'
import { hashLegalContent, validateLegalChangeDecision, legalReleases } from './index.js'
import releases from './product-releases.json' with { type: 'json' }

const root = process.env.SIAB_LEGAL_CONTENT_ROOT ?? join(dirname(fileURLToPath(import.meta.url)), '..')
const freeze = value => {
  if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value) }
  return value
}
export const productLegalReleases = freeze(releases)
export const productLegalStatements = freeze([
  { locale: 'nl', version: 'product-terms-acceptance-nl-2026-10-23.1', text: 'Ik sluit uitsluitend zakelijk af en ga akkoord met de getoonde versie van de productvoorwaarden.' },
  { locale: 'en', version: 'product-terms-acceptance-en-2026-10-23.1', text: 'I contract solely for business or professional purposes and accept the displayed version of the product terms.' },
])
export function getProductLegalStatement(version, locale) {
  const statement = productLegalStatements.find(item => item.version === version && item.locale === locale)
  assert(statement, 'Unknown locale/version acceptance statement')
  return statement
}

export function getProductLegalRelease(key) {
  const source = productLegalReleases.find(release => release.releaseKey === key)
  assert(source, 'Unknown product legal release')
  const documents = source.documents.map(document => {
    const markdown = readFileSync(join(root, 'product-documents', document.documentType, document.locale, document.documentVersion + '.md'), 'utf8')
    assert.equal(hashLegalContent(markdown), document.contentHash, 'Product legal content hash mismatch')
    const permanentPath = `/policies/${document.locale}/${document.documentType}/${document.documentVersion}`
    return { ...document, markdown, html: marked.parse(markdown, { async: false, gfm: true }),
      permanentPath, stablePath: permanentPath }
  })
  return { ...source, documents, bundleHash: hashLegalContent(JSON.stringify({ releaseKey: source.releaseKey,
    documents: source.documents, statements: source.documents.filter(doc => doc.statementVersion).map(doc => getProductLegalStatement(doc.statementVersion, doc.locale)), draftBlockers: source.draftBlockers })) }
}

export function assertProductLegalReviewable(release) {
  assert.equal(release.draftBlockers.length, 0, 'Unresolved product legal facts/review decisions block review and activation')
  assert.equal(release.documents.length, 4, 'Both document types and NL/EN translations are required')
  assert.equal(new Set(release.documents.map(doc => doc.documentType + ':' + doc.locale)).size, 4, 'Duplicate product type/locale')
  for (const document of release.documents) {
    assert(!/\[VERIFY:|owner-review draft|concept voor beoordeling/i.test(document.markdown), 'Unresolved draft text cannot be published')
    assert.equal(hashLegalContent(document.markdown), document.contentHash)
    assert.deepEqual(validateLegalChangeDecision(document), [])
  }
}

export function productLegalState(release, review, activation, at = new Date()) {
  if (release.draftBlockers.length) return 'draft'
  if (!review || review.bundleHash !== release.bundleHash || !review.approvalRef || !review.actorId) return 'draft'
  if (!activation || activation.bundleHash !== release.bundleHash || activation.reviewRef !== review.approvalRef ||
      !activation.authorizationRef || !activation.actorId || !Number.isFinite(Date.parse(activation.occurredAt)) ||
      new Date(activation.occurredAt) > at) return 'reviewed'
  return 'active'
}

export function validateProductLegalReleases() {
  const errors = [], identities = new Set(), files = new Set()
  const legacy = new Set(legalReleases.map(doc => `${doc.documentType}:${doc.locale}:${doc.documentVersion}`))
  for (const source of productLegalReleases) {
    try {
      const release = getProductLegalRelease(source.releaseKey)
      const expected = new Set(['platform-terms:nl', 'platform-terms:en', 'platform-privacy:nl', 'platform-privacy:en'])
      for (const doc of release.documents) {
        assert.deepEqual(validateLegalChangeDecision(doc), [])
        const identity = `${doc.documentType}:${doc.locale}:${doc.documentVersion}`
        assert(!legacy.has(identity), 'Product release cannot enter the legacy landing inventory')
        assert(!identities.has(identity), 'Duplicate product legal identity'); identities.add(identity)
        assert(expected.delete(`${doc.documentType}:${doc.locale}`), 'Unexpected product locale/type')
        assert(/^\d{4}-\d{2}-\d{2}\.\d+$/.test(doc.documentVersion), 'Invalid product document version')
        if (doc.documentType === 'platform-terms') {
          assert(doc.acceptanceVersion && getProductLegalStatement(doc.statementVersion, doc.locale), 'Missing locale-bound terms statement')
        } else assert(doc.acceptanceVersion === null && doc.statementVersion === null, 'Privacy disclosure is not contractual consent')
        files.add(`${doc.documentType}/${doc.locale}/${doc.documentVersion}.md`)
      }
      assert.equal(expected.size, 0, 'Incomplete translated release')
      for (const type of ['platform-terms', 'platform-privacy']) {
        const pair = release.documents.filter(doc => doc.documentType === type)
        const decision = doc => [doc.documentVersion, doc.acceptanceVersion, doc.change.category, doc.change.customerAction,
          doc.change.consentAction, doc.change.audience, doc.change.noticeDays ?? 0]
        assert.deepEqual(decision(pair[0]), decision(pair[1]), 'Translations must share version and approved change/consent decisions')
      }
      assert(Array.isArray(release.draftBlockers), 'Missing draft blockers')
    } catch (error) { errors.push(`${source.releaseKey}: ${error.message}`) }
  }
  const visit = (directory, prefix = '') => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const relative = prefix + entry.name
      if (entry.isDirectory()) visit(join(directory, entry.name), relative + '/')
      else if (entry.name.endsWith('.md') && !files.has(relative)) errors.push('Unregistered product legal document: ' + relative)
    }
  }
  visit(join(root, 'product-documents'))
  return errors
}
