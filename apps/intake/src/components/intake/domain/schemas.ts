import { z } from "zod";

import { contentLimits } from "./constants";
import { getContactError } from "./contact-rules";
import { needsWorkAreaRegion } from "./content-rules";
import { getFinalDetailsError } from "./final-details-rules";
import {
  getVisualColorError,
  getVisualLogoError,
  getVisualStyleError,
} from "./visual-rules";

export const editFieldSchema = z.object({
  value: z.string().trim().min(1, "Vul een waarde in."),
});

export const manualCompanySchema = z.object({
  companyName: z.string().trim().min(2, "Vul je bedrijfsnaam in."),
  kvkNumber: z
    .string()
    .trim()
    .refine(
      (value) => !value || /^\d{8}$/.test(value),
      "Een KVK-nummer bestaat uit 8 cijfers.",
    ),
  address: z.string().trim(),
});

export const companySchema = manualCompanySchema.extend({
  source: z.enum(["kvk", "manual"]).nullable(),
  website: z.string().trim(),
  mainActivity: z.string().trim(),
  secondaryActivities: z.array(z.string().trim()),
});

const workModeSchema = z.enum([
  "on_location",
  "at_business",
  "remote",
  "fixed_region",
  "nationwide",
]);
const offerItemSchema = z.object({
  value: z.string().trim().max(contentLimits.offer.max, "Houd dit kort."),
});
const contactPrimaryActionSchema = z.enum([
  "message",
  "appointment",
  "quote",
  "phone",
  "whatsapp",
  "",
]);
const contactActionSchema = z.enum([
  "message",
  "appointment",
  "quote",
  "phone",
  "whatsapp",
]);
const contactFormTypeSchema = z.enum([
  "message",
  "quote",
  "appointment",
  "multiple",
  "none",
  "",
]);
const contactFormOptionSchema = z.enum([
  "message",
  "appointment",
  "quote",
]);
const contactWhatsappModeSchema = z.enum(["none", "same", "other", ""]);
const contactLocationOptionSchema = z.enum(["region", "address", "none"]);
const contactAvailabilityModeSchema = z.enum([
  "fixed",
  "appointment_only",
  "none",
  "",
]);
const visualLogoModeSchema = z.enum(["uploaded", "textlogo", ""]);
const visualColorSourceTypeSchema = z.enum(["logo", "preset", "custom", ""]);
const visualPaletteSchema = z.enum([
  "palette_1",
  "palette_2",
  "palette_3",
  "",
]);
const visualShapeSchema = z.enum([
  "straight",
  "slightly_rounded",
  "rounded",
  "",
]);
const visualTypographySchema = z.enum([
  "clear",
  "soft",
  "classic",
  "strong",
  "",
]);
const visualThemeTokensSchema = z.object({
  background: z.string(),
  foreground: z.string(),
  card: z.string(),
  cardForeground: z.string(),
  primary: z.string(),
  primaryForeground: z.string(),
  secondary: z.string(),
  secondaryForeground: z.string(),
  muted: z.string(),
  mutedForeground: z.string(),
  accent: z.string(),
  accentForeground: z.string(),
  border: z.string(),
  input: z.string(),
  ring: z.string(),
  destructive: z.string(),
  destructiveForeground: z.string(),
});

export const businessContentSchema = z
  .object({
    intro: z
      .string()
      .trim()
      .min(contentLimits.intro.min, "Noem kort wat je doet en voor wie.")
      .max(contentLimits.intro.max, "Maak je antwoord korter."),
    offers: z.array(offerItemSchema).min(1).max(6),
    audience: z
      .string()
      .trim()
      .min(
        contentLimits.audience.min,
        "Noem de belangrijkste klantgroep of situatie.",
      )
      .max(contentLimits.audience.max, "Maak je antwoord korter."),
    situation: z
      .string()
      .trim()
      .min(contentLimits.situation.min, "Beschrijf één concrete situatie.")
      .max(contentLimits.situation.max, "Maak je antwoord korter."),
    approach: z
      .string()
      .trim()
      .min(
        contentLimits.approach.min,
        "Noem kort wat klanten kunnen verwachten.",
      )
      .max(contentLimits.approach.max, "Maak je antwoord korter."),
    workModes: z.array(workModeSchema).min(1, "Kies minimaal één optie."),
    region: z.string().trim(),
    notes: z
      .string()
      .trim()
      .max(contentLimits.notes.max, "Maak je antwoord korter."),
  })
  .superRefine((value, context) => {
    if (
      value.offers.filter(
        (offer) => offer.value.trim().length >= contentLimits.offer.min,
      ).length < 1
    ) {
      context.addIssue({
        code: "custom",
        path: ["offers"],
        message: "Noem minimaal één belangrijk aanbod.",
      });
    }

    if (
      needsWorkAreaRegion(value.workModes) &&
      value.region.trim().length < 2
    ) {
      context.addIssue({
        code: "custom",
        path: ["region"],
        message: "Vul in waar je wilt werken.",
      });
    }
  });

