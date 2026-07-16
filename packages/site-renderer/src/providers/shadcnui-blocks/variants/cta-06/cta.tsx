// @ts-nocheck -- pinned upstream literal with SIAB runtime-only import adaptations
"use client";
import { ProviderAction, ProviderContactLink, ProviderDemoOnly, ProviderField, ProviderImage, ProviderItemField, ProviderItemLink, ProviderItems, ProviderLogo } from "../../runtime/content";
import { NeuroNoise } from "@paper-design/shaders-react";
import { ArrowUpRight } from "lucide-react";
import { useTheme } from "../../runtime/theme";
import { Button } from "@siteinabox/ui/providers/shadcnui-blocks/radix-nova";

const CTA = () => {
  const { resolvedTheme } = useTheme();

  return (
    <div className="px-0 py-16 sm:px-6">
      <div className="relative mx-auto max-w-5xl overflow-hidden border-y p-14 shadow-muted sm:rounded-xl sm:border-x sm:shadow-lg/5">
        <NeuroNoise
          brightness={0}
          className="mask-l-from-30% sm:mask-l-from-10% absolute inset-0"
          colorBack={
            resolvedTheme === "light" ? "rgba(0, 0, 0, 0.08)" : undefined
          }
          colorFront={
            resolvedTheme === "light" ? "rgba(0, 0, 0, 0.08)" : undefined
          }
          colorMid={
            resolvedTheme === "light"
              ? "rgba(0, 0, 0, 0.5)"
              : "rgba(255, 255, 255, 0.85)"
          }
          contrast={1}
          height={720}
          scale={0.55}
          speed={1}
          width={1280}
        />

        <div className="relative isolate">
          <h2 className="text-balance font-medium text-4xl text-foreground tracking-[-0.04em] md:leading-tight lg:text-[2.75rem]"><ProviderField field="headline" fallback={<>
            Experience the difference
          </>} inline /></h2>
          <p className="mt-4 text-balance text-muted-foreground text-xl/normal md:mt-2.5 lg:text-[1.4rem]/normal"><ProviderField field="description" fallback={<>
            Join thousands of developers using our premium component library to
            ship beautiful UIs in minutes, not hours.
          </>} inline /></p>
          <div className="mt-10 flex flex-col gap-3 sm:flex-row">
            <Button size="lg" asChild><ProviderAction field="primary" fallback={"Get Started"} decoration="after"><ArrowUpRight /></ProviderAction></Button>
            <Button size="lg" variant="outline" asChild><ProviderAction field="secondary" fallback={"View Components"} decoration="after"></ProviderAction></Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CTA;
