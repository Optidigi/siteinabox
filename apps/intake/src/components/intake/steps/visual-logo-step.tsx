import { useEffect, useId, useRef, useState } from "react";
import type { DragEvent } from "react";
import type { ReactNode } from "react";
import type { UseFormReturn } from "react-hook-form";
import { ChevronLeft, UploadCloud, X } from "lucide-react";

import {
  getVisualLogoError,
  isValidLogoFile,
  type IntakeFormValues,
  type VisualDetails,
  type VisualLogoMode,
} from "@/components/intake/model";
import { Button } from "@/components/ui/button";
import { FieldError } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { cn } from "@/components/ui/utils";

function LogoModeCard({
  mode,
  title,
  description,
  checked,
  children,
}: {
  mode: Exclude<VisualLogoMode, "">;
  title: string;
  description: string;
  checked: boolean;
  children: ReactNode;
}) {
  const id = useId();

  return (
    <div
      data-state={checked ? "checked" : "unchecked"}
      className={cn(
        "relative grid gap-5 rounded-[12px] border border-intake-border bg-background p-5 transition-colors hover:border-intake-border-accent hover:bg-intake-subtle md:p-6",
        checked &&
          "border-intake-primary bg-intake-success-surface/45 shadow-[0_0_0_1px_var(--intake-primary)] hover:border-intake-primary hover:bg-intake-success-surface/45",
      )}
    >
      <div>
        <RadioGroupItem
          id={id}
          value={mode}
          className="sr-only"
        />
        <label htmlFor={id} className="grid cursor-pointer gap-1">
          <span className="text-xl font-normal leading-7 text-intake-text">
            {title}
          </span>
          <span className="text-base font-normal leading-6 text-intake-muted-text">
            {description}
          </span>
        </label>
      </div>
      {children}
    </div>
  );
}

function LogoDropzone({
  file,
  previewUrl,
  error,
  onFile,
  onRemove,
}: {
  file: File | null;
  previewUrl: string;
  error?: string;
  onFile: (file: File) => void;
  onRemove: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    const droppedFile = event.dataTransfer.files[0];
    if (droppedFile) onFile(droppedFile);
  }

  return (
    <div className="grid gap-3" onClick={(event) => event.stopPropagation()}>
      <input
        id="visual-logo-file"
        name="visual-logo-file"
        ref={inputRef}
        type="file"
        accept=".svg,.png,.jpg,.jpeg,image/svg+xml,image/png,image/jpeg"
        className="sr-only"
        tabIndex={-1}
        aria-label="Logo uploaden"
        onChange={(event) => {
          const selectedFile = event.target.files?.[0];
          if (selectedFile) onFile(selectedFile);
        }}
      />

      {file && isValidLogoFile(file) ? (
        <div className="flex flex-col gap-4 rounded-[10px] border border-intake-border bg-intake-subtle p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-4">
            {previewUrl ? (
              <div className="flex size-16 shrink-0 items-center justify-center rounded-[8px] border border-intake-border bg-background p-2">
                <img
                  src={previewUrl}
                  alt=""
                  className="max-h-full max-w-full object-contain"
                />
              </div>
            ) : null}
            <div className="min-w-0">
              <p className="truncate text-base font-normal leading-6 text-intake-text">
                {file.name}
              </p>
              <p className="text-sm leading-5 text-intake-muted-text">
                Logo geüpload
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => inputRef.current?.click()}
              className="h-10 rounded-full border-intake-border-strong bg-background px-4 text-base font-normal shadow-none hover:bg-intake-panel"
            >
              Wijzigen
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={onRemove}
              aria-label="Logo verwijderen"
              className="size-10 rounded-full text-intake-muted-text hover:bg-background hover:text-intake-primary"
            >
              <X className="size-5" strokeWidth={1.75} aria-hidden="true" />
            </Button>
          </div>
        </div>
      ) : (
        <div
          role="button"
          tabIndex={0}
          aria-label="Logo uploaden"
          onClick={() => inputRef.current?.click()}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              inputRef.current?.click();
            }
          }}
          onDragOver={(event) => event.preventDefault()}
          onDrop={handleDrop}
          className={cn(
            "grid min-h-[150px] cursor-pointer place-items-center rounded-[10px] border border-dashed border-intake-border-strong bg-intake-subtle px-4 py-8 text-center transition-colors hover:border-intake-border-accent hover:bg-background focus-visible:ring-[3px] focus-visible:ring-intake-primary/20 focus-visible:outline-none",
            error && "border-destructive bg-intake-error-surface",
          )}
        >
          <div className="grid place-items-center gap-2">
            <UploadCloud
              className="size-8 text-intake-text"
              strokeWidth={1.5}
              aria-hidden="true"
            />
            <div>
              <p className="text-base font-normal leading-6 text-intake-text">
                Sleep je logo hierheen of klik om te uploaden
              </p>
              <p className="text-sm leading-5 text-intake-muted-text">
                SVG, PNG of JPG
              </p>
            </div>
          </div>
        </div>
      )}
      {error ? <FieldError className="text-sm leading-5">{error}</FieldError> : null}
    </div>
  );
}

