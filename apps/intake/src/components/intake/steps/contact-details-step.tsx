import { ChevronLeft } from "lucide-react";
import { useEffect, type ReactNode } from "react";
import type { UseFormReturn } from "react-hook-form";
import {
  availabilityOptions,
  getContactDetailsError,
  getNextLocationOptions,
  hasContactLocationOption,
  needsContactWhatsappNumber,
  needsContactWhatsappMode,
  type ContactAvailabilityMode,
  type ContactDetails,
  type ContactLocationOption,
  type ContactWhatsappMode,
  type IntakeFormValues,
} from "@/components/intake/model";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/components/ui/utils";

type ChoiceOption<TValue extends string> = {
  id: TValue;
  title: string;
  description?: string;
};

const locationOptions: ChoiceOption<ContactLocationOption>[] = [
  {
    id: "region",
    title: "Plaats of regio tonen",
    description: "Bijvoorbeeld: Utrecht en omgeving.",
  },
  {
    id: "address",
    title: "Bezoekadres tonen",
    description: "Als bezoekers naar je locatie mogen komen.",
  },
  {
    id: "none",
    title: "Geen locatie tonen",
    description: "Als locatie niet belangrijk is voor je website.",
  },
];

function Section({
  id,
  title,
  helper,
  children,
  divided = true,
}: {
  id: string;
  title: string;
  helper?: string;
  children: ReactNode;
  divided?: boolean;
}) {
  return (
    <section
      data-intake-card-panel={id}
      className={cn("grid gap-5", divided && "border-t border-intake-border pt-8")}
    >
      <div className="grid gap-1.5">
        <h2 className="text-xl font-normal leading-7 text-intake-text md:text-2xl md:leading-8">
          {title}
        </h2>
        {helper ? (
          <p className="max-w-[620px] text-base font-normal leading-6 text-intake-muted-text">
            {helper}
          </p>
        ) : null}
      </div>
      {children}
    </section>
  );
}

function TextInputField({
  id,
  label,
  value,
  onChange,
  error,
  placeholder,
  inputMode,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  placeholder?: string;
  inputMode?: "text" | "tel";
}) {
  return (
    <div className="grid gap-2">
      <label
        htmlFor={id}
        className="text-base font-normal leading-6 text-intake-text"
      >
        {label}
      </label>
      <Input
        id={id}
        value={value}
        inputMode={inputMode}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        aria-invalid={Boolean(error)}
        className="h-14 rounded-[8px] border-intake-border-strong bg-background px-4 text-base font-normal leading-6 text-intake-text shadow-none placeholder:text-intake-placeholder md:text-base"
      />
      {error ? <FieldError className="text-sm leading-5">{error}</FieldError> : null}
    </div>
  );
}

function TextareaField({
  id,
  label,
  value,
  onChange,
  error,
  placeholder,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  placeholder?: string;
}) {
  return (
    <div className="grid gap-2">
      <label
        htmlFor={id}
        className="text-base font-normal leading-6 text-intake-text"
      >
        {label}
      </label>
      <Textarea
        id={id}
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        aria-invalid={Boolean(error)}
        className="min-h-[112px] rounded-[8px] border-intake-border-strong bg-background px-4 py-3 text-base font-normal leading-6 text-intake-text shadow-none placeholder:text-intake-placeholder md:text-base"
      />
      {error ? <FieldError className="text-sm leading-5">{error}</FieldError> : null}
    </div>
  );
}

function RadioChoiceRow<TValue extends string>({
  option,
  checked,
}: {
  option: ChoiceOption<TValue>;
  checked: boolean;
}) {
  return (
    <FieldLabel
      className={cn(
        "flex min-h-14 w-full cursor-pointer items-center rounded-[10px] border border-intake-border bg-background px-4 text-left transition-colors hover:border-intake-border-accent hover:bg-intake-subtle focus-within:ring-[3px] focus-within:ring-intake-primary/20 has-data-[state=checked]:border-[var(--intake-primary)] has-data-[state=checked]:bg-[var(--intake-success-surface)]",
        checked &&
          "border-[var(--intake-primary)] bg-[var(--intake-success-surface)] hover:border-[var(--intake-primary)] hover:bg-[var(--intake-success-surface)]",
      )}
    >
      <RadioGroupItem
        value={option.id}
        aria-label={option.title}
        className="sr-only"
      />
      <span className="grid gap-0.5">
        <span className="text-base font-normal leading-6 text-intake-text">
          {option.title}
        </span>
        {option.description ? (
          <span className="text-sm font-normal leading-5 text-intake-muted-text">
            {option.description}
          </span>
        ) : null}
      </span>
    </FieldLabel>
  );
}

