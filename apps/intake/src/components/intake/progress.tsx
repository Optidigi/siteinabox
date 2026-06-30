import type { CSSProperties } from "react";

import { cn } from "@/components/ui/utils";

export function SegmentedProgress({
  current = 1,
  total = 6,
}: {
  current?: number;
  total?: number;
}) {
  return (
    <div
      className="hidden h-px w-full grid-cols-[repeat(var(--segments),minmax(0,1fr))] md:grid"
      role="progressbar"
      aria-label="Voortgang aanvraag"
      aria-valuemin={1}
      aria-valuemax={total}
      aria-valuenow={current}
      style={{ "--segments": total } as CSSProperties}
    >
      {Array.from({ length: total }, (_, index) => (
        <div
          key={index}
          className={cn(
            "h-px bg-intake-divider",
            index < current && "bg-intake-progress",
            index === current - 1 && "rounded-r",
          )}
        />
      ))}
    </div>
  );
}

export function LoadingDots() {
  return (
    <span className="flex w-9 items-center justify-between" aria-hidden="true">
      <span className="size-1 rounded-full bg-current opacity-40 animate-loading-dot" />
      <span className="size-1 rounded-full bg-current opacity-40 animate-loading-dot [animation-delay:120ms]" />
      <span className="size-1 rounded-full bg-current opacity-40 animate-loading-dot [animation-delay:240ms]" />
    </span>
  );
}
