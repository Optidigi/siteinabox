import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import {
  createPublicLegalManifest,
  getCurrentLegalDocument,
  validateLegalReleases,
} from '@siteinabox/legal-content';

describe('legal publication routes', () => {
  it('uses a valid immutable legal registry', () => {
    expect(validateLegalReleases()).toEqual([]);
  });

  it('provides stable and permanent URLs for every current document', () => {
    const terms = getCurrentLegalDocument('platform-terms', 'nl', new Date('2026-07-10T00:00:00Z'));
    const privacy = getCurrentLegalDocument('platform-privacy', 'nl', new Date('2026-07-10T00:00:00Z'));

    expect(terms.stablePath).toBe('/algemene-voorwaarden');
    expect(terms.permanentPath).toContain('/juridisch/algemene-voorwaarden/');
    expect(privacy.stablePath).toBe('/privacy-en-cookieverklaring');
    expect(privacy.permanentPath).toContain('/juridisch/privacy-en-cookieverklaring/');
  });

  it('publishes only verified content hashes', () => {
    const manifest = createPublicLegalManifest(new Date('2026-07-10T00:00:00Z'));

    expect(manifest.documents).toHaveLength(2);
    expect(manifest.documents.every((entry) => entry.contentHash.startsWith('sha256:'))).toBe(true);
  });

  it('keeps the legacy privacy route as a configured redirect', () => {
    const config = readFileSync(new URL('../astro.config.mjs', import.meta.url), 'utf8');
    expect(config).toContain("'/privacy-policy': '/privacy-en-cookieverklaring'");
  });
});