function CheckboxChoiceRow({
  option,
  checked,
  onCheckedChange,
}: {
  option: ChoiceOption<ContactLocationOption>;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <FieldLabel
      className={cn(
        "flex min-h-[76px] w-full cursor-pointer items-center gap-4 rounded-[10px] border border-intake-border bg-background px-4 text-left transition-colors hover:border-intake-border-accent hover:bg-intake-subtle focus-within:ring-[3px] focus-within:ring-intake-primary/20 has-data-[state=checked]:border-[var(--intake-primary)] has-data-[state=checked]:bg-[var(--intake-success-surface)]",
        checked &&
          "border-[var(--intake-primary)] bg-[var(--intake-success-surface)] hover:border-[var(--intake-primary)] hover:bg-[var(--intake-success-surface)]",
      )}
    >
      <Checkbox
        checked={checked}
        onCheckedChange={(value) => onCheckedChange(Boolean(value))}
        aria-label={option.title}
        className="size-5 rounded-[5px] border-intake-border-strong data-[state=checked]:border-[var(--intake-primary)] data-[state=checked]:bg-[var(--intake-primary)]"
      />
      <span className="grid gap-0.5">
        <span className="text-base font-normal leading-6 text-intake-text">
          {option.title}
        </span>
        {option.description ? (
          <span className="text-sm font-normal leading-5 text-intake-muted-text">
            {option.description}
          </span>
        ) : null}
      </span>
    </FieldLabel>
  );
}

const whatsappNumberModeOptions: ChoiceOption<Exclude<ContactWhatsappMode, "" | "none">>[] =
  [
    {
      id: "same",
      title: "Zelfde nummer",
    },
    {
      id: "other",
      title: "Ander nummer",
    },
  ];

function WhatsappNumberModeChoice({
  value,
  onValueChange,
  error,
}: {
  value: ContactWhatsappMode;
  onValueChange: (value: Exclude<ContactWhatsappMode, "" | "none">) => void;
  error?: string;
}) {
  return (
    <div className="grid gap-2">
      <p className="text-base font-normal leading-6 text-intake-text">
        WhatsApp gebruikt
      </p>
      <RadioGroup
        value={value}
        onValueChange={(nextValue) =>
          onValueChange(nextValue as Exclude<ContactWhatsappMode, "" | "none">)
        }
        aria-invalid={Boolean(error)}
        className="grid gap-2 sm:grid-cols-2"
      >
        {whatsappNumberModeOptions.map((option) => (
          <RadioChoiceRow
            key={option.id}
            option={option}
            checked={value === option.id}
          />
        ))}
      </RadioGroup>
      {error ? <FieldError className="text-sm leading-5">{error}</FieldError> : null}
    </div>
  );
}