export const contactSchema = z
  .object({
    selectedActions: z.array(contactActionSchema),
    formType: contactFormTypeSchema,
    formOptions: z.array(contactFormOptionSchema),
    primaryAction: contactPrimaryActionSchema,
    phoneNumber: z.string().trim(),
    whatsappMode: contactWhatsappModeSchema,
    whatsappNumber: z.string().trim(),
    locationOptions: z.array(contactLocationOptionSchema),
    publicRegion: z.string().trim(),
    publicAddress: z.string().trim(),
    availabilityMode: contactAvailabilityModeSchema,
    openingHours: z.string().trim(),
  })
  .superRefine((value, context) => {
    const addIssue = (path: keyof typeof value, message: string) => {
      context.addIssue({
        code: "custom",
        path: [path],
        message,
      });
    };

    const selectedActionsError = getContactError("selectedActions", value);
    if (selectedActionsError) addIssue("selectedActions", selectedActionsError);

    const formTypeError = getContactError("formType", value);
    if (formTypeError) addIssue("formType", formTypeError);

    const formOptionsError = getContactError("formOptions", value);
    if (formOptionsError) addIssue("formOptions", formOptionsError);

    const phoneError = getContactError("phoneNumber", value);
    if (phoneError) addIssue("phoneNumber", phoneError);

    const whatsappModeError = getContactError("whatsappMode", value);
    if (whatsappModeError) addIssue("whatsappMode", whatsappModeError);

    const whatsappError = getContactError("whatsappNumber", value);
    if (whatsappError) addIssue("whatsappNumber", whatsappError);

    const locationOptionsError = getContactError("locationOptions", value);
    if (locationOptionsError) addIssue("locationOptions", locationOptionsError);

    const regionError = getContactError("publicRegion", value);
    if (regionError) addIssue("publicRegion", regionError);

    const addressError = getContactError("publicAddress", value);
    if (addressError) addIssue("publicAddress", addressError);

    const availabilityModeError = getContactError("availabilityMode", value);
    if (availabilityModeError) {
      addIssue("availabilityMode", availabilityModeError);
    }

    const openingHoursError = getContactError("openingHours", value);
    if (openingHoursError) addIssue("openingHours", openingHoursError);

    const primaryActionError = getContactError("primaryAction", value);
    if (primaryActionError) addIssue("primaryAction", primaryActionError);
  });

export const visualSchema = z
  .object({
    logo: z.object({
      mode: visualLogoModeSchema,
      file: z.any().nullable(),
      text: z.string().trim(),
    }),
    color: z.object({
      sourceType: visualColorSourceTypeSchema,
      sourceValue: z.string().trim(),
      selectedPalette: visualPaletteSchema,
      tokens: visualThemeTokensSchema,
    }),
    shape: visualShapeSchema,
    typography: visualTypographySchema,
  })
  .superRefine((value, context) => {
    const addIssue = (path: Array<string>, message: string) => {
      context.addIssue({
        code: "custom",
        path,
        message,
      });
    };

    const logoModeError = getVisualLogoError("mode", value);
    if (logoModeError) addIssue(["logo", "mode"], logoModeError);

    const logoFileError = getVisualLogoError("file", value);
    if (logoFileError) addIssue(["logo", "file"], logoFileError);

    const logoTextError = getVisualLogoError("text", value);
    if (logoTextError) addIssue(["logo", "text"], logoTextError);

    const sourceError = getVisualColorError("source", value);
    if (sourceError) addIssue(["color", "sourceValue"], sourceError);

    const paletteError = getVisualColorError("palette", value);
    if (paletteError) addIssue(["color", "selectedPalette"], paletteError);

    const shapeError = getVisualStyleError("shape", value);
    if (shapeError) addIssue(["shape"], shapeError);

    const typographyError = getVisualStyleError("typography", value);
    if (typographyError) addIssue(["typography"], typographyError);
  });

export const finalDetailsSchema = z
  .object({
    name: z.string().trim(),
    email: z.string().trim(),
    phone: z.string().trim(),
  })
  .superRefine((value, context) => {
    const addIssue = (path: keyof typeof value, message: string) => {
      context.addIssue({
        code: "custom",
        path: [path],
        message,
      });
    };

    const nameError = getFinalDetailsError("name", value);
    if (nameError) addIssue("name", nameError);

    const emailError = getFinalDetailsError("email", value);
    if (emailError) addIssue("email", emailError);

    const phoneError = getFinalDetailsError("phone", value);
    if (phoneError) addIssue("phone", phoneError);
  });

export const intakeFormSchema = z.object({
  company: companySchema,
  content: businessContentSchema,
  contact: contactSchema,
  visual: visualSchema,
  finalDetails: finalDetailsSchema,
});

export type EditFieldValues = z.infer<typeof editFieldSchema>;
export type ManualCompanyFormValues = z.infer<typeof manualCompanySchema>;
