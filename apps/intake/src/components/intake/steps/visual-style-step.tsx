import type { CSSProperties } from "react";
import type { UseFormReturn } from "react-hook-form";
import { ChevronLeft } from "lucide-react";

import {
  generateVisualPalettes,
  getVisualPrimaryCta,
  getVisualStyleError,
  visualShapeOptions,
  visualTypographyOptions,
  type IntakeFormValues,
  type VisualDetails,
  type VisualShape,
  type VisualThemeTokens,
  type VisualTypography,
} from "@/components/intake/model";
import { VisualRadioCard } from "@/components/intake/steps/shared/visual-choice-card";
import { Button } from "@/components/ui/button";
import { FieldError } from "@/components/ui/field";
import { RadioGroup } from "@/components/ui/radio-group";

const shapeRadii: Record<Exclude<VisualShape, "">, {
  card: number;
  input: number;
  button: number;
}> = {
  straight: { card: 0, input: 0, button: 0 },
  slightly_rounded: { card: 10, input: 8, button: 8 },
  rounded: { card: 22, input: 999, button: 999 },
};

const typographyStyles: Record<Exclude<VisualTypography, "">, {
  heading: CSSProperties;
  body: CSSProperties;
  sample: CSSProperties;
  description: string;
}> = {
  clear: {
    heading: { fontFamily: "Inter Tight, Inter, sans-serif", fontWeight: 600 },
    body: { fontFamily: "Inter, sans-serif", fontWeight: 400 },
    sample: { fontFamily: "Inter, sans-serif", fontWeight: 600 },
    description: "Strak, duidelijk en modern.",
  },
  soft: {
    heading: { fontFamily: "Nunito Sans, sans-serif", fontWeight: 700 },
    body: { fontFamily: "Nunito Sans, sans-serif", fontWeight: 400 },
    sample: { fontFamily: "Nunito Sans, sans-serif", fontWeight: 700 },
    description: "Rond, toegankelijk en rustig.",
  },
  classic: {
    heading: { fontFamily: "Lora, Georgia, serif", fontWeight: 600 },
    body: { fontFamily: "DM Sans, sans-serif", fontWeight: 400 },
    sample: { fontFamily: "Lora, Georgia, serif", fontWeight: 600 },
    description: "Elegant, persoonlijk en verzorgd.",
  },
  strong: {
    heading: { fontFamily: "Roboto Slab, Georgia, serif", fontWeight: 700 },
    body: {
      fontFamily: "Atkinson Hyperlegible, sans-serif",
      fontWeight: 400,
    },
    sample: { fontFamily: "Roboto Slab, Georgia, serif", fontWeight: 700 },
    description: "Solide, betrouwbaar en no-nonsense.",
  },
};

function getPreviewBlockTitle(value: string | undefined) {
  const cleaned = value?.trim();
  if (!cleaned) return "Dienst";

  return cleaned;
}

function ShapePreview({
  shape,
  tokens,
  ctaLabel,
  blockTitle,
}: {
  shape: Exclude<VisualShape, "">;
  tokens: VisualThemeTokens;
  ctaLabel: string;
  blockTitle: string;
}) {
  const radii = shapeRadii[shape];

  return (
    <div className="grid min-w-0 gap-3 overflow-hidden">
      <div
        className="w-full min-w-0 overflow-hidden truncate px-4 py-3 text-center text-sm leading-5"
        style={{
          borderRadius: radii.button,
          backgroundColor: tokens.primary,
          color: tokens.primaryForeground,
        }}
      >
        {ctaLabel}
      </div>
      <div
        className="min-w-0 overflow-hidden truncate border px-4 py-3 text-base leading-6 text-intake-muted-text"
        style={{
          borderRadius: radii.input,
          borderColor: tokens.border,
          backgroundColor: tokens.card,
        }}
      >
        Naam
      </div>
      <div
        className="min-w-0 overflow-hidden border px-4 py-3"
        style={{
          borderRadius: radii.card,
          borderColor: tokens.border,
          backgroundColor: tokens.card,
        }}
      >
        <p className="min-w-0 overflow-hidden text-base font-normal leading-6 text-intake-text [display:-webkit-box] [overflow-wrap:anywhere] [-webkit-box-orient:vertical] [-webkit-line-clamp:2]">
          {blockTitle}
        </p>
        <p className="mt-1 text-base font-normal leading-6 text-intake-muted-text">
          Korte tekst
        </p>
      </div>
    </div>
  );
}

