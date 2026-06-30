import { describe, expect, it } from 'vitest';
import {
  IntakeSubmissionSchema,
  PublicIntakeSubmissionSchema,
  RawIntakeSubmissionSchema,
} from '@siteinabox/contracts/generation';
import { serializeIntakeSubmission } from '../src/components/intake/domain/submission';

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

  it('accepts the richer standalone wizard raw state shape', () => {
    const parsed = RawIntakeSubmissionSchema.safeParse({
      submittedAt: '2026-06-29T10:00:00.000Z',
      source: 'public-intake',
      company: {
        source: 'kvk',
        companyName: 'Demo Studio',
        kvkNumber: '12345678',
        address: 'Stationsplein 1, Roermond',
        website: 'https://demo-studio.nl',
        mainActivity: 'Interieuradvies',
        secondaryActivities: ['Projectbegeleiding'],
      },
      content: {
        intro: 'Wij helpen ondernemers met praktische interieurplannen.',
        offers: [{ value: 'Interieuradvies' }, { value: 'Projectinrichting' }],
        audience: 'Lokale ondernemers',
        situation: 'Klanten willen hun ruimte professioneler maken.',
        approach: 'We starten met een intake en concreet plan.',
        workModes: ['on_location', 'fixed_region'],
        region: 'Limburg',
        notes: 'Leg nadruk op persoonlijke begeleiding.',
      },
      contact: {
        selectedActions: ['message', 'quote'],
        formType: 'multiple',
        formOptions: ['message', 'quote'],
        primaryAction: 'quote',
        phoneNumber: '0612345678',
        whatsappMode: 'same',
        whatsappNumber: '',
        locationOptions: ['region'],
        publicRegion: 'Limburg',
        publicAddress: '',
        availabilityMode: 'appointment_only',
        openingHours: '',
      },
      visual: {
        logo: { mode: 'textlogo', file: null, text: 'Demo Studio' },
        color: {
          sourceType: 'preset',
          sourceValue: 'green',
          selectedPalette: 'palette_1',
          tokens: {
            background: '#ffffff',
            foreground: '#111111',
            card: '#ffffff',
            cardForeground: '#111111',
            primary: '#146c43',
            primaryForeground: '#ffffff',
            secondary: '#e7f3ed',
            secondaryForeground: '#111111',
            muted: '#f3f4f6',
            mutedForeground: '#4b5563',
            accent: '#d1fae5',
            accentForeground: '#111111',
            border: '#d1d5db',
            input: '#d1d5db',
            ring: '#146c43',
            destructive: '#dc2626',
            destructiveForeground: '#ffffff',
          },
        },
        shape: 'slightly_rounded',
        typography: 'clear',
      },
      finalDetails: {
        name: 'Demo Contact',
        email: 'demo@example.com',
        phone: '0612345678',
      },
      domain: 'demo-studio.nl',
      email: 'info@demo-studio.nl',
      addOns: ['email'],
      notes: null,
    });

    expect(parsed.success).toBe(true);
    expect(PublicIntakeSubmissionSchema.safeParse(parsed.success ? parsed.data : {}).success).toBe(true);
  });

  it('serializes the current wizard state into the rich CMS intake shape', () => {
    const serialized = serializeIntakeSubmission({
      company: {
        source: 'manual',
        companyName: 'Wizard Demo',
        kvkNumber: '',
        address: 'Markt 1, Roermond',
        website: 'https://wizard-demo.nl',
        mainActivity: '',
        secondaryActivities: [],
      },
      content: {
        intro: 'Wij helpen lokale ondernemers met een duidelijke website.',
        offers: [{ value: 'Website laten maken' }],
        audience: 'Lokale ondernemers',
        situation: 'Klanten willen snel kunnen zien wat we doen.',
        approach: 'We maken het aanbod concreet en zorgen voor duidelijke acties.',
        workModes: ['fixed_region'],
        region: 'Roermond',
        notes: 'Gebruik een rustige toon.',
      },
      contact: {
        selectedActions: ['message'],
        formType: 'message',
        formOptions: ['message'],
        primaryAction: 'message',
        phoneNumber: '0612345678',
        whatsappMode: 'none',
        whatsappNumber: '',
        locationOptions: ['region'],
        publicRegion: 'Roermond',
        publicAddress: '',
        availabilityMode: 'appointment_only',
        openingHours: '',
      },
      visual: {
        logo: { mode: 'textlogo', file: null, text: 'Wizard Demo' },
        color: {
          sourceType: 'preset',
          sourceValue: '#274a34',
          selectedPalette: 'palette_1',
          tokens: {
            background: '#fbfaf6',
            foreground: '#232323',
            card: '#ffffff',
            cardForeground: '#232323',
            primary: '#274a34',
            primaryForeground: '#ffffff',
            secondary: '#e7efe4',
            secondaryForeground: '#274a34',
            muted: '#f4f4f1',
            mutedForeground: '#6f6f6f',
            accent: '#ccf88e',
            accentForeground: '#274a34',
            border: '#d9d9d6',
            input: '#b7b7b6',
            ring: '#8ca88f',
            destructive: '#ba1a1a',
            destructiveForeground: '#ffffff',
          },
        },
        shape: 'slightly_rounded',
        typography: 'clear',
      },
      finalDetails: {
        name: 'Demo Aanvrager',
        email: 'demo@example.com',
        phone: '0612345678',
      },
    });

    expect(serialized).toMatchObject({
      source: 'public-intake',
      company: {
        source: 'manual',
        companyName: 'Wizard Demo',
      },
      domain: null,
      email: null,
      visual: {
        logo: {
          mode: 'textlogo',
          file: null,
          text: 'Wizard Demo',
        },
      },
    });
    expect(RawIntakeSubmissionSchema.safeParse(serialized).success).toBe(true);
    expect(PublicIntakeSubmissionSchema.safeParse(serialized).success).toBe(true);
  });
});
