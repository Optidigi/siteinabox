import type { ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import {
  AccordionContent,
  AccordionHeader,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Card } from "@/components/ui/card";
import { cn } from "@/components/ui/utils";

export type CanvasCardTone = "neutral" | "success" | "error";

export function CanvasStatusBadge({
  children,
  tone = "neutral",
}: {
  children: string;
  tone?: CanvasCardTone;
}) {
  return (
    <span
      className={cn(
        "shrink-0 rounded-full px-3 py-1 text-sm font-normal leading-5",
        tone === "success" && "bg-intake-success-surface text-intake-primary",
        tone === "error" && "bg-intake-error-surface text-destructive",
        tone === "neutral" && "bg-intake-panel text-intake-muted-text",
      )}
    >
      {children}
    </span>
  );
}

export function CanvasAccordionCard({
  value,
  title,
  purpose,
  statusLabel,
  statusTone,
  summary,
  panelId,
  children,
}: {
  value: string;
  title: string;
  purpose: string;
  statusLabel: string;
  statusTone: CanvasCardTone;
  summary?: string;
  panelId: string;
  children: ReactNode;
}) {
  const summaryId = `${panelId}-summary`;
  const purposeId = `${panelId}-purpose`;

  return (
    <AccordionItem value={value} className="group/intake-card border-0">
      <Card
        className={cn(
          "gap-0 overflow-hidden rounded-[8px] border-intake-border bg-background p-0 shadow-none transition-colors group-data-[state=open]/intake-card:border-intake-border-strong",
          statusTone === "error" &&
            "border-destructive/55 group-data-[state=open]/intake-card:border-destructive/70",
        )}
      >
        <AccordionHeader>
          <AccordionTrigger
            aria-describedby={purposeId}
            className="group flex w-full cursor-pointer items-start justify-between gap-4 px-6 py-5 text-left transition-colors hover:bg-intake-subtle focus-visible:ring-[3px] focus-visible:ring-intake-primary/20 focus-visible:outline-none md:px-8 [&[data-state=open]>span>svg]:rotate-180"
          >
            <span className="min-w-0">
              <span className="block text-lg font-normal leading-7 text-intake-text">
                {title}
              </span>
              <span
                id={purposeId}
                className="mt-1 block text-base font-normal leading-6 text-intake-muted-text"
              >
                {purpose}
              </span>
              {summary ? (
                <span
                  id={summaryId}
                  aria-hidden="true"
                  className="mt-3 block text-sm leading-5 text-intake-muted-text group-data-[state=open]:hidden"
                >
                  {summary}
                </span>
              ) : null}
            </span>
            <span className="flex shrink-0 items-center gap-3">
              <CanvasStatusBadge tone={statusTone}>
                {statusLabel}
              </CanvasStatusBadge>
              <ChevronDown
                className="mt-1 size-5 text-intake-muted-text transition-transform"
                strokeWidth={1.75}
                aria-hidden="true"
              />
            </span>
          </AccordionTrigger>
        </AccordionHeader>
        <AccordionContent>
          <div
            data-intake-card-panel={panelId}
            className="border-t border-intake-divider px-6 py-6 md:px-8"
          >
            {children}
          </div>
        </AccordionContent>
      </Card>
    </AccordionItem>
  );
}
