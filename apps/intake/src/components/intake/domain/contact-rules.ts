import type {
  CompanyDetails,
  ContactAction,
  ContactAvailabilityMode,
  ContactDetails,
  ContactFormOption,
  ContactFormType,
  ContactLocationOption,
  ContactPrimaryAction,
  ContactWhatsappMode,
} from "./types";

export type ContactSectionId =
  | "actions";

export type ContactDetailsSectionId =
  | "direct"
  | "location"
  | "availability";

export const contactFormOptions: Array<{
  id: Exclude<ContactFormType, "">;
  title: string;
  description: string;
}> = [
  {
    id: "message",
    title: "Vraag of bericht",
    description: "Een eenvoudig contactformulier.",
  },
  {
    id: "quote",
    title: "Offerteaanvraag",
    description: "Voor aanvragen met een korte omschrijving van het werk.",
  },
  {
    id: "appointment",
    title: "Afspraakaanvraag",
    description: "Voor afspraakverzoeken die jij zelf bevestigt.",
  },
  {
    id: "multiple",
    title: "Meerdere soorten aanvragen",
    description: "Bijvoorbeeld offerte én afspraak.",
  },
  {
    id: "none",
    title: "Geen contactformulier",
    description: "Alleen contactgegevens op de contactpagina.",
  },
];

export const requestTypeOptions: Array<{
  id: ContactFormOption;
  title: string;
}> = [
  { id: "message", title: "Vraag of bericht" },
  { id: "quote", title: "Offerteaanvraag" },
  { id: "appointment", title: "Afspraakaanvraag" },
];

export const whatsappModeOptions: Array<{
  id: Exclude<ContactWhatsappMode, "">;
  title: string;
}> = [
  { id: "none", title: "Nee" },
  { id: "same", title: "Ja, hetzelfde nummer" },
  { id: "other", title: "Ja, ander nummer" },
];

export const locationDisplayOptions: Array<{
  id: ContactLocationOption;
  title: string;
  description: string;
}> = [
  {
    id: "region",
    title: "Plaats/regio waar je werkt",
    description: "Bijvoorbeeld: Utrecht en omgeving.",
  },
  {
    id: "address",
    title: "Bezoekadres voor klanten",
    description: "Voor bezoekers die naar je locatie mogen komen.",
  },
  {
    id: "none",
    title: "Geen locatieblok",
    description: "Als locatie niet belangrijk is voor je website.",
  },
];

export const availabilityOptions: Array<{
  id: Exclude<ContactAvailabilityMode, "">;
  title: string;
}> = [
  { id: "fixed", title: "Vaste tijden" },
  { id: "appointment_only", title: "Alleen op afspraak" },
  { id: "none", title: "Geen tijden" },
];

const primaryActionLabels: Record<ContactAction, string> = {
  message: "Contact opnemen",
  appointment: "Afspraak maken",
  quote: "Offerte aanvragen",
  phone: "Direct bellen",
  whatsapp: "WhatsApp sturen",
};

export const contactActionOptions: Array<{
  id: ContactAction;
  title: string;
  description: string;
}> = [
  {
    id: "message",
    title: "Contact opnemen",
    description: "Voor gewone vragen of een bericht.",
  },
  {
    id: "appointment",
    title: "Afspraak maken",
    description: "Voor bezoekers die een afspraak willen aanvragen.",
  },
  {
    id: "quote",
    title: "Offerte aanvragen",
    description: "Voor aanvragen met een korte omschrijving van het werk.",
  },
  {
    id: "phone",
    title: "Direct bellen",
    description: "Voor bezoekers die snel telefonisch contact willen.",
  },
  {
    id: "whatsapp",
    title: "WhatsApp sturen",
    description: "Voor snelle vragen via WhatsApp.",
  },
];

