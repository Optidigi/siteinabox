import {
  createPublicLegalManifest,
  legalReleases,
  loadLegalDocument,
  type LegalDocument,
  type LegalDocumentType,
} from '@siteinabox/legal-content';

const contentModules = import.meta.glob('../../../../packages/legal-content/documents/**/*.md', {
  eager: true,
  import: 'default',
  query: '?raw',
});

function loadBundledLegalDocument(release: (typeof legalReleases)[number]): LegalDocument {
  const documentPath = `../../../../packages/legal-content/documents/${release.documentType}/${release.locale}/${release.documentVersion}.md`;
  const markdown = contentModules[documentPath];
  if (typeof markdown !== 'string') throw new Error(`Missing bundled legal content: ${documentPath}`);
  return loadLegalDocument(release, markdown);
}

export function getLegalReleases(
  filters: { documentType?: LegalDocumentType; locale?: string } = {},
  at = new Date(),
) {
  return legalReleases
    .filter((release) => !filters.documentType || release.documentType === filters.documentType)
    .filter((release) => !filters.locale || release.locale === filters.locale)
    .filter((release) => new Date(release.publishedAt) <= at)
    .map(loadBundledLegalDocument);
}

export function getCurrentLegalDocument(
  documentType: LegalDocumentType,
  locale = 'nl',
  at = new Date(),
) {
  const current = legalReleases
    .filter((release) => release.documentType === documentType && release.locale === locale)
    .filter((release) => new Date(release.effectiveAt) <= at)
    .sort((left, right) => new Date(right.effectiveAt).valueOf() - new Date(left.effectiveAt).valueOf())[0];

  if (!current) throw new Error(`No effective legal release: ${documentType}/${locale}`);
  return loadBundledLegalDocument(current);
}

export { createPublicLegalManifest };
