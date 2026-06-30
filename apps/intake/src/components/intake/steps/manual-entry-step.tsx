import { useEffect } from "react";
import { useFormContext } from "react-hook-form";
import { ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  manualCompanyFormId,
  manualCompanySchema,
  type IntakeFormValues,
  type ManualCompanyFormValues,
} from "@/components/intake/model";
import { OptionalMarker } from "./shared/field-support";

export function ManualEntryStep({
  onCanContinueChange,
  onBack,
  onSubmit,
}: {
  onCanContinueChange: (canContinue: boolean) => void;
  onBack: () => void;
  onSubmit: (values: ManualCompanyFormValues) => void;
}) {
  const form = useFormContext<IntakeFormValues>();
  const companyNameValue = form.watch("company.companyName");
  const kvkNumberValue = form.watch("company.kvkNumber");
  const addressValue = form.watch("company.address");
  const companyErrors = form.formState.errors.company;

  useEffect(() => {
    const nextValues = {
      companyName: companyNameValue ?? "",
      kvkNumber: kvkNumberValue ?? "",
      address: addressValue ?? "",
    };

    onCanContinueChange(manualCompanySchema.safeParse(nextValues).success);
  }, [addressValue, companyNameValue, kvkNumberValue, onCanContinueChange]);

  function handleSubmit(event: { preventDefault: () => void }) {
    event.preventDefault();

    const values = {
      companyName: form.getValues("company.companyName"),
      kvkNumber: form.getValues("company.kvkNumber"),
      address: form.getValues("company.address"),
    };
    const result = manualCompanySchema.safeParse(values);

    if (!result.success) {
      void form.trigger([
        "company.companyName",
        "company.kvkNumber",
        "company.address",
      ]);
      return;
    }

    onSubmit(result.data);
  }

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

      <Card className="gap-0 rounded-[8px] border-intake-border bg-background px-6 py-7 shadow-none md:px-8 md:py-8">
        <CardHeader className="px-0 pb-6">
          <CardTitle className="text-xl font-normal leading-7 text-intake-text md:text-2xl md:leading-8">
            Bedrijfsgegevens
          </CardTitle>
        </CardHeader>
        <CardContent className="px-0">
          <form id={manualCompanyFormId} onSubmit={handleSubmit} noValidate>
            <FieldGroup className="gap-6">
              <Field data-invalid={Boolean(companyErrors?.companyName)}>
                <FieldLabel
                  htmlFor="manual-company-name"
                  className="text-base font-normal leading-6 text-intake-text"
                >
                  Bedrijfsnaam
                </FieldLabel>
                <Input
                  id="manual-company-name"
                  type="text"
                  autoComplete="organization"
                  placeholder="Bijvoorbeeld: Janssen Schilderwerken"
                  aria-invalid={Boolean(companyErrors?.companyName)}
                  className="h-14 rounded-[8px] border-intake-border-strong px-4 text-base font-normal leading-6 text-intake-text shadow-none placeholder:text-intake-muted-text focus-visible:ring-intake-primary/20 md:h-[58px]"
                  {...form.register("company.companyName")}
                />
                <FieldError className="text-sm leading-5">
                  {companyErrors?.companyName?.message}
                </FieldError>
              </Field>

              <Field data-invalid={Boolean(companyErrors?.kvkNumber)}>
                <FieldLabel
                  htmlFor="manual-kvk-number"
                  className="flex w-full items-baseline justify-between gap-4 text-base font-normal leading-6 text-intake-text"
                >
                  KVK-nummer
                  <OptionalMarker />
                </FieldLabel>
                <Input
                  id="manual-kvk-number"
                  type="text"
                  inputMode="numeric"
                  autoComplete="off"
                  placeholder="12345678"
                  aria-invalid={Boolean(companyErrors?.kvkNumber)}
                  className="h-14 rounded-[8px] border-intake-border-strong px-4 text-base font-normal leading-6 text-intake-text shadow-none placeholder:text-intake-muted-text focus-visible:ring-intake-primary/20 md:h-[58px]"
                  {...form.register("company.kvkNumber")}
                />
                <FieldError className="text-sm leading-5">
                  {companyErrors?.kvkNumber?.message}
                </FieldError>
              </Field>

              <Field data-invalid={Boolean(companyErrors?.address)}>
                <FieldLabel
                  htmlFor="manual-address"
                  className="flex w-full items-baseline justify-between gap-4 text-base font-normal leading-6 text-intake-text"
                >
                  Bezoekadres
                  <OptionalMarker />
                </FieldLabel>
                <Input
                  id="manual-address"
                  type="text"
                  autoComplete="street-address"
                  placeholder="Straat 12, 1234 AB Plaats"
                  aria-invalid={Boolean(companyErrors?.address)}
                  className="h-14 rounded-[8px] border-intake-border-strong px-4 text-base font-normal leading-6 text-intake-text shadow-none placeholder:text-intake-muted-text focus-visible:ring-intake-primary/20 md:h-[58px]"
                  {...form.register("company.address")}
                />
                <FieldDescription className="text-sm leading-5 text-intake-muted-text">
                  Je bepaalt later of dit zichtbaar wordt op je website.
                </FieldDescription>
                <FieldError className="text-sm leading-5">
                  {companyErrors?.address?.message}
                </FieldError>
              </Field>
            </FieldGroup>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