function TypographyPreview({
  typography,
}: {
  typography: Exclude<VisualTypography, "">;
}) {
  const styles = typographyStyles[typography];

  return (
    <div className="grid gap-1">
      <span className="text-sm font-normal leading-5 text-intake-text">
        {visualTypographyOptions.find((option) => option.id === typography)?.title}
      </span>
      <span
        className="text-sm leading-5 text-intake-muted-text"
        style={styles.body}
      >
        {styles.description}
      </span>
      <span
        className="mt-1 text-3xl leading-9 text-intake-text"
        style={styles.heading}
      >
        Koptekst
      </span>
      <span
        className="text-base leading-6 text-intake-text"
        style={styles.body}
      >
        Korte regel tekst
      </span>
      <span
        className="text-2xl leading-8 text-intake-text"
        style={styles.sample}
      >
        Aa
      </span>
    </div>
  );
}

export function VisualStyleStep({
  form,
  showAttemptedErrors,
  onBack,
}: {
  form: UseFormReturn<IntakeFormValues>;
  showAttemptedErrors: boolean;
  onBack: () => void;
}) {
  const visual = form.watch("visual");
  const contact = form.watch("contact");
  const firstOffer = form.watch("content.offers.0.value");
  const sourceValue = visual.color.sourceValue || "#274a34";
  const fallbackTokens = generateVisualPalettes(sourceValue)[0].tokens;
  const tokens = visual.color.tokens.primary ? visual.color.tokens : fallbackTokens;
  const ctaLabel = getVisualPrimaryCta(contact);
  const blockTitle = getPreviewBlockTitle(firstOffer);
  const shapeError = showAttemptedErrors
    ? getVisualStyleError("shape", visual)
    : "";
  const typographyError = showAttemptedErrors
    ? getVisualStyleError("typography", visual)
    : "";

  function setVisualValue<TName extends keyof VisualDetails>(
    name: TName,
    value: VisualDetails[TName],
  ) {
    form.setValue(`visual.${name}`, value as never, {
      shouldDirty: true,
      shouldTouch: true,
      shouldValidate: true,
    });
  }

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
        <section data-intake-card-panel="visual-style-shape" className="grid gap-5">
          <div className="grid gap-1.5">
            <h2 className="text-xl font-normal leading-7 text-intake-text md:text-2xl md:leading-8">
              Hoeken
            </h2>
            <p className="text-base font-normal leading-6 text-intake-text">
              Wil je rechte of ronde hoeken?
            </p>
            <p className="text-base font-normal leading-6 text-intake-muted-text">
              Dit zie je terug in knoppen, formulieren en blokken.
            </p>
          </div>
          <RadioGroup
            value={visual.shape}
            onValueChange={(value) => setVisualValue("shape", value as VisualShape)}
            aria-invalid={Boolean(shapeError)}
            className="grid gap-4 lg:grid-cols-3"
          >
            {visualShapeOptions.map((option) => (
              <VisualRadioCard
                key={option.id}
                value={option.id}
                checked={visual.shape === option.id}
                className="min-h-[250px] min-w-0 overflow-hidden p-5"
              >
                <div className="grid min-w-0 gap-4">
                  <div>
                    <p className="text-base font-normal leading-6 text-intake-text">
                      {option.title}
                    </p>
                    <p className="text-sm leading-5 text-intake-muted-text">
                      {option.description}
                    </p>
                  </div>
                  <ShapePreview
                    shape={option.id}
                    tokens={tokens}
                    ctaLabel={ctaLabel}
                    blockTitle={blockTitle}
                  />
                </div>
              </VisualRadioCard>
            ))}
          </RadioGroup>
          {shapeError ? (
            <FieldError className="text-sm leading-5">{shapeError}</FieldError>
          ) : null}
        </section>

        <section
          data-intake-card-panel="visual-style-typography"
          className="grid gap-5 border-t border-intake-border pt-8"
        >
          <div className="grid gap-1.5">
            <h2 className="text-xl font-normal leading-7 text-intake-text md:text-2xl md:leading-8">
              Letterstijl
            </h2>
            <p className="text-base font-normal leading-6 text-intake-text">
              Welke letterstijl past het best?
            </p>
          </div>
          <RadioGroup
            value={visual.typography}
            onValueChange={(value) =>
              setVisualValue("typography", value as VisualTypography)
            }
            aria-invalid={Boolean(typographyError)}
            className="grid gap-4 md:grid-cols-2"
          >
            {visualTypographyOptions.map((option) => (
              <VisualRadioCard
                key={option.id}
                value={option.id}
                checked={visual.typography === option.id}
                className="min-h-[132px] p-5"
              >
                <TypographyPreview typography={option.id} />
              </VisualRadioCard>
            ))}
          </RadioGroup>
          {typographyError ? (
            <FieldError className="text-sm leading-5">
              {typographyError}
            </FieldError>
          ) : null}
        </section>
      </div>
    </div>
  );
}
