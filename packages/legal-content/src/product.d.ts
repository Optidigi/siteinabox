import type { LegalDocument, LegalRelease } from './index.js'
export interface ProductLegalRelease {
  releaseKey: string
  draftBlockers: string[]
  documents: Array<Omit<LegalRelease, 'publishedAt' | 'effectiveAt'>>
}
export interface ProductLegalBundle extends Omit<ProductLegalRelease, 'documents'> {
  documents: Array<Omit<LegalDocument, 'publishedAt' | 'effectiveAt'>>
  bundleHash: `sha256:${string}`
}
export interface ProductReviewEvidence { bundleHash: string; approvalRef: string; actorId: string }
export interface ProductActivationEvidence {
  bundleHash: string; reviewRef: string; authorizationRef: string; actorId: string; occurredAt: string
}
export const productLegalReleases: readonly ProductLegalRelease[]
export const productLegalStatements: ReadonlyArray<Readonly<{ locale: 'nl' | 'en'; version: string; text: string }>>
export function getProductLegalStatement(version: string, locale: string): Readonly<{ locale: 'nl' | 'en'; version: string; text: string }>
export function getProductLegalRelease(key: string): ProductLegalBundle
export function assertProductLegalReviewable(release: ProductLegalBundle): void
export function productLegalState(release: Pick<ProductLegalBundle, 'bundleHash' | 'draftBlockers'>, review?: ProductReviewEvidence | null,
  activation?: ProductActivationEvidence | null, at?: Date): 'draft' | 'reviewed' | 'active'
export function validateProductLegalReleases(): string[]
