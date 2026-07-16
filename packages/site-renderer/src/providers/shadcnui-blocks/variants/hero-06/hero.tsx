// @ts-nocheck -- pinned upstream literal with SIAB runtime-only import adaptations
import { ProviderAction, ProviderContactLink, ProviderDemoOnly, ProviderField, ProviderImage, ProviderItemField, ProviderItemLink, ProviderItems, ProviderLogo } from "../../runtime/content";
import { ArrowUpRight, CirclePlay } from "lucide-react";
import Link from "../../runtime/link";
import { BackgroundPattern } from "./background-pattern";
import { Badge } from "@siteinabox/ui/providers/shadcnui-blocks/radix-nova";
import { Button } from "@siteinabox/ui/providers/shadcnui-blocks/radix-nova";

export default function Hero() {
  return (
    <div className="flex min-h-screen items-center justify-center px-6">
      <BackgroundPattern />

      <div className="relative z-10 max-w-3xl text-center">
        <Badge
          asChild
          className="rounded-full border-border py-1"
          variant="secondary"
        >
          <span><ProviderField field="eyebrow" fallback={"Just released v1.0.0"} inline /><ArrowUpRight className="ml-1 size-4" /></span>
        </Badge>

        <h1 className="mx-auto mt-6 max-w-xl font-medium text-4xl tracking-[-0.04em] sm:text-[2.75rem] md:text-6xl/[1.2]"><ProviderField field="headline" fallback={<>
          Ship better UI without&nbsp;the&nbsp;hassle
        </>} inline /></h1>
        <p className="mx-auto mt-6 max-w-2xl text-muted-foreground text-xl md:text-2xl/normal"><ProviderField field="subheadline" fallback={<>
          Instead of starting from scratch every time, use thoughtfully designed
          blocks that give you a solid foundation for any UI.
        </>} inline /></p>
        <div className="mt-12 flex items-center justify-center gap-4">
          <Button className="rounded-full" size="lg" asChild><ProviderAction field="cta" fallback={"Get Started"} decoration="after"><ArrowUpRight className="h-5! w-5!" /></ProviderAction></Button>
          <Button
            className="rounded-full shadow-none"
            size="lg"
            variant="outline"
           asChild><ProviderAction field="secondary" fallback={"Watch Demo"} decoration="before"><CirclePlay className="h-5! w-5!" /></ProviderAction></Button>
        </div>
      </div>
    </div>
  );
}
