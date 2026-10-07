import { createHash } from 'node:crypto'
import { readdirSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join, relative } from 'node:path'
import { marked } from 'marked'

import { legalReleases } from './releases.js'

export {
  BUSINESS_USE_DECLARATION_TEXT_NL,
  BUSINESS_USE_DECLARATION_VERSION,
  businessUseDeclarations,
  currentBusinessUseDeclaration,
  getBusinessUseDeclaration,
  validateBusinessUseDeclarations,
} from './business-use-declarations.js'

/** @type {Readonly<Record<string, readonly string[]>>} */
const customerActionsByCategory = Object.freeze({
  editorial: ['none'],
  non_material_clarification: ['none', 'publish_notice'],
  administrative: ['none', 'publish_notice', 'direct_notice'],
  service_operational: ['publish_notice', 'direct_notice'],
  subprocessor_change: ['direct_notice'],
  privacy_transparency: ['none', 'publish_notice'],
  privacy_material: ['direct_notice'],
  contract_material: ['notice_and_continued_use', 'reaccept_on_next_transaction', 'mandatory_reaccept'],
  customer_adverse: ['mandatory_reaccept'],
  consent_scope_change: ['publish_notice', 'direct_notice'],
})

/** @type {Readonly<Record<string, readonly string[]>>} */
const consentActionsByCategory = Object.freeze({
  editorial: ['none'],
  non_material_clarification: ['none'],
  administrative: ['none'],
  service_operational: ['none'],
  subprocessor_change: ['none'],
  privacy_transparency: ['none'],
  privacy_material: ['none', 'renew_analytics', 'renew_marketing', 'renew_all_optional'],
  contract_material: ['none'],
  customer_adverse: ['none'],
  consent_scope_change: ['renew_analytics', 'renew_marketing', 'renew_all_optional'],
})

const packageRoot = process.env.SIAB_LEGAL_CONTENT_ROOT
  ?? join(dirname(fileURLToPath(import.meta.url)), '..')
const documentRoot = join(packageRoot, 'documents')

/** @param {import("./index.js").LegalRelease} release */
function documentUrl(release) {
  return join(
    documentRoot,
    release.documentType,
    release.locale,
    `${release.documentVersion}.md`,
  )
}

/** @param {string} directory
 * @returns {string[]} */
function listMarkdownFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name)
    return entry.isDirectory() ? listMarkdownFiles(path) : path.endsWith('.md') ? [path] : []
  })
}

/** @param {string | Uint8Array} content
 * @returns {`sha256:${string}`} */
export function hashLegalContent(content) {
  return `sha256:${createHash('sha256').update(content).digest('hex')}`
}

/** @param {import("./index.js").LegalRelease} release
 * @param {string} [suppliedMarkdown]
 * @returns {import("./index.js").LegalDocument} */
export function loadLegalDocument(release, suppliedMarkdown) {
  const markdown = suppliedMarkdown ?? readFileSync(documentUrl(release), 'utf8')
  return Object.freeze({
    ...release,
    markdown,
    html: marked.parse(markdown, { async: false, gfm: true }),
    stablePath: `/${release.slug}`,
    permanentPath: `/juridisch/${release.slug}/${release.documentVersion}`,
  })
}

/** @param {{documentType?: import("./index.js").LegalDocumentType, locale?: string}} [filters] */
export function getLegalReleases(filters = {}) {
  return legalReleases
    .filter((release) => !filters.documentType || release.documentType === filters.documentType)
    .filter((release) => !filters.locale || release.locale === filters.locale)
    .map((release) => loadLegalDocument(release))
}

/** @param {import("./index.js").LegalDocumentType} documentType
 * @param {string} locale
 * @param {string} documentVersion */
export function getLegalRelease(documentType, locale, documentVersion) {
  const release = legalReleases.find(
    (entry) =>
      entry.documentType === documentType &&
      entry.locale === locale &&
      entry.documentVersion === documentVersion,
  )

  if (!release) {
    throw new Error(`Unknown legal release: ${documentType}/${locale}/${documentVersion}`)
  }

  return loadLegalDocument(release)
}

/** @param {import("./index.js").LegalDocumentType} documentType
 * @param {string} [locale]
 * @param {Date} [at] */
export function getCurrentLegalDocument(documentType, locale = 'nl', at = new Date()) {
  const current = legalReleases
    .filter((release) => release.documentType === documentType && release.locale === locale)
    .filter((release) => new Date(release.effectiveAt).getTime() <= at.getTime())
    .sort((left, right) => new Date(right.effectiveAt).getTime() - new Date(left.effectiveAt).getTime())[0]

  if (!current) {
    throw new Error(`No effective legal release: ${documentType}/${locale}`)
  }

  return loadLegalDocument(current)
}

/** @param {Date} [at]
 * @returns {import("./index.js").PublicLegalManifest} */
