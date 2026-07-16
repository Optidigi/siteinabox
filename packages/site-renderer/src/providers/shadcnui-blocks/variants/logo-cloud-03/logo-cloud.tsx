// @ts-nocheck -- pinned upstream literal with SIAB runtime-only import adaptations
import { ProviderAction, ProviderContactLink, ProviderDemoOnly, ProviderField, ProviderImage, ProviderItemField, ProviderItemLink, ProviderItems, ProviderLogo } from "../../runtime/content";
import { ArrowUpRight } from "lucide-react";
import { Logo01, Logo02, Logo03, Logo04, Logo05 } from "../../runtime/logos";
import { SharedButton as Button } from "@siteinabox/ui/providers/shadcnui-blocks/radix-nova";

const LogoCloud = () => {
  return (
    <div className="flex min-h-screen flex-col">
      <div className="shrink-0 grow basis-1/2 bg-muted" />
      <div className="relative grow">
        <div className="inset-x-0 top-0 mx-auto flex w-full flex-col justify-between gap-10 rounded-lg border border-border/70 bg-background px-10 py-14 shadow-foreground/4 sm:absolute sm:-translate-y-1/2 sm:shadow-lg md:max-w-(--breakpoint-md) lg:max-w-(--breakpoint-lg) lg:flex-row lg:items-center xl:max-w-(--breakpoint-xl) dark:border-border/70 dark:shadow-foreground/3">
          <div className="shrink-0">
            <h3 className="font-medium text-3xl tracking-[-0.045em]"><ProviderField field="title" fallback={<>
              Trusted by 1000+ companies
            </>} inline /></h3>
            <p className="mt-3 max-w-xl text-foreground/80 text-lg lg:max-w-md xl:max-w-xl"><ProviderField field="intro" fallback={<>
              Trusted by industry leaders and visionaries who are shaping the
              future, solving global challenges, and driving innovation forward.
            </>} inline /></p>

            <Button className="mt-7" size="lg" asChild><ProviderAction field="cta" fallback={"View all companies"} decoration="after"><ArrowUpRight /></ProviderAction></Button>
          </div>

          <div className="grid grid-cols-3 gap-x-6 gap-y-8 *:h-8 md:grid-cols-4 md:*:h-8 lg:grid-cols-2 lg:justify-end lg:gap-10 xl:grid-cols-3 xl:*:h-10">
            <ProviderLogo field="logos" index={0} fallback={<Logo01 />} />
            <ProviderLogo field="logos" index={2} fallback={<Logo03 />} />
            <ProviderLogo field="logos" index={1} fallback={<Logo02 />} />
            <ProviderLogo field="logos" index={3} fallback={<Logo04 />} />
            <ProviderLogo field="logos" index={4} fallback={<Logo05 />} />
          </div>
        </div>
      </div>
    </div>
  );
};

export default LogoCloud;
