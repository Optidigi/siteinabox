import {
  CalendarDays,
  Check,
  ChevronLeft,
  FileText,
  ListChecks,
  MessageCircle,
  MessageSquare,
  Phone,
  type LucideIcon,
} from "lucide-react";
import { useEffect } from "react";
import type { UseFormReturn } from "react-hook-form";
import {
  getContactError,
  getNormalizedPrimaryAction,
  contactActionOptions,
  type ContactAction,
  type ContactDetails,
  type ContactFormOption,
  type ContactFormType,
  type ContactSectionId,
  type IntakeFormValues,
} from "@/components/intake/model";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { FieldError, FieldLabel } from "@/components/ui/field";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { cn } from "@/components/ui/utils";

type ContactMainChoice = ContactAction | "multiple";

type ContactMainOption = {
  id: ContactMainChoice;
  title: string;
  description: string;
  icon: LucideIcon;
};

const mainContactOptions: ContactMainOption[] = [
  {
    id: "message",
    title: "Contact opnemen",
    description: "Voor gewone vragen of een bericht.",
    icon: MessageSquare,
  },
  {
    id: "appointment",
    title: "Afspraak maken",
    description: "Voor bezoekers die een afspraak willen aanvragen.",
    icon: CalendarDays,
  },
  {
    id: "quote",
    title: "Offerte aanvragen",
    description: "Voor aanvragen met een korte omschrijving van het werk.",
    icon: FileText,
  },
  {
    id: "phone",
    title: "Direct bellen",
    description: "Voor bezoekers die snel telefonisch contact willen.",
    icon: Phone,
  },
  {
    id: "whatsapp",
    title: "WhatsApp sturen",
    description: "Voor snelle vragen via WhatsApp.",
    icon: MessageCircle,
  },
  {
    id: "multiple",
    title: "Meerdere aanvragen",
    description: "Als meerdere contactopties belangrijk zijn.",
    icon: ListChecks,
  },
];

const formActionIds: ContactFormOption[] = ["message", "quote", "appointment"];

function isFormAction(action: ContactMainChoice): action is ContactFormOption {
  return formActionIds.includes(action as ContactFormOption);
}

function isContactMainChoice(
  value: ContactMainChoice | "",
): value is ContactMainChoice {
  return value !== "";
}

function getMainChoice(contact: ContactDetails): ContactMainChoice | "" {
  if (contact.formType === "multiple") return "multiple";
  if (contact.primaryAction) return contact.primaryAction;
  return "";
}

function getFormValues(
  mainChoice: ContactMainChoice,
  selectedActions: ContactAction[],
): Pick<ContactDetails, "formType" | "formOptions"> {
  if (mainChoice === "phone" || mainChoice === "whatsapp") {
    return { formType: "none", formOptions: [] };
  }

  const formOptions = selectedActions.filter(isFormAction);

  if (mainChoice === "multiple") {
    return { formType: "multiple", formOptions };
  }

  const singleFormOptions = Array.from(
    new Set<ContactFormOption>([mainChoice]),
  );

  return { formType: singleFormOptions[0] as ContactFormType, formOptions: [] };
}

function getSelectedActions(
  mainChoice: ContactMainChoice,
  selectedActions: ContactAction[],
) {
  if (mainChoice === "multiple") return selectedActions;

  return [mainChoice];
}

function MainChoiceCard({
  option,
  checked,
}: {
  option: ContactMainOption;
  checked: boolean;
}) {
  const Icon = option.icon;

  return (
    <FieldLabel
      className={cn(
        "grid min-h-[132px] w-full cursor-pointer grid-cols-[auto_1fr] items-center gap-4 rounded-[12px] border border-intake-border bg-background px-6 py-5 text-left shadow-none transition-colors hover:border-intake-border-accent hover:bg-intake-subtle focus-within:ring-[3px] focus-within:ring-intake-primary/20 has-data-[state=checked]:border-[var(--intake-primary)] has-data-[state=checked]:bg-[var(--intake-success-surface)] md:min-h-[126px]",
        checked &&
          "border-[var(--intake-primary)] bg-[var(--intake-success-surface)] hover:border-[var(--intake-primary)] hover:bg-[var(--intake-success-surface)]",
      )}
    >
      <span
        className={cn(
          "flex size-14 shrink-0 items-center justify-center rounded-[12px] bg-intake-subtle text-intake-text transition-colors",
          checked && "bg-background text-[var(--intake-primary)]",
        )}
      >
        <Icon className="size-7" strokeWidth={1.65} aria-hidden="true" />
      </span>
      <span className="min-w-0">
        <span className="block text-base font-normal leading-6 text-intake-text">
          {option.title}
        </span>
        <span className="mt-1 block text-base font-normal leading-6 text-intake-muted-text">
          {option.description}
        </span>
      </span>
      <RadioGroupItem
        value={option.id}
        aria-label={option.title}
        className="sr-only"
      />
    </FieldLabel>
  );
}

