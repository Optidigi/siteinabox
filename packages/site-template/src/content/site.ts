export type NAP = {
  legalName: string;
  displayName: string;
  street: string;
  postalCode: string;
  city: string;
  country: string;          // ISO-3166-1 alpha-2
  phone: string;            // E.164 preferred
  email: string;
};

export type OpeningHours = {
  dayOfWeek: 'Mo' | 'Tu' | 'We' | 'Th' | 'Fr' | 'Sa' | 'Su';
  opens: string;            // 'HH:MM'
  closes: string;
};

export type SiteConfig = {
  brand: string;
  language: string;         // 'nl' | 'en' | etc.
  primaryDomain: string;    // 'amicare.nl'
  aliases: string[];        // ['ami-care.nl', 'a-m-i-care.com']
  description: string;
  nap?: NAP;
  hours?: OpeningHours[];
  serviceArea?: string[];   // ['Amsterdam', 'Utrecht']
  maintenance?: {
    enabled?: boolean;
    message?: string;
  };
  socials: {
    facebook?: string;
    instagram?: string;
    linkedin?: string;
    youtube?: string;
    x?: string;
  };
  nav: { label: string; href: string }[];
};

export const site: SiteConfig = {
  brand: 'Example Brand',
  language: 'nl',
  primaryDomain: 'example.com',
  aliases: [],
  description: 'Replace this description per site during Phase 1 intake.',
  socials: {},
  nav: [
    { label: 'Home', href: '/' },
  ],
};
