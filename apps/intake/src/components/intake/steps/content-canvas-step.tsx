import type { ReactNode } from "react";
import { useFieldArray } from "react-hook-form";
import type { UseFormReturn } from "react-hook-form";
import { Check, ChevronLeft, Plus, X } from "lucide-react";
import { Accordion } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  compactText,
  contentFormId,
  contentLimits,
  countValidOffers,
  getContentCardError,
  getContentCardLimitError,
  hasGenericApproach,
  hasOnlyEveryone,
  isContentCardComplete,
  needsWorkAreaRegion,
  type BusinessContentDetails,
  type ContentCardId,
  type IntakeFormValues,
  type WorkMode,
} from "@/components/intake/model";
import { cn } from "@/components/ui/utils";
import { CanvasAccordionCard } from "./shared/canvas-card";
import { FieldSupport, OptionalMarker } from "./shared/field-support";

function getCardStatus(
  cardId: ContentCardId,
  content: BusinessContentDetails,
  showAttemptedErrors = false,
) {
  const limitError = getContentCardLimitError(cardId, content);
  const error =
    limitError ||
    (showAttemptedErrors ? getContentCardError(cardId, content) : "");
  const complete = isContentCardComplete(cardId, content);

  if (error) {
    return {
      label: "Nog nodig",
      complete: false,
      tone: "error" as const,
      error,
    };
  }

  if (complete && (cardId !== "notes" || content.notes.trim())) {
    if (cardId === "offer") {
      const count = countValidOffers(content.offers);
      return {
        label: `${count} ingevuld`,
        complete: true,
        tone: "success" as const,
        error: "",
      };
    }

    return {
      label: "Ingevuld",
      complete: true,
      tone: "success" as const,
      error: "",
    };
  }

  if (cardId === "notes") {
    return {
      label: "Optioneel",
      complete: true,
      tone: "neutral" as const,
      error: "",
    };
  }

  return {
    label: "Nog invullen",
    complete: false,
    tone: "neutral" as const,
    error: "",
  };
}

function getCardSummary(
  cardId: ContentCardId,
  content: BusinessContentDetails,
) {
  if (cardId === "intro") return compactText(content.intro);
  if (cardId === "offer") {
    const offers = content.offers
      .map((offer) => offer.value.trim())
      .filter(Boolean);
    return compactText(offers.join(", "));
  }
  if (cardId === "customers") {
    return compactText(
      [content.audience, content.situation].filter(Boolean).join(" · "),
    );
  }
  if (cardId === "approach") return compactText(content.approach);
  if (cardId === "workArea") {
    const labels: Record<WorkMode, string> = {
      on_location: content.region.trim()
        ? `Bij klanten op locatie: ${content.region.trim()}`
        : "Bij klanten op locatie",
      at_business: "Klanten komen naar mij",
      remote: "Online of telefonisch",
      fixed_region: content.region.trim() || "Vaste regio",
      nationwide: "Heel Nederland",
    };

    return compactText(
      content.workModes.map((mode) => labels[mode]).join(", "),
    );
  }

  return compactText(content.notes);
}

function ContentCanvasCard({
  id,
  title,
  purpose,
  content,
  showAttemptedErrors,
  children,
}: {
  id: ContentCardId;
  title: string;
  purpose: string;
  content: BusinessContentDetails;
  showAttemptedErrors: boolean;
  children: ReactNode;
}) {
  const status = getCardStatus(id, content, showAttemptedErrors);

  return (
    <CanvasAccordionCard
      value={id}
      title={title}
      purpose={purpose}
      statusLabel={status.label}
      statusTone={status.tone}
      summary={getCardSummary(id, content)}
      panelId={`content-${id}`}
    >
      {children}
    </CanvasAccordionCard>
  );
}