function ExtraRequestOption({
  option,
  checked,
  onCheckedChange,
}: {
  option: (typeof contactActionOptions)[number];
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <FieldLabel
      className={cn(
        "flex min-h-[88px] w-full cursor-pointer items-center justify-between gap-4 rounded-[10px] border border-intake-border bg-background px-4 text-left transition-colors hover:border-intake-border-accent hover:bg-background focus-within:ring-[3px] focus-within:ring-intake-primary/20 has-data-[state=checked]:border-[var(--intake-primary)] has-data-[state=checked]:bg-[var(--intake-success-surface)]",
        checked &&
          "border-[var(--intake-primary)] bg-[var(--intake-success-surface)] hover:border-[var(--intake-primary)] hover:bg-[var(--intake-success-surface)]",
      )}
    >
      <Checkbox
        checked={checked}
        onCheckedChange={(value) => onCheckedChange(Boolean(value))}
        aria-label={option.title}
        className="sr-only"
      />
      <span className="min-w-0">
        <span className="block text-base font-normal leading-6 text-intake-text">
          {option.title}
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

function getRequestPrimaryTitle(option: ContactFormOption) {
  if (option === "message") return "Contact opnemen";
  if (option === "quote") return "Offerte aanvragen";
  return "Afspraak maken";
}

function PrimaryRequestChoice({
  option,
  checked,
}: {
  option: (typeof contactActionOptions)[number];
  checked: boolean;
}) {
  const title = isFormAction(option.id)
    ? getRequestPrimaryTitle(option.id)
    : option.title;

  return (
    <FieldLabel
      className={cn(
        "flex min-h-14 w-full cursor-pointer items-center justify-between gap-4 rounded-[10px] border border-intake-border bg-background px-4 text-left transition-colors hover:border-intake-border-accent hover:bg-background focus-within:ring-[3px] focus-within:ring-intake-primary/20 has-data-[state=checked]:border-[var(--intake-primary)] has-data-[state=checked]:bg-[var(--intake-success-surface)]",
        checked &&
          "border-[var(--intake-primary)] bg-[var(--intake-success-surface)] hover:border-[var(--intake-primary)] hover:bg-[var(--intake-success-surface)]",
      )}
    >
      <RadioGroupItem
        value={option.id}
        aria-label={title}
        className="sr-only"
      />
      <span className="text-base font-normal leading-6 text-intake-text">
        {title}
      </span>
    </FieldLabel>
  );
}

export function ContactStep({
  form,
  openCard,
  showAttemptedErrors,
  onOpenCardChange,
  onBack,
}: {
  form: UseFormReturn<IntakeFormValues>;
  openCard: ContactSectionId | "";
  showAttemptedErrors: boolean;
  onOpenCardChange: (cardId: ContactSectionId | "") => void;
  onBack: () => void;
}) {
  void openCard;
  void onOpenCardChange;
  const contact = form.watch("contact");
  const mainChoice = getMainChoice(contact);
  const normalizedPrimaryAction = getNormalizedPrimaryAction(contact);
  const actionsError = showAttemptedErrors
    ? getContactError("selectedActions", contact)
    : "";
  const formOptionsError = showAttemptedErrors
    ? getContactError("formOptions", contact)
    : "";
  const primaryActionError = showAttemptedErrors
    ? getContactError("primaryAction", contact)
    : "";
  const selectedContactOptions =
    mainChoice === "multiple"
      ? contact.selectedActions
      : isContactMainChoice(mainChoice)
        ? [mainChoice]
        : [];
  const isMultipleChoice = mainChoice === "multiple";

  function setContactValue<TName extends keyof ContactDetails>(
    name: TName,
    value: ContactDetails[TName],
  ) {
    form.setValue(`contact.${name}`, value as never, {
      shouldDirty: true,
      shouldTouch: true,
      shouldValidate: true,
    });
  }

  function applyChoice(
    nextMainChoice: ContactMainChoice,
    nextSelectedActions: ContactAction[] = [],
    nextPrimaryAction?: ContactAction | "",
  ) {
    const { formType, formOptions } = getFormValues(
      nextMainChoice,
      nextSelectedActions,
    );

    setContactValue("formType", formType);
    setContactValue("formOptions", formOptions);
    setContactValue(
      "selectedActions",
      getSelectedActions(nextMainChoice, nextSelectedActions),
    );

    if (nextPrimaryAction !== undefined) {
      setContactValue("primaryAction", nextPrimaryAction);
      return;
    }

    setContactValue(
      "primaryAction",
      nextMainChoice === "multiple" ? "" : nextMainChoice,
    );
  }

  function handleExtraRequestChange(
    option: ContactAction,
    checked: boolean,
  ) {
    if (mainChoice !== "multiple") return;

    const nextOptions = checked
      ? [...selectedContactOptions, option]
      : selectedContactOptions.filter((item) => item !== option);
    const orderedOptions = contactActionOptions
      .map((requestOption) => requestOption.id)
      .filter((id) => nextOptions.includes(id));
    const currentPrimary = form.getValues("contact.primaryAction");
    const nextPrimary = orderedOptions.includes(currentPrimary as ContactAction)
      ? currentPrimary
      : "";

    applyChoice("multiple", orderedOptions, nextPrimary as ContactAction | "");
  }

  useEffect(() => {
    if (contact.primaryAction !== normalizedPrimaryAction) {
      setContactValue("primaryAction", normalizedPrimaryAction);
    }
  }, [contact.primaryAction, normalizedPrimaryAction]);

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

      <div className="grid gap-10">
        <section data-intake-card-panel="contact-actions" className="grid gap-5">
          <div className="grid gap-2">
            <h2 className="text-xl font-normal leading-7 text-intake-text md:text-2xl md:leading-8">
              Wat moet een bezoeker vooral kunnen doen?
            </h2>
            <p className="max-w-[620px] text-base font-normal leading-6 text-intake-muted-text">
              Kies de belangrijkste actie voor de website.
            </p>
          </div>

          <RadioGroup
            value={mainChoice}
            onValueChange={(value) => applyChoice(value as ContactMainChoice)}
            aria-invalid={Boolean(actionsError || primaryActionError)}
            className="grid gap-3 md:grid-cols-2"
          >
            {mainContactOptions.map((option) => (
              <MainChoiceCard
                key={option.id}
                option={option}
                checked={mainChoice === option.id}
              />
            ))}
          </RadioGroup>

          {actionsError ? (
            <FieldError className="text-sm leading-5">
              {actionsError}
            </FieldError>
          ) : null}
        </section>

        {isMultipleChoice ? (
          <section
            data-intake-card-panel="contact-extra"
            className="grid gap-6 rounded-[12px] bg-intake-subtle px-4 py-5 md:px-5 md:py-6"
          >
            <div className="grid gap-4">
              <div className="grid gap-1">
                <h2 className="text-lg font-normal leading-7 text-intake-text">
                  Welke contactopties komen op de website?
                </h2>
                <p className="max-w-[620px] text-base font-normal leading-6 text-intake-muted-text">
                  Kies minimaal twee. Daarna kies je de belangrijkste knop.
                </p>
              </div>

              <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,220px),1fr))] gap-3">
                {contactActionOptions.map((option) => (
                  <ExtraRequestOption
                    key={option.id}
                    option={option}
                    checked={selectedContactOptions.includes(option.id)}
                    onCheckedChange={(checked) =>
                      handleExtraRequestChange(option.id, checked)
                    }
                  />
                ))}
              </div>

              {formOptionsError ? (
                <FieldError className="text-sm leading-5">
                  {formOptionsError}
                </FieldError>
              ) : null}
            </div>

            {selectedContactOptions.length >= 2 ? (
              <div className="grid gap-4 border-t border-intake-border pt-5">
                <div className="grid gap-1">
                  <h3 className="text-lg font-normal leading-7 text-intake-text">
                    Welke knop mag het meest opvallen?
                  </h3>
                  <p className="max-w-[620px] text-base font-normal leading-6 text-intake-muted-text">
                    Kies één knop als belangrijkste actie.
                  </p>
                </div>

                <RadioGroup
                  value={contact.primaryAction}
                  onValueChange={(value) =>
                    setContactValue("primaryAction", value as ContactAction)
                  }
                  aria-invalid={Boolean(primaryActionError)}
                  className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,220px),1fr))] gap-2"
                >
                  {contactActionOptions
                    .filter((option) => selectedContactOptions.includes(option.id))
                    .map((option) => (
                      <PrimaryRequestChoice
                        key={option.id}
                        option={option}
                        checked={contact.primaryAction === option.id}
                      />
                    ))}
                </RadioGroup>

                {primaryActionError ? (
                  <FieldError className="text-sm leading-5">
                    {primaryActionError}
                  </FieldError>
                ) : null}
              </div>
            ) : null}
          </section>
        ) : null}
      </div>
    </div>
  );
}
