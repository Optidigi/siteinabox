import type { RtManifest } from "@/lib/richText/manifest"

export type SettingsContract = {
  general: {
    description: boolean
    language: boolean
    contactEmail: boolean
  }
  identity: {
    branding: {
      logo: boolean
      favicon: boolean
    }
    footer: {
      tagline: boolean
      copyright: boolean
    }
  }
  details: {
    contact: {
      phone: boolean
      address: boolean
      social: boolean
    }
    business: {
      legalName: boolean
      kvkNumber: boolean
      establishmentNumber: boolean
      streetAddress: boolean
      city: boolean
      region: boolean
      postalCode: boolean
      country: boolean
    }
    serviceArea: boolean
    hours: boolean
  }
  operations: {
    maintenance: boolean
  }
}

export const DEFAULT_CLIENT_SETTINGS_CONTRACT: SettingsContract = {
  general: {
    description: true,
    language: false,
    contactEmail: false,
  },
  identity: {
    branding: {
      logo: true,
      favicon: true,
    },
    footer: {
      tagline: false,
      copyright: false,
    },
  },
  details: {
    contact: {
      phone: false,
      address: false,
      social: false,
    },
    business: {
      legalName: false,
      kvkNumber: false,
      establishmentNumber: false,
      streetAddress: false,
      city: false,
      region: false,
      postalCode: false,
      country: false,
    },
    serviceArea: false,
    hours: false,
  },
  operations: {
    maintenance: true,
  },
}

const EMPTY_SETTINGS_CONTRACT: SettingsContract = {
  general: {
    description: false,
    language: false,
    contactEmail: false,
  },
  identity: {
    branding: {
      logo: false,
      favicon: false,
    },
    footer: {
      tagline: false,
      copyright: false,
    },
  },
  details: {
    contact: {
      phone: false,
      address: false,
      social: false,
    },
    business: {
      legalName: false,
      kvkNumber: false,
      establishmentNumber: false,
      streetAddress: false,
      city: false,
      region: false,
      postalCode: false,
      country: false,
    },
    serviceArea: false,
    hours: false,
  },
  operations: {
    maintenance: false,
  },
}

export function resolveSettingsContract(manifest: unknown): SettingsContract {
  const root = manifest && typeof manifest === "object" && !Array.isArray(manifest)
    ? manifest as Pick<RtManifest, "settings">
    : null
  const settings = root?.settings
  if (!settings) return DEFAULT_CLIENT_SETTINGS_CONTRACT

  return {
    general: {
      description: settings.general?.description ?? EMPTY_SETTINGS_CONTRACT.general.description,
      language: settings.general?.language ?? EMPTY_SETTINGS_CONTRACT.general.language,
      contactEmail: settings.general?.contactEmail ?? EMPTY_SETTINGS_CONTRACT.general.contactEmail,
    },
    identity: {
      branding: {
        logo: settings.identity?.branding?.logo ?? EMPTY_SETTINGS_CONTRACT.identity.branding.logo,
        favicon: settings.identity?.branding?.favicon ?? EMPTY_SETTINGS_CONTRACT.identity.branding.favicon,
      },
      footer: {
        tagline: settings.identity?.footer?.tagline ?? EMPTY_SETTINGS_CONTRACT.identity.footer.tagline,
        copyright: settings.identity?.footer?.copyright ?? EMPTY_SETTINGS_CONTRACT.identity.footer.copyright,
      },
    },
    details: {
      contact: {
        phone: settings.details?.contact?.phone ?? EMPTY_SETTINGS_CONTRACT.details.contact.phone,
        address: settings.details?.contact?.address ?? EMPTY_SETTINGS_CONTRACT.details.contact.address,
        social: settings.details?.contact?.social ?? EMPTY_SETTINGS_CONTRACT.details.contact.social,
      },
      business: {
        legalName: settings.details?.business?.legalName ?? EMPTY_SETTINGS_CONTRACT.details.business.legalName,
        kvkNumber: settings.details?.business?.kvkNumber ?? EMPTY_SETTINGS_CONTRACT.details.business.kvkNumber,
        establishmentNumber: settings.details?.business?.establishmentNumber ?? EMPTY_SETTINGS_CONTRACT.details.business.establishmentNumber,
        streetAddress: settings.details?.business?.streetAddress ?? EMPTY_SETTINGS_CONTRACT.details.business.streetAddress,
        city: settings.details?.business?.city ?? EMPTY_SETTINGS_CONTRACT.details.business.city,
        region: settings.details?.business?.region ?? EMPTY_SETTINGS_CONTRACT.details.business.region,
        postalCode: settings.details?.business?.postalCode ?? EMPTY_SETTINGS_CONTRACT.details.business.postalCode,
        country: settings.details?.business?.country ?? EMPTY_SETTINGS_CONTRACT.details.business.country,
      },
      serviceArea: settings.details?.serviceArea ?? EMPTY_SETTINGS_CONTRACT.details.serviceArea,
      hours: settings.details?.hours ?? EMPTY_SETTINGS_CONTRACT.details.hours,
    },
    operations: {
      maintenance: settings.operations?.maintenance ?? EMPTY_SETTINGS_CONTRACT.operations.maintenance,
    },
  }
}