function WorkModeCard({
  title,
  description,
  checked,
  onCheckedChange,
}: {
  title: string;
  description: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <FieldLabel
      className={cn(
        "flex min-h-[112px] w-full cursor-pointer items-center justify-between gap-4 rounded-[12px] border border-intake-border bg-background px-5 text-left transition-colors hover:border-intake-border-accent hover:bg-intake-subtle focus-within:ring-[3px] focus-within:ring-intake-primary/20 has-data-[state=checked]:border-[var(--intake-primary)] has-data-[state=checked]:bg-[var(--intake-success-surface)]",
        checked &&
          "border-[var(--intake-primary)] bg-[var(--intake-success-surface)] hover:border-[var(--intake-primary)] hover:bg-[var(--intake-success-surface)]",
      )}
    >
      <Checkbox
        checked={checked}
        onCheckedChange={(value) => onCheckedChange(Boolean(value))}
        className="sr-only"
        aria-label={title}
      />
      <span className="min-w-0">
        <span className="block text-base font-normal leading-6 text-intake-text">
          {title}
        </span>
        <span className="mt-1 block text-sm leading-5 text-intake-muted-text">
          {description}
        </span>
      </span>
      <span
        className={cn(
          "flex size-5 shrink-0 items-center justify-center rounded-[6px] border border-intake-border bg-background text-transparent transition-colors",
          checked &&
            "border-[var(--intake-primary)] bg-[var(--intake-primary)] text-background",
        )}
        aria-hidden="true"
      >
        <Check className="size-3.5" strokeWidth={2.2} />
      </span>
    </FieldLabel>
  );
}

