import { useEffect, useState } from "react";
import { useForm, useFormContext } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery } from "@tanstack/react-query";
import {
  AlertCircle,
  ChevronLeft,
  Info,
  Pencil,
  RefreshCcw,
  Trash2,
} from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemSeparator,
  ItemTitle,
} from "@/components/ui/item";
import { Skeleton } from "@/components/ui/skeleton";
import { useMediaQuery } from "@/components/intake/hooks";
import {
  editFieldSchema,
  getCompanyDetailsFromProfile,
  getConfirmationFields,
  getKvkProfile,
  type ConfirmationField,
  type ConfirmationFieldKey,
  type EditFieldValues,
  type IntakeFormValues,
  type KvkSearchResult,
} from "@/components/intake/model";
import { cn } from "@/components/ui/utils";

function CompanyProfileSkeleton() {
  return (
    <Card className="gap-0 rounded-[12px] border-intake-border bg-background p-0 shadow-none">
      <CardHeader className="px-6 pt-7 pb-5 md:px-8 md:pt-8 md:pb-6">
        <Skeleton className="h-8 w-72 max-w-[80%] bg-intake-skeleton" />
      </CardHeader>
      <CardContent className="px-0">
        <ItemGroup>
          {Array.from({ length: 5 }, (_, index) => (
            <div key={index}>
              <Item className="rounded-none px-6 py-5 md:flex-nowrap md:px-8">
                <ItemContent className="gap-3 md:grid md:grid-cols-[190px_minmax(0,1fr)] md:items-start md:gap-6">
                  <Skeleton className="h-4 w-36 max-w-[70%] bg-intake-skeleton" />
                  <div className="grid gap-2">
                    <Skeleton className="h-4 w-64 max-w-full bg-intake-skeleton" />
                    {index > 2 ? (
                      <Skeleton className="h-4 w-52 max-w-[80%] bg-intake-skeleton" />
                    ) : null}
                  </div>
                </ItemContent>
                <ItemActions className="mt-1 basis-full md:mt-0 md:basis-auto">
                  <Skeleton className="h-4 w-20 bg-intake-skeleton" />
                </ItemActions>
              </Item>
              {index !== 4 ? (
                <ItemSeparator className="bg-intake-divider" />
              ) : null}
            </div>
          ))}
        </ItemGroup>
      </CardContent>
    </Card>
  );
}

