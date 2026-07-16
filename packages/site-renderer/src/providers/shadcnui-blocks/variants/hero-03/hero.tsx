// @ts-nocheck -- pinned upstream literal with SIAB runtime-only import adaptations
import { ProviderAction, ProviderContactLink, ProviderDemoOnly, ProviderField, ProviderImage, ProviderItemField, ProviderItemLink, ProviderItems, ProviderLogo } from "../../runtime/content";
import { ArrowUpRight, CirclePlay } from "lucide-react";
import Link from "../../runtime/link";
import { Badge } from "@siteinabox/ui/providers/shadcnui-blocks/radix-nova";
import { Button } from "@siteinabox/ui/providers/shadcnui-blocks/radix-nova";
import GradientText from "./gradient-text";
import Navbar from "./navbar";

export default function Hero() {
  return (
    <div className="flex min-h-screen w-full flex-col items-center justify-center px-6 pt-8 pb-16">
      <ProviderDemoOnly fallback={<Navbar />} />

      <div className="mt-16 max-w-3xl text-center">
        <Badge
          asChild
          className="rounded-full border-border py-1"
          variant="secondary"
        >
          <span><ProviderField field="eyebrow" fallback={"Just released v1.0.0"} inline /><ArrowUpRight className="ml-1 size-4" /></span>
        </Badge>
        <h1 className="mx-auto mt-6 max-w-xl font-medium text-4xl tracking-[-0.045em] sm:text-[2.75rem] md:text-6xl/[1.2]"><ProviderField field="headline" fallback={<>
          Ship{" "}
          <GradientText
            animationSpeed={2}
            className="border-b-2 border-dotted sm:border-b-3"
            colors={[
              "var(--siab-accent-700)",
              "var(--siab-accent-400)",
              "var(--siab-accent-200)",
            ]}
            direction="diagonal"
          >
            better UI
          </GradientText>{" "}
          without&nbsp;the&nbsp;hassle
        </>} inline /></h1>
        <p className="mx-auto mt-6 max-w-2xl text-muted-foreground text-xl tracking-[-0.01em] md:text-2xl/normal"><ProviderField field="subheadline" fallback={<>
          Instead of starting from scratch every time, use thoughtfully designed
          blocks that give you a solid foundation for any UI.
        </>} inline /></p>
        <div className="mt-10 flex items-center justify-center gap-4">
          <Button className="rounded-full" size="lg" asChild><ProviderAction field="cta" fallback={"Get Started"} decoration="after"><ArrowUpRight className="h-5! w-5!" /></ProviderAction></Button>
          <Button
            className="rounded-full shadow-none"
            size="lg"
            variant="outline"
           asChild><ProviderAction field="secondary" fallback={"Watch Demo"} decoration="before"><CirclePlay className="h-5! w-5!" /></ProviderAction></Button>
        </div>
      </div>
      <div className="relative mx-auto mt-20 aspect-video w-full max-w-(--breakpoint-xl) rounded-xl bg-linear-to-br from-primary/90 via-primary/60 to-accent p-2">
        <div className="size-full rounded-lg bg-background" />
        <div
          className="absolute inset-0 isolate z-0"
          style={{
            backgroundImage: `
        linear-gradient(to right, var(--border) 1px, transparent 1px),
        linear-gradient(to bottom, var(--border) 1px, transparent 1px)
      `,
            backgroundSize: "20px 20px",
            backgroundPosition: "0 0, 0 0",
            maskImage: `
       repeating-linear-gradient(
              to right,
              black 0px,
              black 3px,
              transparent 3px,
              transparent 8px
            ),
            repeating-linear-gradient(
              to bottom,
              black 0px,
              black 3px,
              transparent 3px,
              transparent 8px
            ),
          radial-gradient(ellipse 60% 60% at 50% 50%, #000 30%, transparent 70%)
      `,
            WebkitMaskImage: `
 repeating-linear-gradient(
              to right,
              black 0px,
              black 3px,
              transparent 3px,
              transparent 8px
            ),
            repeating-linear-gradient(
              to bottom,
              black 0px,
              black 3px,
              transparent 3px,
              transparent 8px
            ),
          radial-gradient(ellipse 60% 60% at 50% 50%, #000 30%, transparent 70%)
      `,
            maskComposite: "intersect",
            WebkitMaskComposite: "source-in",
          }}
        />
      </div>

      <div
        className="fixed inset-0 isolate -z-1 h-screen [--color-hero-bg:var(--siab-accent-700)] dark:[--color-hero-bg:var(--siab-accent-600)]"
        style={{
          background:
            "radial-gradient(125% 125% at 50% 10%, var(--color-background) 40%, var(--color-hero-bg) 100%)",
        }}
      />
    </div>
  );
}
