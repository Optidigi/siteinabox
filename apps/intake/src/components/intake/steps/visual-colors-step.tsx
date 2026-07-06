import { useEffect, useMemo, useRef, useState } from "react";
import type { UseFormReturn } from "react-hook-form";
import { ChevronDown, ChevronLeft } from "lucide-react";

import {
  generateVisualPalettes,
  extractLogoBrandColors,
  getPaletteById,
  getVisualColorError,
  normalizeHexColor,
  visualColorPresets,
  type IntakeFormValues,
  type VisualColorSourceType,
  type VisualDetails,
  type VisualPaletteId,
  type VisualThemeTokens,
} from "@/components/intake/model";
import { VisualRadioCard } from "@/components/intake/steps/shared/visual-choice-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { FieldError } from "@/components/ui/field";
import { RadioGroup } from "@/components/ui/radio-group";
import { cn } from "@/components/ui/utils";

const presetOptions = visualColorPresets.filter(
  (option) => option.id === "preset",
);

function colorSourceKey(sourceType: VisualColorSourceType, sourceValue: string) {
  const normalizedSourceValue = normalizeHexColor(sourceValue);

  if (sourceType === "logo") return `logo:${normalizedSourceValue}`;

  const preset = presetOptions.find(
    (option) =>
      normalizeHexColor(option.value) === normalizedSourceValue,
  );

  return preset ? `preset:${preset.label}` : "";
}

function SourceSwatch({ color }: { color: string }) {
  return (
    <span
      className="block size-12 rounded-full shadow-[inset_0_0_0_1px_rgba(0,0,0,0.08)]"
      style={{ backgroundColor: color }}
      aria-hidden="true"
    />
  );
}

function PalettePreview({
  tokens,
}: {
  tokens: VisualThemeTokens;
}) {
  return (
    <div
      className="grid gap-3 rounded-[10px] border p-3"
      style={{
        backgroundColor: tokens.background,
        borderColor: tokens.border,
      }}
    >
      <div className="grid grid-cols-[minmax(0,1fr)_72px] gap-3">
        <div
          className="grid gap-2 rounded-[8px] border p-3"
          style={{
            backgroundColor: tokens.card,
            borderColor: tokens.border,
          }}
        >
          <span
            className="h-2.5 w-2/3 rounded-full"
            style={{ backgroundColor: tokens.foreground }}
          />
          <span
            className="h-2 w-full rounded-full"
            style={{ backgroundColor: tokens.border }}
          />
          <span
            className="h-2 w-4/5 rounded-full"
            style={{ backgroundColor: tokens.border }}
          />
        </div>
        <div
          className="rounded-[8px] border"
          style={{
            backgroundColor: tokens.accent,
            borderColor: tokens.border,
          }}
        />
      </div>
      <div className="grid grid-cols-[1fr_1fr_48px] gap-2">
        <span
          className="h-9 rounded-[7px] border"
          style={{ backgroundColor: tokens.muted, borderColor: tokens.border }}
        />
        <span
          className="h-9 rounded-[7px] border"
          style={{ backgroundColor: tokens.card, borderColor: tokens.border }}
        />
        <span
          className="h-9 rounded-[7px]"
          style={{ backgroundColor: tokens.primary }}
        />
      </div>
    </div>
  );
}

function PaletteCard({
  palette,
  checked,
}: {
  palette: ReturnType<typeof generateVisualPalettes>[number];
  checked: boolean;
}) {
  return (
    <VisualRadioCard
      value={palette.id}
      checked={checked}
      className="min-h-[224px] p-5"
    >
      <div className="grid gap-5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xl font-normal leading-7 text-intake-text">
            {palette.label}
          </span>
          {palette.recommended ? (
            <Badge className="border-transparent bg-intake-success-surface text-intake-primary">
              Aanbevolen
            </Badge>
          ) : null}
          {checked ? (
            <Badge className="border-intake-border bg-background text-intake-text">
              Gekozen
            </Badge>
          ) : null}
        </div>
        <div className="flex gap-2">
          {palette.swatches.map((swatch) => (
            <span
              key={swatch}
              className="h-12 flex-1 rounded-[6px] border border-intake-border"
              style={{ backgroundColor: swatch }}
              aria-hidden="true"
            />
          ))}
        </div>
        <PalettePreview tokens={palette.tokens} />
      </div>
    </VisualRadioCard>
  );
}

