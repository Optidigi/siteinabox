import { CalendarDays } from "lucide-react"
import type { UploadFieldSingleValidation } from "payload"
import {
  APPOINTMENT_PRESENTATIONS,
  APPOINTMENT_VARIANTS,
  DEFAULT_APPOINTMENT_PRESENTATION,
  DEFAULT_APPOINTMENT_VARIANT,
} from "@siteinabox/contracts"
import { blockBaseFields } from "./baseFields"
import { truncate, type BlockWithMeta } from "./_summary"
import { backgroundModeField, imageField } from "./ownedFields"
import { adminValidationText } from "@/lib/payloadAdminI18n"
import { asRecord } from "@/lib/record"

const hasMediaReference = (value: unknown): boolean => {
  if (typeof value === "string") return value.trim().length > 0
  if (typeof value === "number") return Number.isInteger(value) && value > 0
  if (!value || typeof value !== "object" || Array.isArray(value) || !("id" in value)) return false
  const id = (value as { id?: unknown }).id
  return (typeof id === "string" && id.trim().length > 0) || (typeof id === "number" && Number.isInteger(id) && id > 0)
}

const validateAppointmentImage: UploadFieldSingleValidation = (value, { siblingData, req }) => {
  if (asRecord(siblingData)?.backgroundMode === "image" && !hasMediaReference(value)) {
    return adminValidationText(req?.i18n?.language, "An image background requires a supplied image.", "Een afbeeldingsachtergrond vereist een aangeleverde afbeelding.")
  }
  return true
}

const appointmentVariantOptions = APPOINTMENT_VARIANTS.map((value) => ({
  label: "Appointments 01 — calendar booking",
  value,
}))

const appointmentPresentationOptions = APPOINTMENT_PRESENTATIONS.map((value) => ({
  label: value === "dialog" ? "Dialog — open from a compact CTA" : "Inline — show the booking flow in the section",
  value,
}))

export const Appointments: BlockWithMeta = {
  slug: "appointments",
  icon: CalendarDays,
  description: "Let visitors choose an available appointment time.",
  interfaceName: "AppointmentSection",
  fields: [
    {
      name: "variant",
      type: "select",
      required: true,
      defaultValue: DEFAULT_APPOINTMENT_VARIANT,
      options: appointmentVariantOptions,
      admin: { description: "Choose the approved first-party appointment section design." },
    },
    {
      name: "presentation",
      type: "select",
      required: true,
      defaultValue: DEFAULT_APPOINTMENT_PRESENTATION,
      options: appointmentPresentationOptions,
      admin: { description: "Use a compact launcher or show the same booking flow inline." },
    },
    backgroundModeField("none"),
    imageField("image", "Optional supplied image used for the image-led default or image effect.", false, validateAppointmentImage),
    { name: "heading", type: "text", required: true },
    { name: "body", type: "textarea" },
    { name: "availabilityLabel", type: "text", required: true, defaultValue: "Beschikbaarheid" },
    { name: "bookingLabel", type: "text", required: true, defaultValue: "Afspraak aanvragen" },
    { name: "confirmationHeading", type: "text", required: true, defaultValue: "Afspraak bevestigd" },
    { name: "confirmationBody", type: "textarea" },
    { name: "privacyNote", type: "textarea", admin: { description: "Optional factual note about the details needed to request an appointment." } },
    ...blockBaseFields("appointments"),
  ],
  summary: (value) => typeof value.heading === "string" ? truncate(value.heading.trim(), 40) : undefined,
}
