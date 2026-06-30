import type { IntakePhase } from "./model";

export type IntakeStepMeta = {
  heading: string;
  subtitle: string;
  progress: number | null;
};

export const intakeStepMeta: Record<IntakePhase, IntakeStepMeta> = {
  lookup: {
    heading: "Voor welk bedrijf maken we de website?",
    subtitle: "Zoek je bedrijf op via KVK of vul de gegevens zelf in.",
    progress: null,
  },
  manual: {
    heading: "Vul je bedrijfsgegevens in",
    subtitle:
      "Geef de basisgegevens door die we nodig hebben om je aanvraag te starten.",
    progress: 1,
  },
  confirm: {
    heading: "Klopt dit bedrijf?",
    subtitle: "Controleer de gevonden gegevens voordat je verdergaat.",
    progress: 1,
  },
  content: {
    heading: "Vertel over je bedrijf",
    subtitle: "Wat doe je en voor wie ben je er?",
    progress: 2,
  },
  contact: {
    heading: "Contact en aanvragen",
    subtitle:
      "Stel in hoe bezoekers contact kunnen opnemen of een aanvraag kunnen doen.",
    progress: 3,
  },
  contactDetails: {
    heading: "Contactgegevens",
    subtitle: "Vul de gegevens in die bezoekers op je website mogen gebruiken.",
    progress: 3,
  },
  visualLogo: {
    heading: "Logo",
    subtitle: "Upload je logo of gebruik je bedrijfsnaam als tekstlogo.",
    progress: 4,
  },
  visualColors: {
    heading: "Kleuren",
    subtitle: "Kies het kleurenpalet voor je website.",
    progress: 5,
  },
  visualStyle: {
    heading: "Knoppen en letters",
    subtitle: "Kies hoe knoppen, formulieren en tekst eruitzien.",
    progress: 6,
  },
  finalDetails: {
    heading: "Je gegevens",
    subtitle: "Laat weten hoe we je kunnen bereiken over je aanvraag.",
    progress: 7,
  },
  success: {
    heading: "Aanvraag ontvangen",
    subtitle: "Je ontvangt binnen 24 uur een eerste voorstel.",
    progress: null,
  },
};
