import type {
  ContactDetails,
  VisualColorPreset,
  VisualColorSourceType,
  VisualDetails,
  VisualShape,
  VisualTypography,
} from "./types";
import { getContactPrimaryCta } from "./contact-rules";
import {
  getPaletteById as getGeneratedPaletteById,
  isValidHexColor as isValidVisualHexColor,
} from "./color-system";
export {
  contrastRatio,
  extractLogoBrandColors,
  generatePaletteGenerationResult,
  generateVisualPalettes,
  getPaletteById,
  getSafeSourceColor,
  isValidHexColor,
  normalizeHexColor,
  paletteGenerationVersion,
  validateVisualThemeTokens,
} from "./color-system";

export type VisualStepId = "logo" | "colors" | "style";

export const visualColorPresets: Array<{
  id: Exclude<VisualColorSourceType, "logo" | "">;
  preset?: VisualColorPreset;
  label: string;
  value: string;
}> = [
  { id: "preset", preset: "blue", label: "Blauw", value: "#315da8" },
  {
    id: "preset",
    preset: "dark_blue",
    label: "Donkerblauw",
    value: "#254f6f",
  },
  {
    id: "preset",
    preset: "blue_green",
    label: "Blauwgroen",
    value: "#1c7a80",
  },
  { id: "preset", preset: "green", label: "Groen", value: "#274a34" },
  {
    id: "preset",
    preset: "purple_blue",
    label: "Paarsblauw",
    value: "#3c438c",
  },
  {
    id: "preset",
    preset: "red_bordeaux",
    label: "Rood / bordeaux",
    value: "#7c1d3b",
  },
  {
    id: "preset",
    preset: "gold_brown",
    label: "Goudbruin",
    value: "#806f2a",
  },
  {
    id: "preset",
    preset: "anthracite",
    label: "Antraciet",
    value: "#303234",
  },
];

export const visualShapeOptions: Array<{
  id: Exclude<VisualShape, "">;
  title: string;
  description: string;
}> = [
  { id: "straight", title: "Recht", description: "Strak en direct." },
  {
    id: "slightly_rounded",
    title: "Licht afgerond",
    description: "Modern en rustig.",
  },
  { id: "rounded", title: "Rond", description: "Zachter en vriendelijker." },
];

export const visualTypographyOptions: Array<{
  id: Exclude<VisualTypography, "">;
  title: string;
}> = [
  { id: "clear", title: "Helder" },
  { id: "soft", title: "Vriendelijk" },
  { id: "classic", title: "Verfijnd" },
  { id: "strong", title: "Stevig" },
];

export function isValidLogoFile(file: File | null) {
  if (!file) return false;

  const name = file.name.toLowerCase();
  const type = file.type.toLowerCase();
  return (
    ["image/svg+xml", "image/png", "image/jpeg"].includes(type) ||
    name.endsWith(".svg") ||
    name.endsWith(".png") ||
    name.endsWith(".jpg") ||
    name.endsWith(".jpeg")
  );
}

export function getVisualLogoError(
  field: "mode" | "file" | "text",
  visual: VisualDetails,
) {
  if (field === "mode") {
    return visual.logo.mode ? "" : "Kies welk logo we gebruiken.";
  }

  if (field === "file" && visual.logo.mode === "uploaded") {
    return isValidLogoFile(visual.logo.file)
      ? ""
      : "Upload een SVG, PNG of JPG.";
  }

  if (field === "text" && visual.logo.mode === "textlogo") {
    return visual.logo.text.trim() ? "" : "Vul de tekst voor je logo in.";
  }

  return "";
}

export function isVisualLogoComplete(visual: VisualDetails) {
  return (
    !getVisualLogoError("mode", visual) &&
    !getVisualLogoError("file", visual) &&
    !getVisualLogoError("text", visual)
  );
}

export function getVisualColorError(
  field: "source" | "palette",
  visual: VisualDetails,
) {
  if (field === "source") {
    return visual.color.sourceType && isValidVisualHexColor(visual.color.sourceValue)
      ? ""
      : "Kies een hoofdkleur.";
  }

  if (field === "palette") {
    return getGeneratedPaletteById(
      visual.color.sourceValue,
      visual.color.selectedPalette,
    )
      ? ""
      : "Kies een kleurenpalet.";
  }

  return "";
}

export function isVisualColorComplete(visual: VisualDetails) {
  return (
    !getVisualColorError("source", visual) &&
    !getVisualColorError("palette", visual)
  );
}

export function getVisualStyleError(
  field: "shape" | "typography",
  visual: VisualDetails,
) {
  if (field === "shape") return visual.shape ? "" : "Kies de vorm van hoeken.";
  if (field === "typography")
    return visual.typography ? "" : "Kies een letterstijl.";

  return "";
}

export function isVisualStyleComplete(visual: VisualDetails) {
  return (
    !getVisualStyleError("shape", visual) &&
    !getVisualStyleError("typography", visual)
  );
}

export function getVisualPrimaryCta(contact: ContactDetails) {
  const label = getContactPrimaryCta(contact.primaryAction);
  return label === "Nog kiezen" ? "Offerte aanvragen" : label;
}
