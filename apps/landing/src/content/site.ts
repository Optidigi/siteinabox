import { SITE_IN_A_BOX_PRODUCT } from '@siteinabox/contracts';

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
  language: string;
  primaryDomain: string;
  aliases: string[];
  description: string;
  contact: {
    email: string;
    phone: {
      display: string;
      e164: string;
    };
    whatsapp: {
      display: string;
      e164: string;
    };
  };
  nap?: NAP;
  hours?: OpeningHours[];
  serviceArea?: string[];
  socials: {
    facebook?: string;
    instagram?: string;
    linkedin?: string;
    youtube?: string;
    x?: string;
  };
  links: {
    intake: string;
    builder: string;
    login: string;
    beheer: string;
    platformAdminLogin: string;
    whatsapp: string;
    phone: string;
    email: string;
  };
  nav: { label: string; href: string }[];
};

const contact = {
  email: 'info@siteinabox.nl',
  phone: {
    display: '085 083 5858',
    e164: '+31850835858',
  },
  whatsapp: {
    display: 'Stuur ons een bericht',
    e164: '+31625052591',
  },
} satisfies SiteConfig['contact'];

export const site: SiteConfig = {
  brand: SITE_IN_A_BOX_PRODUCT.name,
  language: 'nl',
  primaryDomain: 'siteinabox.nl',
  aliases: ['www.siteinabox.nl'],
  description: "Professionele website voor je nieuwe bedrijf. Vanaf €19 per maand. Eerste versie in de builder, live binnen 3 werkdagen. Betalen als je tevreden bent.",
  contact,
  serviceArea: ['Nederland'],
  socials: {
    instagram: 'https://www.instagram.com/siteinabox/',
  },
  links: {
    intake: import.meta.env.PROD
      ? 'https://preview.siteinabox.nl/builder?intent=register'
      : 'http://localhost:3000/builder?intent=register',
    builder: import.meta.env.PROD
      ? 'https://preview.siteinabox.nl/builder?intent=register'
      : 'http://localhost:3000/builder?intent=register',
    login: import.meta.env.PROD
      ? 'https://preview.siteinabox.nl/builder?intent=login'
      : 'http://localhost:3000/builder?intent=login',
    beheer: '/beheer/',
    platformAdminLogin: 'https://admin.siteinabox.nl/login',
    whatsapp: `https://wa.me/${contact.whatsapp.e164.slice(1)}`,
    phone: `tel:${contact.phone.e164}`,
    email: `mailto:${contact.email}`,
  },
  nav: [
    // Root-absolute (/#...) so these section links work from any page, not just the homepage.
    { label: 'Hoe het werkt', href: '/#zo-werkt-het' },
    { label: 'Prijzen', href: '/#prijzen' },
    { label: 'Bouwen', href: import.meta.env.PROD ? 'https://preview.siteinabox.nl/builder?intent=register' : 'http://localhost:3000/builder?intent=register' },
    { label: 'Contact', href: '/contact' },
  ],
};