export function createPublicLegalManifest(at = new Date()) {
  /** @type {Map<string, import("./index.js").LegalRelease>} */
  const effective = new Map()

  for (const release of legalReleases) {
    if (new Date(release.publishedAt).getTime() > at.getTime()) continue

    const key = `${release.documentType}:${release.locale}`
    const previous = effective.get(key)
    const isCurrent = new Date(release.effectiveAt).getTime() <= at.getTime() && (
      !previous || new Date(previous.effectiveAt).getTime() < new Date(release.effectiveAt).getTime()
    )
    if (isCurrent) effective.set(key, release)
  }

  return {
    schemaVersion: 1,
    documents: legalReleases
      .filter((release) => new Date(release.publishedAt).getTime() <= at.getTime())
      .map((release) => ({
        documentType: release.documentType,
        locale: release.locale,
        title: release.title,
        documentVersion: release.documentVersion,
        acceptanceVersion: release.acceptanceVersion,
        publishedAt: release.publishedAt,
        effectiveAt: release.effectiveAt,
        contentHash: release.contentHash,
        status: effective.get(`${release.documentType}:${release.locale}`) === release
          ? 'current'
          : new Date(release.effectiveAt).getTime() > at.getTime() ? 'scheduled' : 'archived',
        stablePath: `/${release.slug}`,
        permanentPath: `/juridisch/${release.slug}/${release.documentVersion}`,
      })),
  }
}

export function validateLegalReleases() {
  const errors = []
  const identities = new Set()

  for (const release of legalReleases) {
    const identity = `${release.documentType}:${release.locale}:${release.documentVersion}`
    if (identities.has(identity)) errors.push(`Duplicate release ${identity}`)
    identities.add(identity)

    let content
    try {
      content = readFileSync(documentUrl(release))
    } catch {
      errors.push(`Missing document for ${identity}`)
      continue
    }

    const actualHash = hashLegalContent(content)
    if (actualHash !== release.contentHash) {
      errors.push(`Hash mismatch for ${identity}: expected ${release.contentHash}, received ${actualHash}`)
    }

    if (Number.isNaN(new Date(release.publishedAt).valueOf())) errors.push(`Invalid publishedAt for ${identity}`)
    if (Number.isNaN(new Date(release.effectiveAt).valueOf())) errors.push(`Invalid effectiveAt for ${identity}`)
    if (new Date(release.publishedAt).getTime() > new Date(release.effectiveAt).getTime()) {
      errors.push(`publishedAt must not be after effectiveAt for ${identity}`)
    }

    const allowedCustomerActions = customerActionsByCategory[release.change.category]
    const allowedConsentActions = consentActionsByCategory[release.change.category]
    if (!allowedCustomerActions?.includes(release.change.customerAction)) {
      errors.push(`Invalid customer action for ${identity}: ${release.change.category}/${release.change.customerAction}`)
    }
    if (!allowedConsentActions?.includes(release.change.consentAction)) {
      errors.push(`Invalid consent action for ${identity}: ${release.change.category}/${release.change.consentAction}`)
    }

    if (!release.change.summary.trim()) errors.push(`Missing change summary for ${identity}`)
    if (!release.change.rationale.trim()) errors.push(`Missing change rationale for ${identity}`)
    if (['mandatory_reaccept', 'notice_and_continued_use'].includes(release.change.customerAction)) {
      if (typeof release.change.noticeDays !== "number" || !Number.isInteger(release.change.noticeDays) || release.change.noticeDays < 0) {
        errors.push(`${release.change.customerAction} requires a non-negative integer noticeDays for ${identity}`)
      } else {
        const actualNoticeMs = new Date(release.effectiveAt).getTime() - new Date(release.publishedAt).getTime()
        if (actualNoticeMs < release.change.noticeDays * 86_400_000) {
          errors.push(`publishedAt/effectiveAt do not provide noticeDays for ${identity}`)
        }
      }
    }

    if (release.replaces) {
      const previous = legalReleases.find((candidate) =>
        candidate.documentType === release.documentType &&
        candidate.locale === release.locale &&
        candidate.documentVersion === release.replaces,
      )
      if (!previous) {
        errors.push(`Unknown replacement target for ${identity}: ${release.replaces}`)
      } else {
        const requiresAcceptance = ['notice_and_continued_use', 'reaccept_on_next_transaction', 'mandatory_reaccept']
          .includes(release.change.customerAction)
        if (requiresAcceptance && release.acceptanceVersion === previous.acceptanceVersion) {
          errors.push(`Re-acceptance requires a new acceptanceVersion for ${identity}`)
        }
        if (release.change.category === 'editorial' && release.acceptanceVersion !== previous.acceptanceVersion) {
          errors.push(`Editorial changes must preserve acceptanceVersion for ${identity}`)
        }
      }
    }
  }

  const registeredFiles = new Set(legalReleases.map((release) =>
    `${release.documentType}/${release.locale}/${release.documentVersion}.md`,
  ))
  for (const file of listMarkdownFiles(documentRoot)) {
    const relativePath = relative(documentRoot, file).replaceAll('\\', '/')
    if (!registeredFiles.has(relativePath)) errors.push(`Unregistered legal document: ${relativePath}`)
  }

  return errors
}

export { legalReleases }