export function normalizePhoneNumber(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

export function isValidPublicPhoneNumber(value: string) {
  const normalized = normalizePhoneNumber(value);
  const digits = normalized.replace(/\D/g, "");

  return /^\+?[0-9 ]+$/.test(normalized) && digits.length >= 9;
}

function hasValidPhone(contact: ContactDetails) {
  return isValidPublicPhoneNumber(contact.phoneNumber);
}

function hasValidWhatsapp(contact: ContactDetails) {
  if (
    hasSelectedAction(contact, "phone") &&
    contact.whatsappMode === "same"
  ) {
    return hasValidPhone(contact);
  }
  if (
    !hasSelectedAction(contact, "phone") ||
    contact.whatsappMode === "other"
  ) {
    return isValidPublicPhoneNumber(contact.whatsappNumber);
  }

  return false;
}

function hasSelectedAction(contact: ContactDetails, action: ContactAction) {
  return contact.selectedActions.includes(action);
}

export function needsContactPhoneNumber(contact: ContactDetails) {
  return hasSelectedAction(contact, "phone");
}

export function needsContactWhatsappNumber(contact: ContactDetails) {
  return (
    hasSelectedAction(contact, "whatsapp") &&
    (!hasSelectedAction(contact, "phone") || contact.whatsappMode === "other")
  );
}

export function needsContactWhatsappMode(contact: ContactDetails) {
  return (
    hasSelectedAction(contact, "phone") &&
    hasSelectedAction(contact, "whatsapp")
  );
}

export function hasContactLocationOption(
  contact: ContactDetails,
  option: ContactLocationOption,
) {
  return contact.locationOptions.includes(option);
}

export function getNextLocationOptions(
  currentOptions: ContactLocationOption[],
  option: ContactLocationOption,
  checked: boolean,
): ContactLocationOption[] {
  if (option === "none") return checked ? ["none"] : [];

  const withoutNone = currentOptions.filter((item) => item !== "none");
  return checked
    ? Array.from(new Set([...withoutNone, option]))
    : withoutNone.filter((item) => item !== option);
}

export function getContactFormCtaAction(
  contact: ContactDetails,
): ContactPrimaryAction {
  if (contact.formType === "message") return "message";
  if (contact.formType === "quote") return "quote";
  if (contact.formType === "appointment") return "appointment";
  if (contact.formType === "multiple") {
    if (contact.formOptions.includes("message")) return "message";
    if (contact.formOptions.includes("quote")) return "quote";
    if (contact.formOptions.includes("appointment")) return "appointment";
  }
  return "";
}

export function getContactPrimaryOptions(contact: ContactDetails) {
  const options: Array<{ id: ContactAction; title: string }> = [];

  if (contact.selectedActions.length) {
    return contactActionOptions
      .filter((option) => contact.selectedActions.includes(option.id))
      .map((option) => ({
        id: option.id,
        title: primaryActionLabels[option.id],
      }));
  }

  if (contact.formType === "multiple") {
    for (const option of requestTypeOptions) {
      if (!contact.formOptions.includes(option.id)) continue;

      options.push({
        id: option.id,
        title:
          option.id === "message" ? "Contact opnemen" : primaryActionLabels[option.id],
      });
    }
  } else {
    const formAction = getContactFormCtaAction(contact);

    if (formAction) {
      options.push({
        id: formAction,
        title: primaryActionLabels[formAction],
      });
    }
  }

  if (hasValidPhone(contact)) {
    options.push({ id: "phone", title: primaryActionLabels.phone });
  }

  if (hasValidWhatsapp(contact)) {
    options.push({ id: "whatsapp", title: primaryActionLabels.whatsapp });
  }

  return options;
}

export function getNormalizedPrimaryAction(contact: ContactDetails) {
  const options = getContactPrimaryOptions(contact);
  const formAction = getContactFormCtaAction(contact);

  if (options.some((option) => option.id === contact.primaryAction)) {
    return contact.primaryAction;
  }
  if (contact.formType === "multiple") {
    return "";
  }
  if (formAction && options.some((option) => option.id === formAction)) {
    return formAction;
  }
  if (contact.selectedActions.length === 1) return contact.selectedActions[0];

  return "";
}

export function getContactPrimaryCta(action: ContactPrimaryAction) {
  if (!action) return "Nog kiezen";

  return primaryActionLabels[action];
}

export function getContactPageLayout(contact: ContactDetails) {
  if (!contact.formType) return "Nog kiezen";
  if (contact.formType === "none") return "Geen formulier";
  if (contact.formType === "message") return "Contactformulier";
  if (contact.formType === "quote") return "Offerteformulier";
  if (contact.formType === "appointment") return "Afspraakformulier";

  const labels = contact.formOptions.map((option) => {
    if (option === "message") return "vraag";
    if (option === "quote") return "offerte";
    return "afspraak";
  });

  return labels.length ? `Formulier voor ${labels.join(", ")}` : "Nog kiezen";
}

export function getPublicAddressPrefill(
  contact: ContactDetails,
  company: CompanyDetails,
) {
  return contact.publicAddress.trim() || company.address.trim();
}

export function getContactDirectSummary(contact: ContactDetails) {
  const direct: string[] = [];

  if (hasSelectedAction(contact, "phone")) {
    direct.push(
      `telefoon: ${normalizePhoneNumber(contact.phoneNumber) || "nog invullen"}`,
    );
  }

  if (
    hasSelectedAction(contact, "whatsapp") &&
    hasSelectedAction(contact, "phone") &&
    contact.whatsappMode === "same"
  ) {
    direct.push("WhatsApp: zelfde nummer");
  } else if (hasSelectedAction(contact, "whatsapp")) {
    direct.push(
      `WhatsApp: ${normalizePhoneNumber(contact.whatsappNumber) || "nog invullen"}`,
    );
  }

  return direct.length ? direct.join(", ") : "Nog invullen";
}

export function getContactLocationSummary(contact: ContactDetails) {
  if (hasContactLocationOption(contact, "none")) return "Geen locatieblok";

  const parts: string[] = [];
  if (hasContactLocationOption(contact, "region")) {
    parts.push(contact.publicRegion.trim() || "plaats/regio");
  }
  if (hasContactLocationOption(contact, "address")) {
    parts.push(contact.publicAddress.trim() || "bezoekadres");
  }

  return parts.length ? parts.join(", ") : "Nog kiezen";
}

export function getContactAvailabilitySummary(contact: ContactDetails) {
  if (contact.availabilityMode === "fixed") {
    return contact.openingHours.trim() || "Vaste tijden";
  }
  if (contact.availabilityMode === "appointment_only") {
    return "Alleen op afspraak";
  }
  if (contact.availabilityMode === "none") return "Geen tijden";

  return "Nog kiezen";
}

export function getContactDetailsError(
  field: keyof ContactDetails,
  contact: ContactDetails,
) {
  if (field === "phoneNumber" && needsContactPhoneNumber(contact)) {
    return hasValidPhone(contact) ? "" : "Vul een geldig telefoonnummer in.";
  }

  if (field === "whatsappMode" && needsContactWhatsappMode(contact)) {
    return contact.whatsappMode ? "" : "Kies hoe we WhatsApp tonen.";
  }

  if (field === "whatsappNumber" && needsContactWhatsappNumber(contact)) {
    return hasValidWhatsapp(contact) ? "" : "Vul een geldig WhatsApp-nummer in.";
  }

  if (field === "locationOptions") {
    return contact.locationOptions.length ? "" : "Kies wat we over je locatie tonen.";
  }

  if (
    field === "publicRegion" &&
    hasContactLocationOption(contact, "region") &&
    !contact.publicRegion.trim()
  ) {
    return "Vul een plaats of regio in.";
  }

  if (
    field === "publicAddress" &&
    hasContactLocationOption(contact, "address") &&
    !contact.publicAddress.trim()
  ) {
    return "Vul het bezoekadres in.";
  }

  if (field === "availabilityMode") {
    return contact.availabilityMode ? "" : "Kies wat we over bereikbaarheid tonen.";
  }

  if (
    field === "openingHours" &&
    contact.availabilityMode === "fixed" &&
    !contact.openingHours.trim()
  ) {
    return "Vul de tijden of bereikbaarheid in.";
  }

  return "";
}

export function getFirstIncompleteContactDetailsSection(
  contact: ContactDetails,
): ContactDetailsSectionId | null {
  if (
    getContactDetailsError("phoneNumber", contact) ||
    getContactDetailsError("whatsappMode", contact) ||
    getContactDetailsError("whatsappNumber", contact)
  ) {
    return "direct";
  }

  if (
    getContactDetailsError("locationOptions", contact) ||
    getContactDetailsError("publicRegion", contact) ||
    getContactDetailsError("publicAddress", contact)
  ) {
    return "location";
  }

  if (
    getContactDetailsError("availabilityMode", contact) ||
    getContactDetailsError("openingHours", contact)
  ) {
    return "availability";
  }

  return null;
}

export function isContactDetailsComplete(contact: ContactDetails) {
  return getFirstIncompleteContactDetailsSection(contact) === null;
}

export function getContactError(
  field: keyof ContactDetails,
  contact: ContactDetails,
) {
  if (
    field === "selectedActions" &&
    !contact.formType &&
    contact.selectedActions.length < 1
  ) {
    return "Kies een optie.";
  }

  if (field === "formType" && !contact.formType) {
    return "";
  }

  if (
    field === "formOptions" &&
    contact.formType === "multiple" &&
    contact.selectedActions.length < 2
  ) {
    return "Kies minimaal twee opties.";
  }

  if (field === "phoneNumber") {
    return "";
  }

  if (field === "whatsappMode" && !contact.whatsappMode) {
    return "";
  }

  if (field === "whatsappNumber" && contact.whatsappMode === "other") {
    return "";
  }

  if (field === "locationOptions" && contact.locationOptions.length < 1) {
    return "";
  }

  if (
    field === "publicRegion" &&
    hasContactLocationOption(contact, "region") &&
    !contact.publicRegion.trim()
  ) {
    return "";
  }

  if (
    field === "publicAddress" &&
    hasContactLocationOption(contact, "address") &&
    !contact.publicAddress.trim()
  ) {
    return "";
  }

  if (field === "availabilityMode" && !contact.availabilityMode) {
    return "";
  }

  if (
    field === "openingHours" &&
    contact.availabilityMode === "fixed" &&
    !contact.openingHours.trim()
  ) {
    return "";
  }

  if (field === "primaryAction") {
    const options = getContactPrimaryOptions(contact);

    if (contact.formType === "none") {
      return "";
    }

    if (options.length > 0 && !contact.primaryAction) {
      return "Kies welke actie het belangrijkst is.";
    }

    if (
      contact.primaryAction &&
      !options.some((option) => option.id === contact.primaryAction)
    ) {
      return "Kies een knop uit de beschikbare opties.";
    }
  }

  return "";
}

export function getFirstIncompleteContactSection(
  contact: ContactDetails,
): ContactSectionId | null {
  if (getContactError("selectedActions", contact)) return "actions";

  if (getContactError("formOptions", contact)) return "actions";

  if (getContactError("primaryAction", contact)) return "actions";

  return null;
}

export function isContactComplete(contact: ContactDetails) {
  return getFirstIncompleteContactSection(contact) === null;
}
