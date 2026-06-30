import {
  argbFromHex,
  argbFromRgb,
  blueFromArgb,
  greenFromArgb,
  Hct,
  hexFromArgb,
  MaterialDynamicColors,
  QuantizerCelebi,
  redFromArgb,
  SchemeContent,
  SchemeFidelity,
  SchemeNeutral,
  SchemeTonalSpot,
  Score,
} from "@material/material-color-utilities";
import type {
  DynamicColor,
  DynamicScheme,
} from "@material/material-color-utilities";

import type {
  VisualPalette,
  VisualPaletteChecks,
  VisualPaletteId,
  VisualThemeTokens,
} from "./types";

export const paletteGenerationVersion = "siab-material-v2";

type PaletteArchetype = "source_primary" | "neutral_brand" | "related_primary";

type PaletteCandidate = {
  variant: string;
  archetype: PaletteArchetype;
  contrastLevel: number;
  sourceHct: Hct;
  tokens: VisualThemeTokens;
  checks: VisualPaletteChecks;
  score: number;
};

type SchemeConstructor = new (
  sourceColorHct: Hct,
  isDark: boolean,
  contrastLevel: number,
) => DynamicScheme;

export type ColorSource =
  | { type: "logo"; fileId: string; file: File }
  | {
      type: "preset";
      preset:
        | "blue"
        | "dark_blue"
        | "blue_green"
        | "green"
        | "purple_blue"
        | "red_bordeaux"
        | "gold_brown"
        | "anthracite";
    }
  | { type: "custom"; value: string };

export type PaletteGenerationResult = {
  generationVersion: string;
  source: { type: "color"; value: string };
  normalizedSourceColor: string;
  candidatesGenerated: number;
  palettes: VisualPalette[];
  selectedPaletteId: "palette_1" | "palette_2" | "palette_3";
};

const fallbackSource = "#274a34";
const neutralSource = "#303234";
const nearBlack = "#232323";
const nearWhite = "#ffffff";
const normalTextContrast = 4.8;
const uiContrast = 3.2;

const materialToken = (scheme: DynamicScheme, color: DynamicColor) =>
  hexFromArgb(color.getArgb(scheme)).toLowerCase();