export function ContactDetailsStep({
  form,
  showAttemptedErrors,
  onBack,
}: {
  form: UseFormReturn<IntakeFormValues>;
  showAttemptedErrors: boolean;
  onBack: () => void;
}) {
  const contact = form.watch("contact");
  const showsPhone = contact.selectedActions.includes("phone");
  const showsWhatsapp = contact.selectedActions.includes("whatsapp");
  const showsDirectSection = showsPhone || showsWhatsapp;
  const phoneError = showAttemptedErrors
    ? getContactDetailsError("phoneNumber", contact)
    : "";
  const whatsappNumberError = showAttemptedErrors
    ? getContactDetailsError("whatsappNumber", contact)
    : "";
  const whatsappModeError = showAttemptedErrors
    ? getContactDetailsError("whatsappMode", contact)
    : "";
  const locationOptionsError = showAttemptedErrors
    ? getContactDetailsError("locationOptions", contact)
    : "";
  const regionError = showAttemptedErrors
    ? getContactDetailsError("publicRegion", contact)
    : "";
  const addressError = showAttemptedErrors
    ? getContactDetailsError("publicAddress", contact)
    : "";
  const availabilityModeError = showAttemptedErrors
    ? getContactDetailsError("availabilityMode", contact)
    : "";
  const openingHoursError = showAttemptedErrors
    ? getContactDetailsError("openingHours", contact)
    : "";

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

  function setLocationOption(option: ContactLocationOption, checked: boolean) {
    setContactValue(
      "locationOptions",
      getNextLocationOptions(contact.locationOptions, option, checked),
    );
  }

  useEffect(() => {
    if (showsPhone && showsWhatsapp && !contact.whatsappMode) {
      setContactValue("whatsappMode", "same");
    }
  }, [contact.whatsappMode, showsPhone, showsWhatsapp]);

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

      <div className="grid gap-9">
        {showsDirectSection ? (
          <Section
            id="contact-details-direct"
            title="Telefoon en WhatsApp"
            helper="Vul alleen nummers in die zichtbaar mogen zijn op de website."
            divided={false}
          >
            <div className="grid gap-5">
              {showsPhone ? (
                <TextInputField
                  id="contact-phone"
                  label="Telefoonnummer"
                  value={contact.phoneNumber}
                  placeholder="Bijvoorbeeld: 06 12345678"
                  inputMode="tel"
                  error={phoneError}
                  onChange={(value) => setContactValue("phoneNumber", value)}
                />
              ) : null}

              {showsWhatsapp ? (
                <div className="grid gap-4">
                  {needsContactWhatsappMode(contact) ? (
                    <WhatsappNumberModeChoice
                      value={contact.whatsappMode}
                      error={whatsappModeError}
                      onValueChange={(value) =>
                        setContactValue("whatsappMode", value)
                      }
                    />
                  ) : null}

                  {needsContactWhatsappNumber(contact) ? (
                    <TextInputField
                      id="contact-whatsapp"
                      label="WhatsApp-nummer"
                      value={contact.whatsappNumber}
                      placeholder="Bijvoorbeeld: 06 12345678"
                      inputMode="tel"
                      error={whatsappNumberError}
                      onChange={(value) =>
                        setContactValue("whatsappNumber", value)
                      }
                    />
                  ) : null}
                </div>
              ) : null}
            </div>
          </Section>
        ) : null}

        <Section
          id="contact-details-location"
          title="Locatie of werkgebied"
          helper="Kies wat bezoekers over je locatie mogen zien."
          divided={showsDirectSection}
        >
          <div className="grid gap-4">
            <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,260px),1fr))] gap-3">
              {locationOptions.map((option) => (
                <CheckboxChoiceRow
                  key={option.id}
                  option={option}
                  checked={hasContactLocationOption(contact, option.id)}
                  onCheckedChange={(checked) =>
                    setLocationOption(option.id, checked)
                  }
                />
              ))}
            </div>
            {locationOptionsError ? (
              <FieldError className="text-sm leading-5">
                {locationOptionsError}
              </FieldError>
            ) : null}

            {hasContactLocationOption(contact, "region") ? (
              <TextInputField
                id="contact-region"
                label="Plaats of regio"
                value={contact.publicRegion}
                placeholder="Bijvoorbeeld: Utrecht en omgeving"
                error={regionError}
                onChange={(value) => setContactValue("publicRegion", value)}
              />
            ) : null}

            {hasContactLocationOption(contact, "address") ? (
              <TextInputField
                id="contact-address"
                label="Bezoekadres"
                value={contact.publicAddress}
                placeholder="Straatnaam 12, 1234 AB Plaats"
                error={addressError}
                onChange={(value) => setContactValue("publicAddress", value)}
              />
            ) : null}
          </div>
        </Section>

        <Section
          id="contact-details-availability"
          title="Tijden en bereikbaarheid"
          helper="Kies alleen wat op de contactpagina moet staan."
        >
          <div className="grid gap-4">
            <RadioGroup
              value={contact.availabilityMode}
              onValueChange={(value) =>
                setContactValue(
                  "availabilityMode",
                  value as ContactAvailabilityMode,
                )
              }
              aria-invalid={Boolean(availabilityModeError)}
              className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,220px),1fr))] gap-2"
            >
              {availabilityOptions.map((option) => (
                <RadioChoiceRow
                  key={option.id}
                  option={option}
                  checked={contact.availabilityMode === option.id}
                />
              ))}
            </RadioGroup>
            {availabilityModeError ? (
              <FieldError className="text-sm leading-5">
                {availabilityModeError}
              </FieldError>
            ) : null}

            {contact.availabilityMode === "fixed" ? (
              <TextareaField
                id="contact-opening-hours"
                label="Welke tijden tonen we?"
                value={contact.openingHours}
                placeholder="Bijvoorbeeld: ma-vr 09:00-17:00"
                error={openingHoursError}
                onChange={(value) => setContactValue("openingHours", value)}
              />
            ) : null}
          </div>
        </Section>
      </div>
    </div>
  );
}