function CompanyProfileError({
  onRetry,
  onBack,
}: {
  onRetry: () => void;
  onBack: () => void;
}) {
  return (
    <Card className="rounded-[12px] border-intake-border bg-background p-7 shadow-none md:p-8">
      <CardContent className="px-0">
        <div className="flex items-start gap-4">
          <AlertCircle
            className="mt-1 size-6 shrink-0 text-intake-muted-text"
            strokeWidth={1.75}
            aria-hidden="true"
          />
          <div className="min-w-0">
            <CardTitle className="text-2xl font-normal leading-8 text-intake-text">
              Bedrijfsgegevens ophalen lukt nu niet
            </CardTitle>
            <p className="mt-2 max-w-[520px] text-base leading-6 text-intake-muted-text">
              Probeer het opnieuw of kies een ander bedrijf.
            </p>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <Button
                type="button"
                onClick={onRetry}
                className="h-12 rounded-full bg-intake-primary px-6 text-base font-normal text-intake-primary-foreground hover:bg-intake-primary/95"
              >
                <RefreshCcw
                  className="size-4"
                  strokeWidth={1.75}
                  aria-hidden="true"
                />
                Opnieuw proberen
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={onBack}
                className="h-12 rounded-full border-intake-border-strong px-6 text-base font-normal text-intake-text shadow-none hover:bg-intake-panel"
              >
                Ander bedrijf kiezen
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function EditFieldForm({
  field,
  onSave,
  onCancel,
  className,
  compact = false,
}: {
  field: ConfirmationField | null;
  onSave: (key: ConfirmationFieldKey, value: string) => void;
  onCancel?: () => void;
  className?: string;
  compact?: boolean;
}) {
  const form = useForm<EditFieldValues>({
    resolver: zodResolver(editFieldSchema),
    values: {
      value: field?.value ?? "",
    },
  });

  function handleSubmit(values: EditFieldValues) {
    if (!field) return;

    onSave(field.key, values.value);
    onCancel?.();
  }

  return (
    <form
      onSubmit={form.handleSubmit(handleSubmit)}
      className={cn(compact ? "grid gap-3" : "mt-2 grid gap-6", className)}
    >
      <Field data-invalid={Boolean(form.formState.errors.value)}>
        <FieldLabel htmlFor="confirmation-edit-value" className="sr-only">
          {field?.label}
        </FieldLabel>
        <Input
          id="confirmation-edit-value"
          {...form.register("value")}
          className="h-14 rounded-[12px] border-intake-border-strong px-4 text-base font-normal leading-6 text-intake-text shadow-none focus-visible:ring-intake-primary/20"
          autoFocus
        />
        <FieldError className="mt-2 text-sm leading-5">
          {form.formState.errors.value?.message}
        </FieldError>
      </Field>

      <div
        className={cn(
          "flex flex-col-reverse gap-3 sm:flex-row sm:justify-end",
          compact && "sm:justify-start",
        )}
      >
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          className={cn(
            "rounded-full border-intake-border-strong px-6 text-base font-normal text-intake-text shadow-none hover:bg-intake-panel",
            compact ? "h-10" : "h-12",
          )}
        >
          Annuleren
        </Button>
        <Button
          type="submit"
          className={cn(
            "rounded-full bg-intake-primary px-6 text-base font-normal text-intake-primary-foreground hover:bg-intake-primary/95",
            compact ? "h-10" : "h-12",
          )}
        >
          Opslaan
        </Button>
      </div>
    </form>
  );
}

function DeleteFieldAction({
  field,
  onDelete,
  compact = false,
}: {
  field: ConfirmationField;
  onDelete: (key: ConfirmationFieldKey) => void;
  compact?: boolean;
}) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          aria-label={`${field.label} verwijderen`}
          className={cn(
            "rounded-full p-0 text-intake-muted-text hover:bg-transparent hover:text-intake-primary",
            compact ? "size-10 hover:bg-intake-panel" : "size-6",
          )}
        >
          <Trash2 className="size-4" strokeWidth={1.75} aria-hidden="true" />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent className="rounded-[12px] border-intake-border p-6 shadow-[0_20px_60px_rgba(35,35,35,0.14)] sm:max-w-[440px]">
        <AlertDialogHeader className="place-items-start text-left">
          <AlertDialogTitle className="text-xl font-normal leading-7 text-intake-text">
            Nevenactiviteit verwijderen?
          </AlertDialogTitle>
          <AlertDialogDescription className="text-base leading-6 text-intake-muted-text">
            We nemen deze activiteit dan niet mee als basis voor je website.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="gap-3 sm:justify-end">
          <AlertDialogCancel className="h-12 rounded-full border-intake-border-strong px-6 text-base font-normal text-intake-text shadow-none hover:bg-intake-panel">
            Annuleren
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={() => onDelete(field.key)}
            className="h-12 rounded-full bg-intake-primary px-6 text-base font-normal text-intake-primary-foreground hover:bg-intake-primary/95"
          >
            Verwijderen
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function EditFieldDrawer({
  field,
  open,
  onOpenChange,
  onSave,
}: {
  field: ConfirmationField | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (key: ConfirmationFieldKey, value: string) => void;
}) {
  function handleClose() {
    onOpenChange(false);
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="rounded-t-[16px] border-intake-border">
        <DrawerHeader className="px-6 pt-6 text-left">
          <DrawerTitle className="text-xl font-normal leading-7 text-intake-text">
            {field?.label ?? "Gegeven aanpassen"}
          </DrawerTitle>
          <DrawerDescription className="text-base leading-6 text-intake-muted-text">
            Pas dit gegeven aan als het niet klopt.
          </DrawerDescription>
        </DrawerHeader>
        <EditFieldForm
          field={field}
          onSave={onSave}
          onCancel={handleClose}
          className="px-6 pb-6"
        />
      </DrawerContent>
    </Drawer>
  );
}

function ConfirmationFieldRow({
  field,
  editing,
  onEdit,
  onCancel,
  onSave,
  onDelete,
}: {
  field: ConfirmationField;
  editing: boolean;
  onEdit: (field: ConfirmationField) => void;
  onCancel: () => void;
  onSave: (key: ConfirmationFieldKey, value: string) => void;
  onDelete: (key: ConfirmationFieldKey) => void;
}) {
  return (
    <Item className="grid gap-2 rounded-none px-6 py-4 md:min-h-[80px] md:grid-cols-[170px_minmax(0,1fr)_168px] md:items-start md:gap-x-6 md:gap-y-0 md:px-8 md:py-5">
      <div className="flex min-w-0 items-center justify-between gap-3 md:block">
        <ItemTitle className="w-full pt-0.5 text-base font-normal leading-6 text-intake-text">
          {field.label}
        </ItemTitle>
        <ItemActions className="shrink-0 gap-1 md:hidden">
          {field.editable && !editing ? (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label={`${field.label} aanpassen`}
              onClick={() => onEdit(field)}
              className="size-10 rounded-full text-intake-text hover:bg-intake-panel hover:text-intake-primary"
            >
              <Pencil
                className="size-4"
                strokeWidth={1.75}
                aria-hidden="true"
              />
            </Button>
          ) : null}
          {field.deletable && !editing ? (
            <DeleteFieldAction field={field} onDelete={onDelete} compact />
          ) : null}
        </ItemActions>
      </div>
      <div className="min-w-0">
        {editing ? (
          <EditFieldForm
            field={field}
            onSave={onSave}
            onCancel={onCancel}
            compact
          />
        ) : (
          <>
            <ItemDescription className="line-clamp-none text-base font-normal leading-6 text-intake-text text-pretty">
              {field.value}
            </ItemDescription>
            {field.helper ? (
              <p className="mt-1 text-sm leading-5 text-intake-muted-text">
                {field.helper}
              </p>
            ) : null}
          </>
        )}
      </div>
      <ItemActions className="mt-1 hidden flex-wrap justify-start gap-x-5 gap-y-2 md:mt-0 md:flex md:flex-nowrap md:justify-end md:gap-x-2">
        {field.editable && !editing ? (
          <Button
            type="button"
            variant="ghost"
            onClick={() => onEdit(field)}
            className="h-6 rounded-full px-0 text-base font-normal leading-6 text-intake-text hover:bg-transparent hover:text-intake-primary"
          >
            Aanpassen
            <Pencil className="size-4" strokeWidth={1.75} aria-hidden="true" />
          </Button>
        ) : null}
        {field.deletable && !editing ? (
          <DeleteFieldAction field={field} onDelete={onDelete} />
        ) : null}
      </ItemActions>
    </Item>
  );
}

function CompanyConfirmationCard({
  company,
  editingFieldKey,
  onEdit,
  onCancelEdit,
  onSave,
  onDelete,
}: {
  company: IntakeFormValues["company"];
  editingFieldKey: ConfirmationFieldKey | null;
  onEdit: (field: ConfirmationField) => void;
  onCancelEdit: () => void;
  onSave: (key: ConfirmationFieldKey, value: string) => void;
  onDelete: (key: ConfirmationFieldKey) => void;
}) {
  const fields = getConfirmationFields(company);

  function handleDelete(key: ConfirmationFieldKey) {
    if (!key.startsWith("activity:")) return;
    onDelete(key);
  }

  if (fields.length === 0) {
    return (
      <Card className="rounded-[12px] border-intake-border bg-background p-7 text-center shadow-none md:p-8">
        <CardTitle className="text-2xl font-normal leading-8 text-intake-text">
          Geen bruikbare bedrijfsgegevens gevonden
        </CardTitle>
        <p className="mx-auto mt-2 max-w-[460px] text-base leading-6 text-intake-muted-text">
          Vul de gegevens handmatig in om verder te gaan.
        </p>
      </Card>
    );
  }

  return (
    <Card className="gap-0 rounded-[12px] border-intake-border bg-background p-0 shadow-none">
      <CardHeader className="px-6 pt-7 pb-5 md:px-8 md:pt-8 md:pb-6">
        <CardTitle className="text-xl font-normal leading-7 text-intake-text md:text-2xl md:leading-8">
          Gevonden bedrijfsgegevens
        </CardTitle>
      </CardHeader>
      <CardContent className="px-0">
        <ItemGroup className="border-t border-intake-divider">
          {fields.map((field, index) => (
            <div key={field.key}>
              <ConfirmationFieldRow
                field={field}
                editing={editingFieldKey === field.key}
                onEdit={onEdit}
                onCancel={onCancelEdit}
                onSave={onSave}
                onDelete={handleDelete}
              />
              {index !== fields.length - 1 ? (
                <ItemSeparator className="bg-intake-divider" />
              ) : null}
            </div>
          ))}
        </ItemGroup>
      </CardContent>
    </Card>
  );
}

export function CompanyConfirmationStep({
  company,
  onBack,
}: {
  company: KvkSearchResult;
  onBack: () => void;
}) {
  const [editingField, setEditingField] = useState<ConfirmationField | null>(
    null,
  );
  const isDesktop = useMediaQuery("(min-width: 768px)");
  const form = useFormContext<IntakeFormValues>();
  const companyDetails = form.watch("company");
  const profile = useQuery({
    queryKey: ["kvk-profile", company.kvkNumber],
    queryFn: ({ signal }) => getKvkProfile(company.kvkNumber, signal),
    staleTime: 1000 * 60 * 30,
  });

  useEffect(() => {
    if (!profile.data) return;
    if (
      companyDetails.source === "kvk" &&
      companyDetails.kvkNumber === profile.data.kvkNumber
    ) {
      return;
    }

    form.setValue("company", getCompanyDetailsFromProfile(profile.data), {
      shouldDirty: false,
      shouldTouch: false,
      shouldValidate: true,
    });
  }, [companyDetails.kvkNumber, companyDetails.source, form, profile.data]);

  function saveField(key: ConfirmationFieldKey, value: string) {
    if (key === "name") {
      form.setValue("company.companyName", value, {
        shouldDirty: true,
        shouldValidate: true,
      });
    }
    if (key === "address") {
      form.setValue("company.address", value, {
        shouldDirty: true,
        shouldValidate: true,
      });
    }
    if (key === "website") {
      form.setValue("company.website", value, {
        shouldDirty: true,
        shouldValidate: true,
      });
    }
    if (key === "mainActivity") {
      form.setValue("company.mainActivity", value, {
        shouldDirty: true,
        shouldValidate: true,
      });
    }
    if (key.startsWith("activity:")) {
      const index = Number(key.split(":")[1]);
      const activities = [...form.getValues("company.secondaryActivities")];

      activities[index] = value;
      form.setValue("company.secondaryActivities", activities, {
        shouldDirty: true,
        shouldValidate: true,
      });
    }

    setEditingField(null);
  }

  function deleteField(key: ConfirmationFieldKey) {
    if (key.startsWith("activity:")) {
      const index = Number(key.split(":")[1]);
      const activities = form
        .getValues("company.secondaryActivities")
        .filter((_, itemIndex) => itemIndex !== index);

      form.setValue("company.secondaryActivities", activities, {
        shouldDirty: true,
        shouldValidate: true,
      });
    }

    if (editingField?.key === key) {
      setEditingField(null);
    }
  }

  function handleEdit(field: ConfirmationField) {
    setEditingField(field);
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

      {profile.isFetching ? <CompanyProfileSkeleton /> : null}

      {!profile.isFetching && profile.isError ? (
        <CompanyProfileError
          onRetry={() => void profile.refetch()}
          onBack={onBack}
        />
      ) : null}

      {!profile.isFetching && profile.data ? (
        <>
          <CompanyConfirmationCard
            company={companyDetails}
            editingFieldKey={isDesktop ? (editingField?.key ?? null) : null}
            onEdit={handleEdit}
            onCancelEdit={() => setEditingField(null)}
            onSave={saveField}
            onDelete={deleteField}
          />

          <div className="mt-6 flex items-start gap-4 text-intake-muted-text">
            <span className="flex size-8 shrink-0 items-center justify-center text-intake-success">
              <Info className="size-7" strokeWidth={1.75} aria-hidden="true" />
            </span>
            <p className="pt-1 text-base font-normal leading-6">
              Je bepaalt later welke informatie zichtbaar wordt op je website.
            </p>
          </div>

          <EditFieldDrawer
            field={editingField}
            open={!isDesktop && Boolean(editingField)}
            onOpenChange={(open) => {
              if (!open) setEditingField(null);
            }}
            onSave={saveField}
          />
        </>
      ) : null}
    </div>
  );
}