export function VisualColorsStep({
  form,
  showAttemptedErrors,
  onBack,
}: {
  form: UseFormReturn<IntakeFormValues>;
  showAttemptedErrors: boolean;
  onBack: () => void;
}) {
  const visual = form.watch("visual");
  const [sourceOptionsOpen, setSourceOptionsOpen] = useState(false);
  const [logoColors, setLogoColors] = useState<string[]>([]);
  const [logoExtractionFailed, setLogoExtractionFailed] = useState(false);
  const lastExtractedLogoRef = useRef<File | null>(null);
  const hasUploadedLogo =
    visual.logo.mode === "uploaded" && Boolean(visual.logo.file);
  const sourceValue = normalizeHexColor(visual.color.sourceValue) || "#274a34";
  const palettes = useMemo(
    () => generateVisualPalettes(sourceValue),
    [sourceValue],
  );
  const sourceError = showAttemptedErrors
    ? getVisualColorError("source", visual)
    : "";
  const paletteError = showAttemptedErrors
    ? getVisualColorError("palette", visual)
    : "";

  function setColorValue<TName extends keyof VisualDetails["color"]>(
    name: TName,
    value: VisualDetails["color"][TName],
  ) {
    form.setValue(`visual.color.${name}`, value as never, {
      shouldDirty: true,
      shouldTouch: true,
      shouldValidate: true,
    });
  }

  function applySource(sourceType: VisualColorSourceType, value: string) {
    const sourceColor = normalizeHexColor(value) || "#274a34";
    const nextPalette = generateVisualPalettes(sourceColor)[0];

    setColorValue("sourceType", sourceType);
    setColorValue("sourceValue", sourceColor);
    setColorValue("selectedPalette", "palette_1");
    setColorValue("tokens", nextPalette.tokens);
  }

  function applyPalette(paletteId: VisualPaletteId) {
    const palette = getPaletteById(sourceValue, paletteId);
    if (!palette) return;

    setColorValue("selectedPalette", palette.id);
    setColorValue("tokens", palette.tokens);
  }

  useEffect(() => {
    const currentPalette = getPaletteById(
      visual.color.sourceValue,
      visual.color.selectedPalette,
    );

    if (currentPalette && visual.color.tokens.primary) return;

    const nextPalette = generateVisualPalettes(sourceValue)[0];
    setColorValue("selectedPalette", nextPalette.id);
    setColorValue("tokens", nextPalette.tokens);
  }, [
    sourceValue,
    visual.color.selectedPalette,
    visual.color.sourceValue,
    visual.color.tokens.primary,
  ]);

  useEffect(() => {
    let cancelled = false;

    if (!hasUploadedLogo || !visual.logo.file) {
      setLogoColors([]);
      setLogoExtractionFailed(false);
      lastExtractedLogoRef.current = null;
      return;
    }

    if (lastExtractedLogoRef.current === visual.logo.file) return;

    lastExtractedLogoRef.current = visual.logo.file;
    setLogoColors([]);
    setLogoExtractionFailed(false);

    void extractLogoBrandColors(visual.logo.file).then((colors) => {
      if (cancelled) return;
      setLogoColors(colors);

      if (colors[0]) {
        applySource("logo", colors[0]);
        return;
      }

      setLogoExtractionFailed(true);
    });

    return () => {
      cancelled = true;
    };
  }, [hasUploadedLogo, visual.logo.file, visual.color.sourceType]);

  const selectedSourceKey = colorSourceKey(
    visual.color.sourceType,
    visual.color.sourceValue,
  );
  const sourceValueFromLogo =
    hasUploadedLogo &&
    visual.color.sourceType === "logo" &&
    logoColors.includes(normalizeHexColor(visual.color.sourceValue));
  const showLogoColorSummary =
    sourceValueFromLogo && !sourceOptionsOpen && !logoExtractionFailed;
  const sourceQuestion = showLogoColorSummary
    ? "Hoofdkleur uit je logo"
    : "Welke hoofdkleur wil je gebruiken?";

  return (
    <div className="w-full max-w-[1040px]">
      <Button
        type="button"
        variant="ghost"
        onClick={onBack}
        aria-label="Terug"
        className="mb-6 h-10 rounded-full px-0 text-base font-normal text-intake-text hover:bg-transparent hover:text-intake-primary min-[1360px]:hidden"
      >
        <ChevronLeft className="size-5" strokeWidth={1.75} aria-hidden="true" />
        Terug
      </Button>

      <div className="grid gap-10">
        <section data-intake-card-panel="visual-colors-source" className="grid gap-5">
          <h2 className="text-xl font-normal leading-7 text-intake-text md:text-2xl md:leading-8">
            {sourceQuestion}
          </h2>

          {showLogoColorSummary ? (
            <div className="grid gap-4">
              <div className="w-fit rounded-[12px] border border-intake-primary bg-background px-5 py-4 shadow-[0_0_0_1px_var(--intake-primary)]">
                <div className="flex items-center gap-4">
                  <SourceSwatch color={sourceValue} />
                  <div>
                    <p className="text-base font-normal leading-6 text-intake-text">
                      Kleur uit je logo
                    </p>
                    <p className="text-sm leading-5 text-intake-muted-text">
                      We hebben deze kleur uit je logo gehaald.
                    </p>
                  </div>
                </div>
              </div>

              <Collapsible open={sourceOptionsOpen} onOpenChange={setSourceOptionsOpen}>
                <CollapsibleTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    className="h-11 w-fit rounded-[8px] border-intake-border-strong bg-background px-4 text-base font-normal shadow-none hover:bg-intake-panel"
                  >
                    Andere hoofdkleur kiezen
                    <ChevronDown
                      className={cn(
                        "size-4 transition-transform",
                        sourceOptionsOpen && "rotate-180",
                      )}
                      strokeWidth={1.75}
                      aria-hidden="true"
                    />
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="pt-4">
                  <SourceColorOptions
                    logoColors={logoColors}
                    selectedKey={selectedSourceKey}
                    sourceValue={visual.color.sourceValue}
                    onSelect={applySource}
                  />
                </CollapsibleContent>
              </Collapsible>
            </div>
          ) : (
            <div className="grid gap-3">
              {hasUploadedLogo && logoExtractionFailed ? (
                <p className="text-base font-normal leading-6 text-intake-muted-text">
                  Kies zelf een hoofdkleur. Uit dit logo konden we geen duidelijke kleur halen.
                </p>
              ) : null}
              <SourceColorOptions
                logoColors={logoColors}
                selectedKey={selectedSourceKey}
                sourceValue={visual.color.sourceValue}
                onSelect={applySource}
              />
            </div>
          )}

          {sourceError ? (
            <FieldError className="text-sm leading-5">{sourceError}</FieldError>
          ) : null}
        </section>

        <section data-intake-card-panel="visual-colors-palette" className="grid gap-5">
          <h2 className="text-xl font-normal leading-7 text-intake-text md:text-2xl md:leading-8">
            Welk kleurenpalet gebruiken we?
          </h2>
          <RadioGroup
            value={visual.color.selectedPalette}
            onValueChange={(value) => applyPalette(value as VisualPaletteId)}
            aria-invalid={Boolean(paletteError)}
            className="grid gap-4 lg:grid-cols-3"
          >
            {palettes.map((palette) => (
              <PaletteCard
                key={palette.id}
                palette={palette}
                checked={visual.color.selectedPalette === palette.id}
              />
            ))}
          </RadioGroup>
          {paletteError ? (
            <FieldError className="text-sm leading-5">{paletteError}</FieldError>
          ) : null}
        </section>
      </div>
    </div>
  );
}

