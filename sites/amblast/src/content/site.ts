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

// Dutch business registration data shown in the footer "Info" column.
export type LegalInfo = {
  kvk?: string;             // Chamber of Commerce number
  btw?: string;             // VAT ID
  iban?: string;
  bic?: string;
};

export type SiteConfig = {
  brand: string;
  language: string;
  primaryDomain: string;
  aliases: string[];
  description: string;
  nap?: NAP;
  legal?: LegalInfo;
  hours?: OpeningHours[];
  serviceArea?: string[];
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
  brand: 'Amblast | Facility Services',
  language: 'nl-NL',
  primaryDomain: 'amblast.nl',
  aliases: [],
  description:
    'Amblast is dé partner voor industriële reiniging in de papierindustrie en andere productieomgevingen. Specialist in industriële schoonmaak in Limburg.',
  nap: {
    legalName: 'Amblast',
    displayName: 'Amblast | Facility Services',
    street: 'Heinsbergerweg 172',
    postalCode: '6045 CK',
    city: 'Roermond',
    country: 'NL',
    phone: '+31619963651',
    email: 'info@amblast.nl',
  },
  legal: {
    kvk: '72128690',
    btw: 'NL002407752B08',
    iban: 'NL45 INGB 0008 6149 44',
    bic: 'INGBNL2A',
  },
  hours: [
    { dayOfWeek: 'Mo', opens: '00:00', closes: '23:59' },
    { dayOfWeek: 'Tu', opens: '00:00', closes: '23:59' },
    { dayOfWeek: 'We', opens: '00:00', closes: '23:59' },
    { dayOfWeek: 'Th', opens: '00:00', closes: '23:59' },
    { dayOfWeek: 'Fr', opens: '00:00', closes: '23:59' },
    { dayOfWeek: 'Sa', opens: '00:00', closes: '23:59' },
    { dayOfWeek: 'Su', opens: '00:00', closes: '23:59' },
  ],
  serviceArea: ['Limburg'],
  socials: {},
  nav: [
    { label: 'Home', href: '/' },
    { label: 'Over ons', href: '/over-ons' },
    { label: 'Onze diensten', href: '/diensten' },
    { label: 'Portfolio', href: '/portfolio' },
  ],
};