export function VisualLogoStep({
  form,
  showAttemptedErrors,
  onBack,
}: {
  form: UseFormReturn<IntakeFormValues>;
  showAttemptedErrors: boolean;
  onBack: () => void;
}) {
  const visual = form.watch("visual");
  const companyName = form.watch("company.companyName");
  const [previewUrl, setPreviewUrl] = useState("");
  const logoTextPrefilledRef = useRef(false);
  const logoTextTouchedRef = useRef(false);
  const modeError = showAttemptedErrors
    ? getVisualLogoError("mode", visual)
    : "";
  const fileError = showAttemptedErrors
    ? getVisualLogoError("file", visual)
    : "";
  const textError = showAttemptedErrors
    ? getVisualLogoError("text", visual)
    : "";

  function setLogoValue<TName extends keyof VisualDetails["logo"]>(
    name: TName,
    value: VisualDetails["logo"][TName],
  ) {
    form.setValue(`visual.logo.${name}`, value as never, {
      shouldDirty: true,
      shouldTouch: true,
      shouldValidate: true,
    });
  }

  useEffect(() => {
    if (logoTextPrefilledRef.current) return;
    if (logoTextTouchedRef.current) return;
    if (visual.logo.text.trim()) {
      logoTextPrefilledRef.current = true;
      return;
    }
    if (!companyName.trim()) return;

    setLogoValue("text", companyName);
    logoTextPrefilledRef.current = true;
  }, [companyName, visual.logo.text]);

  useEffect(() => {
    if (!visual.logo.file || !isValidLogoFile(visual.logo.file)) {
      setPreviewUrl("");
      return;
    }

    const nextPreviewUrl = URL.createObjectURL(visual.logo.file);
    setPreviewUrl(nextPreviewUrl);

    return () => URL.revokeObjectURL(nextPreviewUrl);
  }, [visual.logo.file]);

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

      <section data-intake-card-panel="visual-logo" className="grid gap-5">
        <h2 className="text-xl font-normal leading-7 text-intake-text md:text-2xl md:leading-8">
          Welk logo gebruiken we?
        </h2>
        <RadioGroup
          value={visual.logo.mode}
          onValueChange={(value) => {
            setLogoValue("mode", value as VisualLogoMode);
          }}
          aria-invalid={Boolean(modeError)}
          className="grid gap-4"
        >
          <LogoModeCard
            mode="uploaded"
            title="Logo uploaden"
            description="Gebruik je eigen logo."
            checked={visual.logo.mode === "uploaded"}
          >
            <LogoDropzone
              file={visual.logo.file}
              previewUrl={previewUrl}
              error={visual.logo.mode === "uploaded" ? fileError : ""}
              onFile={(file) => {
                setLogoValue("mode", "uploaded");
                setLogoValue("file", file);
              }}
              onRemove={() => setLogoValue("file", null)}
            />
          </LogoModeCard>

          <LogoModeCard
            mode="textlogo"
            title="Tekstlogo gebruiken"
            description="We gebruiken tekst als logo."
            checked={visual.logo.mode === "textlogo"}
          >
            {visual.logo.mode === "textlogo" ? (
              <div
                className="grid gap-4"
                onClick={(event) => event.stopPropagation()}
              >
                <div className="grid gap-2">
                  <label
                    htmlFor="visual-logo-text"
                    className="text-base font-normal leading-6 text-intake-text"
                  >
                    Tekst op je logo
                  </label>
                  <Input
                    id="visual-logo-text"
                    name="visual-logo-text"
                    value={visual.logo.text}
                    onChange={(event) => {
                      logoTextTouchedRef.current = true;
                      setLogoValue("text", event.target.value);
                    }}
                    aria-invalid={Boolean(textError)}
                    className="h-12 rounded-[8px] border-intake-border-strong bg-background px-4 text-base font-normal leading-6 text-intake-text shadow-none placeholder:text-intake-placeholder focus-visible:ring-intake-primary/20"
                  />
                  {textError ? (
                    <FieldError className="text-sm leading-5">
                      {textError}
                    </FieldError>
                  ) : null}
                </div>
                <div className="grid gap-2">
                  <p className="text-base font-normal leading-6 text-intake-text">
                    Voorbeeld
                  </p>
                  <div className="rounded-[10px] border border-intake-border bg-intake-subtle px-6 py-8">
                    <p className="truncate text-[clamp(1.8rem,4vw,3rem)] font-semibold leading-tight text-intake-text">
                      {visual.logo.text || "Jouw bedrijfsnaam"}
                    </p>
                  </div>
                </div>
              </div>
            ) : null}
          </LogoModeCard>
        </RadioGroup>
        {modeError ? (
          <FieldError className="text-sm leading-5">{modeError}</FieldError>
        ) : null}
      </section>
    </div>
  );
}