function SourceColorOptions({
  logoColors = [],
  selectedKey,
  sourceValue,
  onSelect,
}: {
  logoColors?: string[];
  selectedKey: string;
  sourceValue: string;
  onSelect: (sourceType: VisualColorSourceType, value: string) => void;
}) {
  return (
    <div className="grid gap-4">
      <RadioGroup
        value={selectedKey}
        onValueChange={(value) => {
          if (value.startsWith("logo:")) {
            onSelect("logo", value.replace("logo:", ""));
            return;
          }

          const preset = presetOptions.find(
            (option) => `preset:${option.label}` === value,
          );
          if (preset) onSelect("preset", preset.value);
        }}
        className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,128px),1fr))] gap-3"
      >
        {logoColors.map((color, index) => (
          <VisualRadioCard
            key={`logo-${color}`}
            value={`logo:${color}`}
            checked={selectedKey === `logo:${color}`}
            className="grid min-h-[120px] place-items-center p-4 text-center"
          >
            <div className="grid place-items-center gap-3">
              <SourceSwatch color={color} />
              <span className="text-base font-normal leading-6 text-intake-text">
                {index === 0 ? "Uit logo" : `Logo ${index + 1}`}
              </span>
            </div>
          </VisualRadioCard>
        ))}
        {presetOptions.map((option) => (
          <VisualRadioCard
            key={option.label}
            value={`preset:${option.label}`}
            checked={selectedKey === `preset:${option.label}`}
            className="grid min-h-[120px] place-items-center p-4 text-center"
          >
            <div className="grid place-items-center gap-3 pr-0">
              <SourceSwatch color={option.value} />
              <span className="text-base font-normal leading-6 text-intake-text">
                {option.label}
              </span>
            </div>
          </VisualRadioCard>
        ))}
      </RadioGroup>
    </div>
  );
}
