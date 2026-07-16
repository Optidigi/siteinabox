// @ts-nocheck -- pinned upstream literal with SIAB runtime-only import adaptations
import { ProviderAction, ProviderContactLink, ProviderDemoOnly, ProviderField, ProviderImage, ProviderItemField, ProviderItemLink, ProviderItems, ProviderLogo } from "../../runtime/content";
import { ArrowUpRight } from "lucide-react";
import { Button } from "@siteinabox/ui/providers/shadcnui-blocks/radix-nova";
import { Logo01, Logo02, Logo03, Logo04 } from "./logos";
import Navbar from "./navbar";

const Hero = () => {
  return (
    <div>
      <ProviderDemoOnly fallback={<Navbar />} />

      <div className="mx-auto flex max-w-5xl flex-col items-center px-6 py-12 text-center">
        <h2 className="text-balance font-medium text-4xl leading-[1.4] tracking-tighter sm:text-5xl md:text-6xl lg:text-7xl"><ProviderField field="headline" fallback={<>
          Beautifully Designed{" "}
          <span className="inline-block rounded-md bg-primary px-1.5 py-0.5 text-primary-foreground leading-[1.1] tracking-tight sm:rounded-lg sm:px-3.5">
            Premium
          </span>{" "}
          Shadcn Blocks
        </>} inline /></h2>
        <p className="mt-6 text-balance text-center text-muted-foreground text-xl tracking-[-0.01em] sm:text-2xl sm:leading-normal md:text-3xl"><ProviderField field="subheadline" fallback={<>
          A collection of beautifully designed components that you can use to
          build your next project.
        </>} inline /></p>
        <div className="mx-auto mt-10 flex w-full max-w-xs flex-col items-center justify-center gap-4 sm:flex-row">
          <Button className="w-full sm:w-auto" size="lg" asChild><ProviderAction field="cta" fallback={"Get Started"} decoration="after"><ArrowUpRight /></ProviderAction></Button>
          <Button className="w-full sm:w-auto" size="lg" variant="outline" asChild><ProviderAction field="secondary" fallback={"Learn More"} decoration="after"></ProviderAction></Button>
        </div>

        <div className="mt-24 flex flex-col items-center gap-4">
          <p className="font-medium text-muted-foreground text-sm uppercase"><ProviderField field="trustLabel" fallback={<>
            Trusted by engineers at
          </>} inline /></p>
          <div className="mx-auto mt-4 grid max-w-5xl grid-cols-2 place-items-center gap-6 text-foreground/70 sm:grid-cols-3 sm:gap-x-10 sm:gap-y-12 md:grid-cols-4">
            <ProviderLogo field="logos" index={0} fallback={<Logo01 className="h-7 sm:h-8" />} />
            <ProviderLogo field="logos" index={1} fallback={<Logo02 className="h-7 sm:h-8" />} />
            <ProviderLogo field="logos" index={2} fallback={<Logo03 className="h-7 sm:h-8" />} />
            <ProviderLogo field="logos" index={3} fallback={<Logo04 className="h-7 sm:h-8" />} />
          </div>
        </div>
      </div>
    </div>
  );
};

export default Hero;
