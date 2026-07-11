import type { UseFormReturn } from "react-hook-form";
import { ChevronLeft } from "lucide-react";

import {
  getFinalDetailsError,
  intakeLegalStatements,
  type IntakeFormValues,
} from "@/components/intake/model";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { OptionalMarker } from "./shared/field-support";

export function FinalDetailsStep({
  form,
  showAttemptedErrors,
  onBack,
}: {
  form: UseFormReturn<IntakeFormValues>;
  showAttemptedErrors: boolean;
  onBack: () => void;
}) {
  const finalDetails = form.watch("finalDetails");
  const nameError = showAttemptedErrors
    ? getFinalDetailsError("name", finalDetails)
    : "";
  const emailError = showAttemptedErrors
    ? getFinalDetailsError("email", finalDetails)
    : "";
  const phoneError = showAttemptedErrors
    ? getFinalDetailsError("phone", finalDetails)
    : "";
  const businessUseAccepted = form.watch("legal.businessUseAccepted");
  const businessUseError =
    showAttemptedErrors && !businessUseAccepted
      ? "Bevestig dat je de aanvraag zakelijk doet."
      : "";
  const termsAccepted = form.watch("legal.termsAccepted");
  const termsError =
    showAttemptedErrors && !termsAccepted
      ? "Accepteer de algemene voorwaarden om je aanvraag te versturen."
      : "";

  return (
    <div className="w-full max-w-[780px]">
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

      <Card
        data-intake-card-panel="final-details"
        className="gap-0 rounded-[8px] border-intake-border bg-background px-6 py-7 shadow-none md:px-8 md:py-8"
      >
        <CardHeader className="px-0 pb-6">
          <CardTitle className="text-xl font-normal leading-7 text-intake-text md:text-2xl md:leading-8">
            Waar mogen we je bereiken?
          </CardTitle>
        </CardHeader>
        <CardContent className="px-0">
          <FieldGroup className="gap-6">
            <Field data-invalid={Boolean(nameError)}>
              <FieldLabel
                htmlFor="final-name"
                className="text-base font-normal leading-6 text-intake-text"
              >
                Naam
              </FieldLabel>
              <Input
                id="final-name"
                type="text"
                autoComplete="name"
                placeholder="Je naam"
                aria-invalid={Boolean(nameError)}
                className="h-14 rounded-[8px] border-intake-border-strong px-4 text-base font-normal leading-6 text-intake-text shadow-none placeholder:text-intake-muted-text focus-visible:ring-intake-primary/20 md:h-[58px]"
                {...form.register("finalDetails.name")}
              />
              <FieldError className="text-sm leading-5">{nameError}</FieldError>
            </Field>

            <Field data-invalid={Boolean(emailError)}>
              <FieldLabel
                htmlFor="final-email"
                className="text-base font-normal leading-6 text-intake-text"
              >
                E-mailadres
              </FieldLabel>
              <Input
                id="final-email"
                type="email"
                inputMode="email"
                autoComplete="email"
                placeholder="naam@voorbeeld.nl"
                aria-invalid={Boolean(emailError)}
                className="h-14 rounded-[8px] border-intake-border-strong px-4 text-base font-normal leading-6 text-intake-text shadow-none placeholder:text-intake-muted-text focus-visible:ring-intake-primary/20 md:h-[58px]"
                {...form.register("finalDetails.email")}
              />
              <FieldError className="text-sm leading-5">{emailError}</FieldError>
            </Field>

            <Field data-invalid={Boolean(phoneError)}>
              <FieldLabel
                htmlFor="final-phone"
                className="flex w-full items-baseline justify-between gap-4 text-base font-normal leading-6 text-intake-text"
              >
                Telefoonnummer
                <OptionalMarker />
              </FieldLabel>
              <Input
                id="final-phone"
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                placeholder="06 12345678"
                aria-invalid={Boolean(phoneError)}
                className="h-14 rounded-[8px] border-intake-border-strong px-4 text-base font-normal leading-6 text-intake-text shadow-none placeholder:text-intake-muted-text focus-visible:ring-intake-primary/20 md:h-[58px]"
                {...form.register("finalDetails.phone")}
              />
              <FieldError className="text-sm leading-5">{phoneError}</FieldError>
            </Field>

            <div className="border-t border-intake-border pt-6">
              <Field data-invalid={Boolean(businessUseError)}>
                <div className="flex items-start gap-3">
                  <Checkbox
                    id="business-use-declaration"
                    checked={businessUseAccepted}
                    onCheckedChange={(checked) =>
                      form.setValue(
                        "legal.businessUseAccepted",
                        checked === true,
                        {
                          shouldDirty: true,
                          shouldTouch: true,
                          shouldValidate: true,
                        },
                      )
                    }
                    aria-invalid={Boolean(businessUseError)}
                    aria-describedby="business-use-helper"
                    className="mt-1 size-5"
                  />
                  <div>
                    <FieldLabel
                      htmlFor="business-use-declaration"
                      className="cursor-pointer text-base font-normal leading-6 text-intake-text"
                    >
                      {intakeLegalStatements.businessUse.text}
                    </FieldLabel>
                    <p
                      id="business-use-helper"
                      className="mt-1 text-sm leading-5 text-intake-muted-text"
                    >
                      Site in a Box is bedoeld voor zakelijk gebruik.
                    </p>
                  </div>
                </div>
                <FieldError className="text-sm leading-5">
                  {businessUseError}
                </FieldError>
              </Field>

              <Field className="mt-6" data-invalid={Boolean(termsError)}>
                <div className="flex items-start gap-3">
                  <Checkbox
                    id="terms-acceptance"
                    checked={termsAccepted}
                    onCheckedChange={(checked) =>
                      form.setValue("legal.termsAccepted", checked === true, {
                        shouldDirty: true,
                        shouldTouch: true,
                        shouldValidate: true,
                      })
                    }
                    aria-invalid={Boolean(termsError)}
                    aria-labelledby="terms-acceptance-label"
                    aria-describedby="terms-acceptance-helper"
                    className="mt-1 size-5"
                  />
                  <div>
                    <p id="terms-acceptance-label" className="text-base font-normal leading-6 text-intake-text">
                      <FieldLabel
                        htmlFor="terms-acceptance"
                        className="inline cursor-pointer text-base font-normal leading-6 text-intake-text"
                      >
                        Ik ga akkoord met de
                      </FieldLabel>{" "}
                      <a
                        href={intakeLegalStatements.terms.url}
                        target="_blank"
                        rel="noreferrer"
                        className="underline underline-offset-2 hover:text-intake-primary"
                      >
                        algemene voorwaarden
                      </a>{" "}
                      van Site in a Box.
                    </p>
                    <p id="terms-acceptance-helper" className="mt-1 text-sm leading-5 text-intake-muted-text">
                      De voorwaarden openen in een nieuw tabblad.
                    </p>
                  </div>
                </div>
                <FieldError className="text-sm leading-5">{termsError}</FieldError>
              </Field>

              <Field className="mt-6">
                <div className="flex items-start gap-3">
                  <Checkbox
                    id="marketing-opt-in"
                    checked={form.watch("legal.marketingOptIn")}
                    onCheckedChange={(checked) =>
                      form.setValue("legal.marketingOptIn", checked === true, {
                        shouldDirty: true,
                        shouldTouch: true,
                        shouldValidate: true,
                      })
                    }
                    aria-describedby="marketing-opt-in-helper"
                    className="mt-1 size-5"
                  />
                  <div>
                    <FieldLabel
                      htmlFor="marketing-opt-in"
                      className="cursor-pointer text-base font-normal leading-6 text-intake-text"
                    >
                      {intakeLegalStatements.marketing.text}
                    </FieldLabel>
                    <p
                      id="marketing-opt-in-helper"
                      className="mt-1 text-sm leading-5 text-intake-muted-text"
                    >
                      Je kunt je altijd uitschrijven.
                    </p>
                  </div>
                </div>
              </Field>

              <p className="mt-6 text-sm leading-5 text-intake-muted-text">
                Wij gebruiken je gegevens om je aanvraag te behandelen, zoals
                beschreven in onze{" "}
                <a
                  href={intakeLegalStatements.privacyNotice.url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-intake-text underline underline-offset-2 hover:text-intake-primary"
                >
                  privacy- en cookieverklaring
                </a>
                .
              </p>
            </div>
          </FieldGroup>
        </CardContent>
      </Card>
    </div>
  );
}
