import { isValidPublicPhoneNumber } from "./contact-rules";
import type { FinalDetails } from "./types";

export type FinalDetailsField = keyof FinalDetails;

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

export function getFinalDetailsError(
  field: FinalDetailsField,
  details: FinalDetails,
) {
  if (field === "name" && details.name.trim().length < 2) {
    return "Vul je naam in.";
  }

  if (field === "email") {
    if (!details.email.trim()) return "Vul je e-mailadres in.";
    if (!isValidEmail(details.email)) return "Vul een geldig e-mailadres in.";
  }

  if (
    field === "phone" &&
    details.phone.trim() &&
    !isValidPublicPhoneNumber(details.phone)
  ) {
    return "Vul een geldig telefoonnummer in.";
  }

  return "";
}

export function getFirstIncompleteFinalDetailsField(
  details: FinalDetails,
): FinalDetailsField | null {
  if (getFinalDetailsError("name", details)) return "name";
  if (getFinalDetailsError("email", details)) return "email";
  if (getFinalDetailsError("phone", details)) return "phone";

  return null;
}

export function isFinalDetailsComplete(details: FinalDetails) {
  return getFirstIncompleteFinalDetailsField(details) === null;
}