export function normalizeHexColor(value: string) {
  const trimmed = value.trim();
  const shortMatch = trimmed.match(/^#?([0-9a-f]{3})$/i);
  if (shortMatch) {
    return `#${shortMatch[1]
      .split("")
      .map((char) => `${char}${char}`)
      .join("")}`.toLowerCase();
  }

  const longMatch = trimmed.match(/^#?([0-9a-f]{6})$/i);
  if (!longMatch) return "";

  return `#${longMatch[1]}`.toLowerCase();
}

export function isValidHexColor(value: string) {
  return Boolean(normalizeHexColor(value));
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function hueInRange(hue: number, start: number, end: number) {
  if (start <= end) return hue >= start && hue < end;
  return hue >= start || hue < end;
}

function hueDistance(a: number, b: number) {
  const distance = Math.abs(a - b) % 360;
  return Math.min(distance, 360 - distance);
}

function hexFromHct(hue: number, chroma: number, tone: number) {
  return hexFromArgb(Hct.from(hue, chroma, tone).toInt()).toLowerCase();
}

function colorHct(hex: string) {
  return Hct.fromInt(argbFromHex(hex));
}

function safePrimaryChroma(hue: number, chroma: number) {
  if (hueInRange(hue, 96, 154)) return clamp(chroma, 18, 24);
  if (hueInRange(hue, 44, 96)) return clamp(chroma, 18, 38);
  if (hueInRange(hue, 348, 34)) return clamp(chroma, 18, 46);
  if (hueInRange(hue, 320, 348)) return clamp(chroma, 18, 38);

  return clamp(chroma, 20, 44);
}

function safePrimaryFromHct(hct: Hct, tone = 34) {
  return hexFromHct(hct.hue, safePrimaryChroma(hct.hue, hct.chroma), tone);
}

function safeToneForSource(tone: number) {
  if (tone > 82) return 42;
  if (tone < 20) return 28;
  return clamp(tone, 28, 42);
}

export function getSafeSourceColor(value: string) {
  const normalized = normalizeHexColor(value);
  if (!normalized) return "";

  const hct = colorHct(normalized);
  const hue = hct.hue;

  if (hct.chroma < 8) return neutralSource;

  if (hueInRange(hue, 96, 124)) return hexFromHct(92, 32, 42);
  if (hueInRange(hue, 124, 154)) return hexFromHct(132, 30, 38);
  if (hueInRange(hue, 44, 96)) return hexFromHct(58, 36, 38);
  if (hueInRange(hue, 348, 34)) return hexFromHct(5, 48, 30);
  if (hueInRange(hue, 320, 348)) return hexFromHct(355, 38, 34);

  return hexFromHct(
    hue,
    clamp(hct.chroma, 16, 48),
    safeToneForSource(hct.tone),
  );
}

function relativeLuminance(hexValue: string) {
  const argb = argbFromHex(normalizeHexColor(hexValue) || nearBlack);
  const values = [redFromArgb(argb), greenFromArgb(argb), blueFromArgb(argb)].map(
    (channel) => {
      const normalized = channel / 255;
      return normalized <= 0.03928
        ? normalized / 12.92
        : ((normalized + 0.055) / 1.055) ** 2.4;
    },
  );

  return values[0] * 0.2126 + values[1] * 0.7152 + values[2] * 0.0722;
}

export function contrastRatio(colorA: string, colorB: string) {
  const a = relativeLuminance(colorA);
  const b = relativeLuminance(colorB);
  const lighter = Math.max(a, b);
  const darker = Math.min(a, b);

  return (lighter + 0.05) / (darker + 0.05);
}

function readableForeground(background: string) {
  return contrastRatio(background, nearWhite) >=
    contrastRatio(background, nearBlack)
    ? nearWhite
    : nearBlack;
}

function ensureTextPair(foreground: string, background: string) {
  if (contrastRatio(foreground, background) >= normalTextContrast) {
    return foreground;
  }

  return readableForeground(background);
}

function boundaryCandidates(color: string, preferredHue: number) {
  return [
    color,
    hexFromHct(preferredHue, 8, 60),
    hexFromHct(preferredHue, 6, 54),
    "#8b8b85",
    "#73736f",
  ];
}

function ensureBoundary(
  color: string,
  backgrounds: string[],
  preferredHue: number,
) {
  return (
    boundaryCandidates(color, preferredHue).find((candidate) =>
      backgrounds.every(
        (background) => contrastRatio(candidate, background) >= uiContrast,
      ),
    ) ?? "#73736f"
  );
}

function isUnsafePrimary(hex: string) {
  const hct = colorHct(hex);
  const hue = hct.hue;

  if (hct.tone > 58 && hct.chroma > 42) return true;
  if (hueInRange(hue, 96, 154) && hct.chroma > 26) return true;
  if (hueInRange(hue, 348, 34) && hct.chroma > 68) return true;
  if (hueInRange(hue, 320, 348) && hct.chroma > 46) return true;

  return false;
}

function repairPrimary(primary: string, normalizedSource: string) {
  if (!isUnsafePrimary(primary)) return primary;

  const source = colorHct(normalizedSource);
  return safePrimaryFromHct(source, clamp(source.tone, 28, 36));
}

function brandSignalHct(sourceValue: string, normalizedSource: string) {
  const source = colorHct(normalizeHexColor(sourceValue) || normalizedSource);

  if (source.chroma < 8 || source.tone > 96 || source.tone < 8) {
    return colorHct(normalizedSource);
  }

  return source;
}

function relatedHueFor(sourceHct: Hct) {
  const hue = sourceHct.hue;

  if (hueInRange(hue, 348, 96)) return (hue + 150) % 360;
  if (hueInRange(hue, 96, 178)) return (hue + 92) % 360;
  if (hueInRange(hue, 178, 260)) return (hue - 58 + 360) % 360;
  if (hueInRange(hue, 260, 330)) return (hue - 92 + 360) % 360;

  return (hue + 72) % 360;
}

function softSurfaceFrom(hct: Hct, tone: number, maxChroma: number) {
  return hexFromHct(hct.hue, clamp(hct.chroma, 8, maxChroma), tone);
}

function lightBackgroundFrom(hue: number) {
  return hexFromHct(hue, 4, 98);
}

function neutralPrimaryFor(sourceHct: Hct) {
  return sourceHct.chroma < 8 ? neutralSource : "#303234";
}

function applyPaletteArchetype(
  tokens: VisualThemeTokens,
  options: {
    archetype: PaletteArchetype;
    brandHct: Hct;
    normalizedSourceHct: Hct;
    relatedHct: Hct;
  },
) {
  const { archetype, brandHct, normalizedSourceHct, relatedHct } = options;
  const next = { ...tokens };

  if (archetype === "source_primary") {
    next.background = lightBackgroundFrom(normalizedSourceHct.hue);
    next.card = nearWhite;
    next.primary = safePrimaryFromHct(
      normalizedSourceHct,
      clamp(normalizedSourceHct.tone, 30, 36),
    );
    next.secondary = softSurfaceFrom(normalizedSourceHct, 92, 16);
    next.muted = hexFromHct(normalizedSourceHct.hue, 5, 94);
    next.accent = softSurfaceFrom(normalizedSourceHct, 86, 30);
  }

  if (archetype === "neutral_brand") {
    next.background = "#fbfaf7";
    next.card = nearWhite;
    next.primary = neutralPrimaryFor(normalizedSourceHct);
    next.secondary = softSurfaceFrom(brandHct, 93, 14);
    next.muted = "#f1f1ee";
    next.accent = "#eee8dc";
  }

  if (archetype === "related_primary") {
    next.background = lightBackgroundFrom(relatedHct.hue);
    next.card = nearWhite;
    next.primary = safePrimaryFromHct(relatedHct, 34);
    next.secondary = softSurfaceFrom(relatedHct, 92, 16);
    next.muted = hexFromHct(relatedHct.hue, 5, 94);
    next.accent = softSurfaceFrom(brandHct, 88, 30);
  }

  next.foreground = nearBlack;
  next.cardForeground = nearBlack;
  next.primaryForeground = readableForeground(next.primary);
  next.secondaryForeground = ensureTextPair(next.secondaryForeground, next.secondary);
  next.accentForeground = ensureTextPair(next.accentForeground, next.accent);
  next.mutedForeground = ensureTextPair(next.mutedForeground, next.background);
  next.ring = next.primary;

  return next;
}

function mapSchemeToTokens(scheme: DynamicScheme): VisualThemeTokens {
  return {
    background: materialToken(scheme, MaterialDynamicColors.background),
    foreground: materialToken(scheme, MaterialDynamicColors.onBackground),
    card: materialToken(scheme, MaterialDynamicColors.surface),
    cardForeground: materialToken(scheme, MaterialDynamicColors.onSurface),
    primary: materialToken(scheme, MaterialDynamicColors.primary),
    primaryForeground: materialToken(scheme, MaterialDynamicColors.onPrimary),
    secondary: materialToken(scheme, MaterialDynamicColors.secondaryContainer),
    secondaryForeground: materialToken(
      scheme,
      MaterialDynamicColors.onSecondaryContainer,
    ),
    muted: materialToken(scheme, MaterialDynamicColors.surfaceVariant),
    mutedForeground: materialToken(
      scheme,
      MaterialDynamicColors.onSurfaceVariant,
    ),
    accent: materialToken(scheme, MaterialDynamicColors.tertiaryContainer),
    accentForeground: materialToken(
      scheme,
      MaterialDynamicColors.onTertiaryContainer,
    ),
    border: materialToken(scheme, MaterialDynamicColors.outlineVariant),
    input: materialToken(scheme, MaterialDynamicColors.outline),
    ring: materialToken(scheme, MaterialDynamicColors.primary),
    destructive: materialToken(scheme, MaterialDynamicColors.error),
    destructiveForeground: materialToken(scheme, MaterialDynamicColors.onError),
  };
}

function validateTokens(tokens: VisualThemeTokens): VisualPaletteChecks {
  const textContrastPass =
    contrastRatio(tokens.foreground, tokens.background) >= normalTextContrast &&
    contrastRatio(tokens.cardForeground, tokens.card) >= normalTextContrast &&
    contrastRatio(tokens.primaryForeground, tokens.primary) >=
      normalTextContrast &&
    contrastRatio(tokens.secondaryForeground, tokens.secondary) >=
      normalTextContrast &&
    contrastRatio(tokens.accentForeground, tokens.accent) >=
      normalTextContrast &&
    contrastRatio(tokens.mutedForeground, tokens.background) >=
      normalTextContrast &&
    contrastRatio(tokens.destructiveForeground, tokens.destructive) >=
      normalTextContrast;
  const uiContrastPass =
    contrastRatio(tokens.border, tokens.background) >= uiContrast &&
    contrastRatio(tokens.border, tokens.card) >= uiContrast &&
    contrastRatio(tokens.input, tokens.background) >= uiContrast &&
    contrastRatio(tokens.input, tokens.card) >= uiContrast &&
    contrastRatio(tokens.ring, tokens.background) >= uiContrast &&
    contrastRatio(tokens.ring, tokens.card) >= uiContrast;
  const backgroundHct = colorHct(tokens.background);
  const accentHct = colorHct(tokens.accent);
  const aestheticSafetyPass =
    !isUnsafePrimary(tokens.primary) &&
    backgroundHct.tone >= 94 &&
    backgroundHct.chroma <= 8 &&
    accentHct.tone >= 78;

  return {
    textContrastPass,
    uiContrastPass,
    aestheticSafetyPass,
    repaired: false,
  };
}

export function validateVisualThemeTokens(tokens: VisualThemeTokens) {
  return validateTokens(tokens);
}

function repairTokens(tokens: VisualThemeTokens, normalizedSource: string) {
  const original = { ...tokens };
  const sourceHct = colorHct(normalizedSource);
  let repaired = { ...tokens };

  repaired.background =
    colorHct(repaired.background).tone < 94 ||
    colorHct(repaired.background).chroma > 8
      ? "#fbfaf7"
      : repaired.background;
  repaired.card =
    colorHct(repaired.card).tone < 94 ? nearWhite : repaired.card;
  repaired.primary = repairPrimary(repaired.primary, normalizedSource);
  repaired.secondary =
    colorHct(repaired.secondary).tone < 78
      ? hexFromHct(sourceHct.hue, 12, 90)
      : repaired.secondary;
  repaired.muted =
    colorHct(repaired.muted).tone < 84
      ? hexFromHct(sourceHct.hue, 8, 92)
      : repaired.muted;
  repaired.accent =
    colorHct(repaired.accent).tone < 78
      ? hexFromHct(sourceHct.hue, clamp(sourceHct.chroma, 18, 30), 86)
      : repaired.accent;
  repaired.primaryForeground = ensureTextPair(
    repaired.primaryForeground,
    repaired.primary,
  );
  repaired.foreground = ensureTextPair(repaired.foreground, repaired.background);
  repaired.cardForeground = ensureTextPair(
    repaired.cardForeground,
    repaired.card,
  );
  repaired.secondaryForeground = ensureTextPair(
    repaired.secondaryForeground,
    repaired.secondary,
  );
  repaired.accentForeground = ensureTextPair(
    repaired.accentForeground,
    repaired.accent,
  );
  repaired.mutedForeground = ensureTextPair(
    repaired.mutedForeground,
    repaired.background,
  );
  repaired.destructive = repairPrimary(
    repaired.destructive,
    hexFromHct(5, 62, 42),
  );
  repaired.destructiveForeground = ensureTextPair(
    repaired.destructiveForeground,
    repaired.destructive,
  );
  repaired.border = ensureBoundary(repaired.border, [
    repaired.background,
    repaired.card,
  ], sourceHct.hue);
  repaired.input = ensureBoundary(repaired.input, [
    repaired.background,
    repaired.card,
  ], sourceHct.hue);
  repaired.ring = ensureBoundary(repaired.ring, [
    repaired.background,
    repaired.card,
  ], sourceHct.hue);

  const checks = validateTokens(repaired);
  checks.repaired = JSON.stringify(original) !== JSON.stringify(repaired);

  return { tokens: repaired, checks };
}

function candidateScore(
  tokens: VisualThemeTokens,
  sourceHct: Hct,
  variant: string,
  archetype: PaletteArchetype,
  contrastLevel: number,
) {
  const primary = colorHct(tokens.primary);
  const background = colorHct(tokens.background);
  const accent = colorHct(tokens.accent);
  const variantPreference: Record<string, number> = {
    tonal_spot: 18,
    content: 14,
    fidelity: 10,
    neutral: 8,
    tonal_spot_high: 6,
    content_shifted_warm: 5,
    content_shifted_cool: 5,
  };
  const archetypePreference: Record<PaletteArchetype, number> = {
    source_primary: 18,
    neutral_brand: 16,
    related_primary: 14,
  };
  const sourceCloseness = Math.max(0, 32 - hueDistance(primary.hue, sourceHct.hue));
  const toneScore = 18 - Math.abs(primary.tone - 34) * 0.7;
  const backgroundScore = background.tone >= 97 && background.chroma <= 5 ? 18 : 8;
  const accentScore = accent.tone >= 82 && accent.chroma <= 34 ? 12 : 6;
  const contrastScore = Math.min(
    14,
    contrastRatio(tokens.primaryForeground, tokens.primary),
  );

  return (
    sourceCloseness +
    toneScore +
    backgroundScore +
    accentScore +
    contrastScore +
    archetypePreference[archetype] +
    (variantPreference[variant] ?? 0) -
    Math.abs(contrastLevel - 0.5) * 4
  );
}

function buildCandidate(
  variant: string,
  archetype: PaletteArchetype,
  Scheme: SchemeConstructor,
  sourceHct: Hct,
  normalizedSource: string,
  brandHct: Hct,
  normalizedSourceHct: Hct,
  relatedHct: Hct,
  contrastLevel: number,
): PaletteCandidate | null {
  const scheme = new Scheme(sourceHct, false, contrastLevel);
  const archetypeTokens = applyPaletteArchetype(mapSchemeToTokens(scheme), {
    archetype,
    brandHct,
    normalizedSourceHct,
    relatedHct,
  });
  const { tokens, checks } = repairTokens(archetypeTokens, normalizedSource);

  if (
    !checks.textContrastPass ||
    !checks.uiContrastPass ||
    !checks.aestheticSafetyPass
  ) {
    return null;
  }

  return {
    variant,
    archetype,
    contrastLevel,
    sourceHct,
    tokens,
    checks,
    score: candidateScore(tokens, sourceHct, variant, archetype, contrastLevel),
  };
}

function candidateSignature(candidate: PaletteCandidate) {
  return [
    candidate.tokens.primary,
    candidate.tokens.secondary,
    candidate.tokens.accent,
  ].join("|");
}

function makeVisualPalette(
  candidate: PaletteCandidate,
  index: number,
  normalizedSourceColor: string,
): VisualPalette {
  const tokens = candidate.tokens;

  return {
    id: `palette_${index + 1}` as Exclude<VisualPaletteId, "">,
    label: `Palet ${index + 1}`,
    recommended: index === 0,
    swatches: [
      tokens.primary,
      tokens.secondary,
      tokens.accent,
      tokens.background,
      tokens.foreground,
    ],
    tokens,
    materialVariant: candidate.variant,
    contrastLevel: candidate.contrastLevel,
    normalizedSourceColor,
    checks: candidate.checks,
  };
}

export function generatePaletteGenerationResult(
  sourceValue: string,
): PaletteGenerationResult {
  const normalizedInput = normalizeHexColor(sourceValue) || fallbackSource;
  const normalizedSourceColor = getSafeSourceColor(normalizedInput) || fallbackSource;
  const sourceHct = colorHct(normalizedSourceColor);
  const brandHct = brandSignalHct(normalizedInput, normalizedSourceColor);
  const relatedHct = Hct.from(
    relatedHueFor(sourceHct),
    clamp(sourceHct.chroma + 8, 24, 42),
    34,
  );
  const schemeRequests: Array<{
    variant: string;
    archetype: PaletteArchetype;
    Scheme: SchemeConstructor;
    sourceHct: Hct;
    contrastLevel: number;
  }> = [
    {
      variant: "tonal_spot",
      archetype: "source_primary",
      Scheme: SchemeTonalSpot,
      sourceHct,
      contrastLevel: 0.5,
    },
    {
      variant: "neutral",
      archetype: "neutral_brand",
      Scheme: SchemeNeutral,
      sourceHct,
      contrastLevel: 0.5,
    },
    {
      variant: "content_related",
      archetype: "related_primary",
      Scheme: SchemeContent,
      sourceHct: relatedHct,
      contrastLevel: 0.5,
    },
    {
      variant: "fidelity",
      archetype: "source_primary",
      Scheme: SchemeFidelity,
      sourceHct,
      contrastLevel: 0.5,
    },
    {
      variant: "tonal_spot_high",
      archetype: "neutral_brand",
      Scheme: SchemeTonalSpot,
      sourceHct,
      contrastLevel: 0.75,
    },
    {
      variant: "tonal_spot_related",
      archetype: "related_primary",
      Scheme: SchemeTonalSpot,
      sourceHct: relatedHct,
      contrastLevel: 0.5,
    },
  ];
  const candidates = schemeRequests
    .map((request) =>
      buildCandidate(
        request.variant,
        request.archetype,
        request.Scheme,
        request.sourceHct,
        normalizedSourceColor,
        brandHct,
        sourceHct,
        relatedHct,
        request.contrastLevel,
      ),
    )
    .filter((candidate): candidate is PaletteCandidate => Boolean(candidate))
    .sort((a, b) => b.score - a.score);
  const archetypeOrder: PaletteArchetype[] = [
    "source_primary",
    "neutral_brand",
    "related_primary",
  ];
  const signatures = new Set<string>();
  const uniqueCandidates = archetypeOrder.flatMap((archetype, index) => {
    const archetypeCandidates = candidates.filter(
      (candidate) => candidate.archetype === archetype,
    );

    for (const candidate of archetypeCandidates) {
      const signature = candidateSignature(candidate);
      if (signatures.has(signature)) continue;
      signatures.add(signature);
      return [candidate];
    }

    const fallbackCandidate = buildCandidate(
      `tonal_spot_fallback_${index + 1}`,
      archetype,
      SchemeTonalSpot,
      archetype === "related_primary" ? relatedHct : sourceHct,
      normalizedSourceColor,
      brandHct,
      sourceHct,
      relatedHct,
      0.65,
    );
    if (!fallbackCandidate) return [];

    const signature = candidateSignature(fallbackCandidate);
    if (signatures.has(signature)) return [];
    signatures.add(signature);

    return [fallbackCandidate];
  });

  const palettes = uniqueCandidates
    .slice(0, 3)
    .map((candidate, index) =>
      makeVisualPalette(candidate, index, normalizedSourceColor),
    );

  return {
    generationVersion: paletteGenerationVersion,
    source: { type: "color", value: normalizedInput },
    normalizedSourceColor,
    candidatesGenerated: candidates.length,
    palettes,
    selectedPaletteId: "palette_1",
  };
}

export function generateVisualPalettes(sourceValue: string) {
  return generatePaletteGenerationResult(sourceValue).palettes;
}

export function getPaletteById(sourceValue: string, paletteId: VisualPaletteId) {
  return generateVisualPalettes(sourceValue).find(
    (palette) => palette.id === paletteId,
  );
}

function rgbDistance(colorA: string, colorB: string) {
  const a = argbFromHex(colorA);
  const b = argbFromHex(colorB);

  return Math.sqrt(
    (redFromArgb(a) - redFromArgb(b)) ** 2 +
      (greenFromArgb(a) - greenFromArgb(b)) ** 2 +
      (blueFromArgb(a) - blueFromArgb(b)) ** 2,
  );
}

function isDistinctColor(color: string, selectedColors: string[]) {
  return selectedColors.every((selectedColor) => {
    return rgbDistance(color, selectedColor) > 54;
  });
}

function isUsableLogoSource(argb: number, population: number, total: number) {
  const hct = Hct.fromInt(argb);

  if (population < Math.max(8, total * 0.012)) return false;
  if (hct.tone > 92 || hct.tone < 12) return false;
  if (hct.chroma < 12) return false;

  return true;
}

export async function extractLogoBrandColors(file: File) {
  const objectUrl = URL.createObjectURL(file);

  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = objectUrl;
    });
    const maxSize = 96;
    const scale = Math.min(
      1,
      maxSize / Math.max(image.naturalWidth, image.naturalHeight),
    );
    const width = Math.max(1, Math.round(image.naturalWidth * scale));
    const height = Math.max(1, Math.round(image.naturalHeight * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) return [];

    context.drawImage(image, 0, 0, width, height);
    const data = context.getImageData(0, 0, width, height).data;
    const pixels: number[] = [];
    let darkNeutralPopulation = 0;

    for (let index = 0; index < data.length; index += 4) {
      const alpha = data[index + 3];
      if (alpha < 160) continue;

      const argb = argbFromRgb(data[index], data[index + 1], data[index + 2]);
      const hct = Hct.fromInt(argb);

      if (hct.tone > 96) continue;
      if (hct.chroma < 8 && hct.tone < 32) darkNeutralPopulation += 1;
      pixels.push(argb);
    }

    if (!pixels.length) return [];

    const quantized = QuantizerCelebi.quantize(pixels, 24);
    const scored = Score.score(quantized, {
      desired: 8,
      fallbackColorARGB: argbFromHex(neutralSource),
      filter: true,
    });
    const selectedColors: string[] = [];

    for (const argb of scored) {
      const population = quantized.get(argb) ?? 0;
      if (!isUsableLogoSource(argb, population, pixels.length)) continue;

      const color = hexFromArgb(argb).toLowerCase();
      if (!isDistinctColor(color, selectedColors)) continue;
      selectedColors.push(color);
      if (selectedColors.length === 4) break;
    }

    if (!selectedColors.length && darkNeutralPopulation > pixels.length * 0.18) {
      return [neutralSource];
    }

    return selectedColors;
  } catch {
    return [];
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}
