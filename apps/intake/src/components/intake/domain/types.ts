export type IntakeChoice = "company" | "manual" | null;
export type IntakePhase =
  | "lookup"
  | "manual"
  | "confirm"
  | "content"
  | "contact"
  | "contactDetails"
  | "visualLogo"
  | "visualColors"
  | "visualStyle"
  | "finalDetails"
  | "success";
export type CompanySource = "kvk" | "manual" | null;
export type ContactPrimaryAction =
  | "message"
  | "appointment"
  | "quote"
  | "phone"
  | "whatsapp"
  | "";
export type ContactAction = Exclude<ContactPrimaryAction, "">;
export type ContactFormType =
  | "message"
  | "quote"
  | "appointment"
  | "multiple"
  | "none"
  | "";
export type ContactFormOption = "message" | "quote" | "appointment";
export type ContactWhatsappMode = "none" | "same" | "other" | "";
export type ContactLocationOption = "region" | "address" | "none";
export type ContactAvailabilityMode = "fixed" | "appointment_only" | "none" | "";
export type VisualLogoMode = "uploaded" | "textlogo" | "";
export type VisualColorSourceType = "logo" | "preset" | "custom" | "";
export type VisualColorPreset =
  | "blue"
  | "dark_blue"
  | "blue_green"
  | "green"
  | "purple_blue"
  | "red_bordeaux"
  | "gold_brown"
  | "anthracite";
export type VisualPaletteId = "palette_1" | "palette_2" | "palette_3" | "";
export type VisualShape = "straight" | "slightly_rounded" | "rounded" | "";
export type VisualTypography = "clear" | "soft" | "classic" | "strong" | "";
export type ContentCardId =
  | "intro"
  | "offer"
  | "customers"
  | "approach"
  | "workArea"
  | "notes";
export type WorkMode =
  | "on_location"
  | "at_business"
  | "remote"
  | "fixed_region"
  | "nationwide";

export type CompanyActivity = {
  description: string;
  isMain: boolean;
};

export type CompanyDetails = {
  source: CompanySource;
  companyName: string;
  kvkNumber: string;
  address: string;
  website: string;
  mainActivity: string;
  secondaryActivities: string[];
};

export type ManualCompanyDetails = Pick<
  CompanyDetails,
  "companyName" | "kvkNumber" | "address"
>;

export type OfferItem = {
  value: string;
};

export type BusinessContentDetails = {
  intro: string;
  offers: OfferItem[];
  audience: string;
  situation: string;
  approach: string;
  workModes: WorkMode[];
  region: string;
  notes: string;
};

export type ContactDetails = {
  selectedActions: ContactAction[];
  formType: ContactFormType;
  formOptions: ContactFormOption[];
  primaryAction: ContactPrimaryAction;
  phoneNumber: string;
  whatsappMode: ContactWhatsappMode;
  whatsappNumber: string;
  locationOptions: ContactLocationOption[];
  publicRegion: string;
  publicAddress: string;
  availabilityMode: ContactAvailabilityMode;
  openingHours: string;
};

export type VisualThemeTokens = {
  background: string;
  foreground: string;
  card: string;
  cardForeground: string;
  primary: string;
  primaryForeground: string;
  secondary: string;
  secondaryForeground: string;
  muted: string;
  mutedForeground: string;
  accent: string;
  accentForeground: string;
  border: string;
  input: string;
  ring: string;
  destructive: string;
  destructiveForeground: string;
};

export type VisualPaletteChecks = {
  textContrastPass: boolean;
  uiContrastPass: boolean;
  aestheticSafetyPass: boolean;
  repaired: boolean;
};

export type VisualPalette = {
  id: Exclude<VisualPaletteId, "">;
  label: string;
  recommended?: boolean;
  swatches: string[];
  tokens: VisualThemeTokens;
  materialVariant?: string;
  contrastLevel?: number;
  normalizedSourceColor?: string;
  checks?: VisualPaletteChecks;
};

export type VisualDetails = {
  logo: {
    mode: VisualLogoMode;
    file: File | null;
    text: string;
  };
  color: {
    sourceType: VisualColorSourceType;
    sourceValue: string;
    selectedPalette: VisualPaletteId;
    tokens: VisualThemeTokens;
  };
  shape: VisualShape;
  typography: VisualTypography;
};

export type FinalDetails = {
  name: string;
  email: string;
  phone: string;
};

export type IntakeLegalDetails = {
  businessUseAccepted: boolean;
  marketingOptIn: boolean;
};

export type IntakeFormValues = {
  company: CompanyDetails;
  content: BusinessContentDetails;
  contact: ContactDetails;
  visual: VisualDetails;
  finalDetails: FinalDetails;
  legal: IntakeLegalDetails;
};

export type KvkSearchResult = {
  id: string;
  kvkNumber: string;
  branchNumber: string | null;
  name: string;
  city: string | null;
  type: string | null;
};

export type KvkSearchResponse = {
  total: number;
  results: KvkSearchResult[];
};

export type KvkAddress = {
  type: string | null;
  value: string | null;
  city: string | null;
  shielded: boolean;
};

export type KvkActivity = {
  code: string | null;
  description: string;
  isMain: boolean;
};

export type KvkCompanyProfile = {
  kvkNumber: string;
  branchNumber: string | null;
  name: string;
  tradeNames: string[];
  addresses: KvkAddress[];
  websites: string[];
  activities: KvkActivity[];
};

export type ConfirmationFieldKey =
  | "name"
  | "kvkNumber"
  | "address"
  | "website"
  | "mainActivity"
  | `activity:${number}`;

export type ConfirmationField = {
  key: ConfirmationFieldKey;
  label: string;
  value: string;
  editable: boolean;
  deletable?: boolean;
  helper?: string;
};
