import { describe, expect, it } from 'vitest';
import { IntakeSubmissionSchema } from '@siteinabox/contracts/generation';

describe('intake payload contract', () => {
  it('accepts the scaffold payload shape posted by the public form', () => {
    const parsed = IntakeSubmissionSchema.safeParse({
      submittedAt: '2026-06-26T10:00:00.000Z',
      source: 'public-intake',
      businessName: 'Demo Bedrijf',
      domain: 'demo-bedrijf.nl',
      contactName: 'Demo Contact',
      contactEmail: 'demo@example.com',
      contactPhone: null,
      language: 'nl',
      industry: 'Dienstverlening',
      serviceArea: ['Roermond'],
      goals: ['Professioneel online staan'],
      pages: [{ slug: 'home', title: 'Home', purpose: 'Homepage' }],
      brand: {
        colors: ['#ffd80b'],
        tone: ['persoonlijk'],
      },
      content: {
        kvk: {
          number: null,
          enrichmentStatus: 'manual_not_enriched',
        },
        consent: {
          privacy: true,
          submittedFrom: 'https://www.siteinabox.nl/intake',
        },
      },
      notes: null,
    });

    expect(parsed.success).toBe(true);
  });
});
