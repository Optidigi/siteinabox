export type LegalDocumentType = 'platform-terms' | 'platform-privacy'

export type LegalCustomerAction =
  | 'none'
  | 'publish_notice'
  | 'direct_notice'
  | 'notice_and_continued_use'
  | 'reaccept_on_next_transaction'
  | 'mandatory_reaccept'

export interface LegalRelease {
  documentType: LegalDocumentType
  locale: string
  title: string
  slug: string
  documentVersion: string
  acceptanceVersion: string | null
  statementVersion: string | null
  replaces: string | null
  publishedAt: string
  effectiveAt: string
  contentHash: `sha256:${string}`
  change: {
    category: string
    summary: string
    rationale: string
    customerAction: LegalCustomerAction
    consentAction: string
    audience: string
    noticeDays?: number
  }
}

export interface LegalDocument extends LegalRelease {
  markdown: string
  html: string
  stablePath: string
  permanentPath: string
}

export interface PublicLegalManifest {
  schemaVersion: 1
  documents: Array<{
    documentType: LegalDocumentType
    locale: string
    title: string
    documentVersion: string
    acceptanceVersion: string | null
    publishedAt: string
    effectiveAt: string
    contentHash: `sha256:${string}`
    status: 'current' | 'scheduled' | 'archived'
    stablePath: string
    permanentPath: string
  }>
}

export const legalReleases: readonly LegalRelease[]
export function hashLegalContent(content: string | Uint8Array): `sha256:${string}`
export function loadLegalDocument(release: LegalRelease, suppliedMarkdown?: string): LegalDocument
export function getLegalReleases(filters?: {
  documentType?: LegalDocumentType
  locale?: string
}): LegalDocument[]
export function getLegalRelease(
  documentType: LegalDocumentType,
  locale: string,
  documentVersion: string,
): LegalDocument
export function getCurrentLegalDocument(
  documentType: LegalDocumentType,
  locale?: string,
  at?: Date,
): LegalDocument
export function createPublicLegalManifest(at?: Date): PublicLegalManifest
export function validateLegalReleases(): string[]
