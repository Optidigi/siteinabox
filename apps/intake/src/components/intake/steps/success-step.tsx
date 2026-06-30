import { Check } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";

export function SuccessStep() {
  return (
    <div className="w-full max-w-[780px]">
      <Card className="gap-0 rounded-[8px] border-intake-border bg-background px-6 py-8 shadow-none md:px-8 md:py-10">
        <CardContent className="px-0">
          <div className="grid gap-6">
            <div className="flex size-14 items-center justify-center rounded-full border border-intake-primary bg-intake-success-surface text-intake-primary">
              <Check className="size-7" strokeWidth={1.75} aria-hidden="true" />
            </div>

            <div className="grid gap-3">
              <h2 className="text-2xl font-normal leading-8 text-intake-text md:text-3xl md:leading-9">
                Je aanvraag is compleet.
              </h2>
              <p className="max-w-[560px] text-base font-normal leading-6 text-intake-muted-text">
                We gaan met je informatie aan de slag. Je ontvangt binnen 24 uur
                een eerste voorstel of een bericht als er nog iets ontbreekt.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
