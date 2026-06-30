import { FieldDescription, FieldError } from "@/components/ui/field";
import { cn } from "@/components/ui/utils";

export function OptionalMarker() {
  return <span className="text-intake-muted-text">optioneel</span>;
}

function shouldShowCounter(value: string, max: number, force = false) {
  if (force) return true;
  if (!value) return false;

  return value.length >= Math.floor(max * 0.75);
}

export function FieldSupport({
  helper,
  error,
  value = "",
  max,
  showCounter = false,
}: {
  helper?: string;
  error?: string;
  value?: string;
  max?: number;
  showCounter?: boolean;
}) {
  const overLimit = typeof max === "number" && value.length > max;
  const counterVisible =
    typeof max === "number" &&
    shouldShowCounter(value, max, showCounter || overLimit);

  if (!helper && !error && !counterVisible) return null;

  return (
    <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
      <div className="min-w-0">
        {error ? (
          <FieldError className="text-sm leading-5">{error}</FieldError>
        ) : helper ? (
          <FieldDescription className="text-sm leading-5 text-intake-muted-text">
            {helper}
          </FieldDescription>
        ) : null}
      </div>
      {counterVisible ? (
        <p
          className={cn(
            "shrink-0 text-right text-sm leading-5 text-intake-muted-text",
            overLimit && "text-destructive",
          )}
          aria-live="polite"
        >
          {value.length} / {max}
        </p>
      ) : null}
    </div>
  );
}
