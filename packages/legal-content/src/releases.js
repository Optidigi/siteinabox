/**
 * Published legal releases are immutable. Add a new file and release entry for
 * every change; never edit a release that has already been deployed.
 */
export const legalReleases = Object.freeze([
  Object.freeze({
    documentType: 'platform-terms',
    locale: 'nl',
    title: 'Algemene voorwaarden Site in a Box',
    slug: 'algemene-voorwaarden',
    documentVersion: '2026-07-07.1',
    acceptanceVersion: 'platform-terms-2026-07-07',
    statementVersion: 'platform-terms-acceptance-2026-07-07.1',
    replaces: null,
    publishedAt: '2026-07-07T00:00:00+02:00',
    effectiveAt: '2026-07-07T00:00:00+02:00',
    contentHash: 'sha256:69f61bfc1f70a05ae95ff358d0a001b98b8a2ed00fc81fac53e2c3cc98dee8a9',
    change: Object.freeze({
      category: 'administrative',
      summary: 'Eerste versie van de algemene voorwaarden voor Site in a Box.',
      rationale: 'Initiële publicatie van de goedgekeurde juridische voorwaarden.',
      customerAction: 'none',
      consentAction: 'none',
      audience: 'new_customers',
    }),
  }),
  Object.freeze({
    documentType: 'platform-privacy',
    locale: 'nl',
    title: 'Privacy- en cookieverklaring Site in a Box',
    slug: 'privacy-en-cookieverklaring',
    documentVersion: '2026-07-07.1',
    acceptanceVersion: null,
    statementVersion: null,
    replaces: null,
    publishedAt: '2026-07-07T00:00:00+02:00',
    effectiveAt: '2026-07-07T00:00:00+02:00',
    contentHash: 'sha256:6b60978f50d461f9a3daa3ec6a54c5ca9033a1f3b97859236cebb1a990e883b2',
    change: Object.freeze({
      category: 'administrative',
      summary: 'Eerste versie van de privacy- en cookieverklaring voor Site in a Box.',
      rationale: 'Initiële publicatie van de goedgekeurde privacy-informatie.',
      customerAction: 'none',
      consentAction: 'none',
      audience: 'all_visitors',
    }),
  }),
])