export function ContentCanvasStep({
  form,
  openCard,
  showAttemptedErrors,
  onOpenCardChange,
  onBack,
}: {
  form: UseFormReturn<IntakeFormValues>;
  openCard: ContentCardId | "";
  showAttemptedErrors: boolean;
  onOpenCardChange: (cardId: ContentCardId | "") => void;
  onBack: () => void;
}) {
  const content = form.watch("content");
  const contentErrors = form.formState.errors.content;
  const introError =
    getContentCardLimitError("intro", content) ||
    (showAttemptedErrors ? getContentCardError("intro", content) : "");
  const offerError =
    getContentCardLimitError("offer", content) ||
    (showAttemptedErrors ? getContentCardError("offer", content) : "");
  const customersError =
    getContentCardLimitError("customers", content) ||
    (showAttemptedErrors ? getContentCardError("customers", content) : "");
  const approachError =
    getContentCardLimitError("approach", content) ||
    (showAttemptedErrors ? getContentCardError("approach", content) : "");
  const workAreaError = showAttemptedErrors
    ? getContentCardError("workArea", content)
    : "";
  const showWorkAreaRegion = needsWorkAreaRegion(content.workModes);
  const notesError =
    getContentCardLimitError("notes", content) ||
    (showAttemptedErrors ? getContentCardError("notes", content) : "");
  const {
    fields: offerFields,
    append: appendOffer,
    remove: removeOffer,
  } = useFieldArray({
    control: form.control,
    name: "content.offers",
  });
  const workModeOptions: Array<{
    id: WorkMode;
    title: string;
    description: string;
  }> = [
    {
      id: "on_location",
      title: "Bij klanten op locatie",
      description: "Je gaat naar de klant toe.",
    },
    {
      id: "at_business",
      title: "Klanten komen naar mij",
      description: "Bijvoorbeeld praktijk, salon, winkel, studio of kantoor.",
    },
    {
      id: "remote",
      title: "Online of telefonisch",
      description: "Je werkt op afstand.",
    },
    {
      id: "fixed_region",
      title: "In een vaste regio",
      description: "Je werkt vooral in een bepaald gebied.",
    },
    {
      id: "nationwide",
      title: "In heel Nederland",
      description: "Je bent niet aan één regio gebonden.",
    },
  ];

  function toggleWorkMode(mode: WorkMode, checked: boolean) {
    const current = form.getValues("content.workModes");
    const next = checked
      ? Array.from(new Set([...current, mode]))
      : current.filter((item) => item !== mode);

    form.setValue("content.workModes", next, {
      shouldDirty: true,
      shouldTouch: true,
      shouldValidate: true,
    });
  }

  return (
    <div className="w-full max-w-[920px]">
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

      <form
        id={contentFormId}
        onSubmit={(event) => event.preventDefault()}
        noValidate
      >
        <Accordion
          type="single"
          value={openCard}
          onValueChange={(value) => {
            onOpenCardChange((value as ContentCardId | "") || "");
          }}
          collapsible
          className="grid gap-4"
        >
          <ContentCanvasCard
            id="intro"
            title="Korte uitleg"
            purpose="Voor de eerste tekst bovenaan je homepage."
            content={content}
            showAttemptedErrors={showAttemptedErrors}
          >
            <Field data-invalid={Boolean(introError)}>
              <FieldLabel
                htmlFor="content-intro"
                className="text-base font-normal leading-6 text-intake-text"
              >
                Wat moet iemand meteen begrijpen over je bedrijf?
              </FieldLabel>
              <Textarea
                id="content-intro"
                rows={5}
                placeholder="Bijvoorbeeld: Wij helpen particuliere huiseigenaren en kleine VvE's met binnen- en buitenschilderwerk, houtrotreparaties en onderhoud in Utrecht en omgeving."
                aria-invalid={Boolean(introError)}
                className={cn(
                  "min-h-[150px] rounded-[8px] border-intake-border-strong px-4 py-4 text-base font-normal leading-6 text-intake-text shadow-none placeholder:text-intake-muted-text focus-visible:ring-intake-primary/20",
                  introError &&
                    "border-destructive focus-visible:ring-destructive/20",
                )}
                {...form.register("content.intro")}
              />
              <FieldSupport
                helper="Schrijf 2 tot 4 korte zinnen in gewone taal."
                error={introError}
                value={content.intro}
                max={contentLimits.intro.max}
                showCounter={Boolean(introError)}
              />
            </Field>
          </ContentCanvasCard>

          <ContentCanvasCard
            id="offer"
            title="Aanbod"
            purpose="Voor de diensten of onderwerpen op je homepage."
            content={content}
            showAttemptedErrors={showAttemptedErrors}
          >
            <FieldSet className="gap-5">
              <div className="grid gap-2">
                <FieldLegend className="mb-0 text-base font-normal leading-6 text-intake-text">
                  Waarvoor kunnen mensen bij je terecht?
                </FieldLegend>
                <FieldDescription className="text-sm leading-5 text-intake-muted-text">
                  Noem de belangrijkste dingen waarvoor je gevonden wilt worden.
                  Zet het belangrijkste bovenaan.
                </FieldDescription>
              </div>
              {offerError ? (
                <FieldError className="-mt-2 text-sm leading-5">
                  {offerError}
                </FieldError>
              ) : null}
              {offerFields.map((field, index) => {
                const offerValue = content.offers[index]?.value ?? "";
                const offerOverLimit =
                  offerValue.length > contentLimits.offer.max;

                return (
                  <Field key={field.id} data-invalid={offerOverLimit}>
                    <div className="flex gap-3">
                      <Input
                        id={`content-offer-${index}`}
                        aria-label={`Aanbod ${index + 1}`}
                        placeholder="Dienst, product, werkzaamheid of onderwerp"
                        aria-invalid={offerOverLimit}
                        className={cn(
                          "h-14 rounded-[8px] border-intake-border-strong px-4 text-base font-normal leading-6 text-intake-text shadow-none placeholder:text-intake-muted-text focus-visible:ring-intake-primary/20",
                          offerOverLimit &&
                            "border-destructive focus-visible:ring-destructive/20",
                        )}
                        {...form.register(`content.offers.${index}.value`)}
                      />
                      {offerFields.length > 1 ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => removeOffer(index)}
                          aria-label={`Aanbod ${index + 1} verwijderen`}
                          className="size-14 shrink-0 rounded-full text-intake-muted-text hover:bg-intake-panel hover:text-intake-primary"
                        >
                          <X
                            className="size-5"
                            strokeWidth={1.75}
                            aria-hidden="true"
                          />
                        </Button>
                      ) : null}
                    </div>
                  </Field>
                );
              })}
              <div className="flex items-center justify-between gap-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => appendOffer({ value: "" })}
                  disabled={offerFields.length >= 6}
                  className="h-11 rounded-full border-intake-border-accent bg-background px-5 text-base font-normal text-intake-text shadow-none hover:bg-intake-panel"
                >
                  <Plus
                    className="size-4"
                    strokeWidth={1.75}
                    aria-hidden="true"
                  />
                  Nog iets toevoegen
                </Button>
                <span className="text-sm leading-5 text-intake-muted-text">
                  {countValidOffers(content.offers)} van 6
                </span>
              </div>
            </FieldSet>
          </ContentCanvasCard>

          <ContentCanvasCard
            id="customers"
            title="Klanten en situaties"
            purpose="Voor wie de tekst bedoeld is en wanneer iemand contact opneemt."
            content={content}
            showAttemptedErrors={showAttemptedErrors}
          >
            <FieldGroup className="gap-6">
              <Field data-invalid={Boolean(customersError)}>
                <FieldLabel
                  htmlFor="content-audience"
                  className="text-base font-normal leading-6 text-intake-text"
                >
                  Voor wie is je bedrijf vooral bedoeld?
                </FieldLabel>
                <Textarea
                  id="content-audience"
                  rows={3}
                  placeholder="Bijvoorbeeld: Particuliere huiseigenaren in Utrecht en omgeving."
                  aria-invalid={Boolean(customersError)}
                  className={cn(
                    "min-h-[110px] rounded-[8px] border-intake-border-strong px-4 py-4 text-base font-normal leading-6 text-intake-text shadow-none placeholder:text-intake-muted-text focus-visible:ring-intake-primary/20",
                    customersError &&
                      "border-destructive focus-visible:ring-destructive/20",
                  )}
                  {...form.register("content.audience")}
                />
                <FieldSupport
                  helper="Niet “iedereen”, maar wie je het liefst helpt."
                  error={
                    customersError &&
                    content.audience.trim().length < contentLimits.audience.min
                      ? customersError
                      : undefined
                  }
                  value={content.audience}
                  max={contentLimits.audience.max}
                  showCounter={Boolean(customersError)}
                />
                {hasOnlyEveryone(content.audience) ? (
                  <p className="text-sm leading-5 text-intake-muted-text">
                    Probeer de belangrijkste groep of situatie te noemen. Dat
                    maakt de website duidelijker.
                  </p>
                ) : null}
              </Field>
              <Field data-invalid={Boolean(customersError)}>
                <FieldLabel
                  htmlFor="content-situation"
                  className="text-base font-normal leading-6 text-intake-text"
                >
                  Wanneer is iemand bij jou aan het juiste adres?
                </FieldLabel>
                <Textarea
                  id="content-situation"
                  rows={4}
                  placeholder="Bijvoorbeeld: Iemand zoekt een schilder voor de buitenkant van een woning en wil vooraf duidelijk weten wat het kost."
                  aria-invalid={Boolean(customersError)}
                  className={cn(
                    "min-h-[130px] rounded-[8px] border-intake-border-strong px-4 py-4 text-base font-normal leading-6 text-intake-text shadow-none placeholder:text-intake-muted-text focus-visible:ring-intake-primary/20",
                    customersError &&
                      "border-destructive focus-visible:ring-destructive/20",
                  )}
                  {...form.register("content.situation")}
                />
                <FieldSupport
                  helper="Beschrijf één voorbeeld van een vraag, wens of situatie die goed bij je past."
                  error={
                    customersError &&
                    content.audience.trim().length >= contentLimits.audience.min
                      ? customersError
                      : undefined
                  }
                  value={content.situation}
                  max={contentLimits.situation.max}
                  showCounter={Boolean(customersError)}
                />
              </Field>
            </FieldGroup>
          </ContentCanvasCard>

          <ContentCanvasCard
            id="approach"
            title="Aanpak"
            purpose="Voor een duidelijke en geloofwaardige uitleg van hoe je werkt."
            content={content}
            showAttemptedErrors={showAttemptedErrors}
          >
            <Field data-invalid={Boolean(approachError)}>
              <FieldLabel
                htmlFor="content-approach"
                className="text-base font-normal leading-6 text-intake-text"
              >
                Hoe pak je je werk meestal aan?
              </FieldLabel>
              <Textarea
                id="content-approach"
                rows={4}
                placeholder="Bijvoorbeeld: We komen eerst kijken, bespreken de mogelijkheden en sturen daarna een duidelijke offerte."
                aria-invalid={Boolean(approachError)}
                className={cn(
                  "min-h-[130px] rounded-[8px] border-intake-border-strong px-4 py-4 text-base font-normal leading-6 text-intake-text shadow-none placeholder:text-intake-muted-text focus-visible:ring-intake-primary/20",
                  approachError &&
                    "border-destructive focus-visible:ring-destructive/20",
                )}
                {...form.register("content.approach")}
              />
              <FieldSupport
                helper="Noem kort wat klanten kunnen verwachten in contact, planning, uitleg, samenwerking of oplevering."
                error={approachError}
                value={content.approach}
                max={contentLimits.approach.max}
                showCounter={Boolean(approachError)}
              />
              {hasGenericApproach(content.approach) ? (
                <p className="text-sm leading-5 text-intake-muted-text">
                  Noem één concreet ding dat klanten merken, zoals duidelijke
                  uitleg, snelle reactie of netjes opleveren.
                </p>
              ) : null}
            </Field>
          </ContentCanvasCard>

          <ContentCanvasCard
            id="workArea"
            title="Werkgebied"
            purpose="Voor de locatie- en contactinformatie op de website."
            content={content}
            showAttemptedErrors={showAttemptedErrors}
          >
            <FieldSet className="gap-5" data-invalid={Boolean(workAreaError)}>
              <div>
                <FieldLegend className="mb-0 text-base font-normal leading-6 text-intake-text">
                  Waar en hoe werk je met klanten?
                </FieldLegend>
                <FieldDescription className="mt-1 text-sm leading-5 text-intake-muted-text">
                  Kies alles wat van toepassing is.
                </FieldDescription>
              </div>
              <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,260px),1fr))] gap-3">
                {workModeOptions.map((option) => (
                  <WorkModeCard
                    key={option.id}
                    title={option.title}
                    description={option.description}
                    checked={content.workModes.includes(option.id)}
                    onCheckedChange={(checked) =>
                      toggleWorkMode(option.id, checked)
                    }
                  />
                ))}
              </div>
              {workAreaError && !showWorkAreaRegion ? (
                <FieldError className="text-sm leading-5">
                  {workAreaError}
                </FieldError>
              ) : null}
              {showWorkAreaRegion ? (
                <Field
                  data-invalid={Boolean(workAreaError || contentErrors?.region)}
                >
                  <FieldLabel
                    htmlFor="content-region"
                    className="text-base font-normal leading-6 text-intake-text"
                  >
                    Waar wil je werken?
                  </FieldLabel>
                  <FieldDescription className="text-sm leading-5 text-intake-muted-text">
                    Bijvoorbeeld een plaats, regio of maximale reisafstand.
                  </FieldDescription>
                  <Input
                    id="content-region"
                    placeholder="Utrecht en omgeving, of tot 30 km vanaf Utrecht"
                    aria-invalid={Boolean(
                      workAreaError || contentErrors?.region,
                    )}
                    className={cn(
                      "h-14 rounded-[8px] border-intake-border-strong px-4 text-base font-normal leading-6 text-intake-text shadow-none placeholder:text-intake-muted-text focus-visible:ring-intake-primary/20",
                      (workAreaError || contentErrors?.region) &&
                        "border-destructive focus-visible:ring-destructive/20",
                    )}
                    {...form.register("content.region")}
                  />
                  <FieldError className="text-sm leading-5">
                    {workAreaError || contentErrors?.region?.message}
                  </FieldError>
                </Field>
              ) : null}
            </FieldSet>
          </ContentCanvasCard>

          <ContentCanvasCard
            id="notes"
            title="Belangrijk om te weten"
            purpose="Voor namen, diensten of woorden waar we rekening mee moeten houden."
            content={content}
            showAttemptedErrors={showAttemptedErrors}
          >
            <Field data-invalid={Boolean(notesError)}>
              <FieldLabel
                htmlFor="content-notes"
                className="flex items-baseline justify-between gap-4 text-base font-normal leading-6 text-intake-text"
              >
                Waar moeten we rekening mee houden?
                <OptionalMarker />
              </FieldLabel>
              <Textarea
                id="content-notes"
                rows={4}
                placeholder="Bijvoorbeeld een naam die precies zo geschreven moet worden, een dienst die je niet meer aanbiedt, of woorden die je liever niet gebruikt."
                aria-invalid={Boolean(notesError)}
                className={cn(
                  "min-h-[130px] rounded-[8px] border-intake-border-strong px-4 py-4 text-base font-normal leading-6 text-intake-text shadow-none placeholder:text-intake-muted-text focus-visible:ring-intake-primary/20",
                  notesError &&
                    "border-destructive focus-visible:ring-destructive/20",
                )}
                {...form.register("content.notes")}
              />
              <FieldSupport
                helper="Dit is optioneel. Het helpt vooral om fouten te voorkomen."
                error={notesError}
                value={content.notes}
                max={contentLimits.notes.max}
                showCounter={Boolean(notesError)}
              />
            </Field>
          </ContentCanvasCard>
        </Accordion>
      </form>
    </div>
  );
}
