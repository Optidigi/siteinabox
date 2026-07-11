import type {
  BusinessContentDetails,
  ContactDetails,
  FinalDetails,
  IntakeFormValues,
  IntakeLegalDetails,
  VisualThemeTokens,
  VisualDetails,
} from "./types";

export const contentLimits = {
  intro: { min: 20, max: 500 },
  offer: { min: 3, max: 60 },
  audience: { min: 8, max: 240 },
  situation: { min: 20, max: 360 },
  approach: { min: 20, max: 400 },
  region: { min: 2 },
  notes: { max: 500 },
} as const;

export const defaultContentDetails: BusinessContentDetails = {
  intro: "",
  offers: [{ value: "" }],
  audience: "",
  situation: "",
  approach: "",
  workModes: [],
  region: "",
  notes: "",
};

export const defaultContactDetails: ContactDetails = {
  selectedActions: [],
  formType: "",
  formOptions: [],
  primaryAction: "",
  phoneNumber: "",
  whatsappMode: "",
  whatsappNumber: "",
  locationOptions: [],
  publicRegion: "",
  publicAddress: "",
  availabilityMode: "",
  openingHours: "",
};

export const defaultVisualTokens: VisualThemeTokens = {
  background: "#fbfaf6",
  foreground: "#232323",
  card: "#ffffff",
  cardForeground: "#232323",
  primary: "#274a34",
  primaryForeground: "#ffffff",
  secondary: "#e7efe4",
  secondaryForeground: "#274a34",
  muted: "#f4f4f1",
  mutedForeground: "#6f6f6f",
  accent: "#ccf88e",
  accentForeground: "#274a34",
  border: "#d9d9d6",
  input: "#b7b7b6",
  ring: "#8ca88f",
  destructive: "#ba1a1a",
  destructiveForeground: "#ffffff",
};

export const defaultVisualDetails: VisualDetails = {
  logo: {
    mode: "",
    file: null,
    text: "",
  },
  color: {
    sourceType: "preset",
    sourceValue: "#274a34",
    selectedPalette: "palette_1",
    tokens: defaultVisualTokens,
  },
  shape: "slightly_rounded",
  typography: "clear",
};

export const defaultFinalDetails: FinalDetails = {
  name: "",
  email: "",
  phone: "",
};

export const intakeLegalStatements = {
  businessUse: {
    version: "business-use-2026-07-07.1",
    text: "Ik vraag dit aan voor een onderneming of bedrijf in oprichting.",
  },
  marketing: {
    version: "marketing-opt-in-2026-07-07.1",
    text: "Stuur mij tips, updates en aanbiedingen over Site in a Box.",
  },
  privacyNotice: {
    documentVersion: "2026-07-07.1",
    url: "https://www.siteinabox.nl/privacy-en-cookieverklaring",
  },
} as const;

export const defaultIntakeLegalDetails: IntakeLegalDetails = {
  businessUseAccepted: false,
  marketingOptIn: false,
};

export const defaultIntakeValues: IntakeFormValues = {
  company: {
    source: null,
    companyName: "",
    kvkNumber: "",
    address: "",
    website: "",
    mainActivity: "",
    secondaryActivities: [],
  },
  content: defaultContentDetails,
  contact: defaultContactDetails,
  visual: defaultVisualDetails,
  finalDetails: defaultFinalDetails,
  legal: defaultIntakeLegalDetails,
};

export const contentFormId = "business-content-form";
export const manualCompanyFormId = "manual-company-details-form";
export const totalWizardSteps = 7;
