import type { ReactNode } from "react";

import { FieldLabel } from "@/components/ui/field";
import { RadioGroupItem } from "@/components/ui/radio-group";
import { cn } from "@/components/ui/utils";

export function VisualRadioCard({
  value,
  checked,
  children,
  className,
  showIndicator = false,
  indicatorClassName,
}: {
  value: string;
  checked: boolean;
  children: ReactNode;
  className?: string;
  showIndicator?: boolean;
  indicatorClassName?: string;
}) {
  return (
    <FieldLabel
      className={cn(
        "relative block w-full cursor-pointer rounded-[12px] border border-intake-border bg-background text-left shadow-none transition-colors hover:border-intake-border-accent hover:bg-intake-subtle focus-within:ring-[3px] focus-within:ring-intake-primary/20",
        checked &&
          "border-intake-primary bg-background shadow-[0_0_0_1px_var(--intake-primary)] hover:border-intake-primary hover:bg-background",
        className,
      )}
    >
      <RadioGroupItem value={value} className="sr-only" />
      {showIndicator ? (
        <span
          className={cn(
            "absolute right-4 top-4 flex size-5 items-center justify-center rounded-full border border-intake-border-strong bg-background transition-colors",
            checked && "border-intake-primary",
            indicatorClassName,
          )}
          aria-hidden="true"
        >
          <span
            className={cn(
              "size-2.5 rounded-full bg-transparent transition-colors",
              checked && "bg-intake-primary",
            )}
          />
        </span>
      ) : null}
      {children}
    </FieldLabel>
  );
}
