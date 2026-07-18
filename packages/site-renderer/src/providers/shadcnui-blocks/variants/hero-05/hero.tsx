// @ts-nocheck -- pinned upstream literal with SIAB runtime-only import adaptations
import { ProviderAction, ProviderContactLink, ProviderDemoOnly, ProviderField, ProviderImage, ProviderItemField, ProviderItemLink, ProviderItems, ProviderLogo } from "../../runtime/content";
import Image from "../../runtime/image";
import { ArrowUpRight, CirclePlay } from "lucide-react";
import Link from "../../runtime/link";
import { Badge } from "@siteinabox/ui/providers/shadcnui-blocks/radix-nova";
import { Button } from "@siteinabox/ui/providers/shadcnui-blocks/radix-nova";

export default function Hero() {
  return (
    <div className="flex min-h-screen items-center justify-center overflow-hidden">
      <div className="mx-auto grid w-full max-w-(--breakpoint-xl) gap-12 px-6 py-12 lg:grid-cols-2 lg:py-0">
        <div className="my-auto">
          <Badge
            asChild
            className="rounded-full border-border py-1"
            variant="secondary"
          >
            <span><ProviderField field="eyebrow" fallback={"Just released v1.0.0"} inline /><ArrowUpRight className="ml-1 size-4" /></span>
          </Badge>
          <h1 className="mt-6 max-w-[17ch] font-medium text-4xl leading-[1.2]! tracking-[-0.04em] md:text-5xl lg:text-[2.75rem] xl:text-[3.25rem]"><ProviderField field="headline" fallback={<>
            Your complete
            <br /> UI building toolkit
          </>} inline /></h1>
          <p className="mt-4 max-w-[60ch] text-foreground/60 text-lg sm:mt-6 sm:text-xl/normal"><ProviderField field="subheadline" fallback={<>
            Explore a collection of Shadcn UI blocks and components, ready to
            preview and copy. Streamline your development workflow with
            easy-to-implement examples.
          </>} inline /></p>
          <div className="mt-8 flex items-center gap-4 sm:mt-12">
            <Button className="rounded-full" size="lg" asChild><ProviderAction field="cta" fallback={"Get Started"} decoration="after"><ArrowUpRight className="h-5! w-5!" /></ProviderAction></Button>
            <Button
              className="rounded-full shadow-none"
              size="lg"
              variant="outline"
             asChild><ProviderAction field="secondary" fallback={"Watch Demo"} decoration="before"><CirclePlay className="h-5! w-5!" /></ProviderAction></Button>
          </div>
        </div>
        <ProviderImage field="image" fallback={<Image alt="" className="aspect-video w-full rounded-xl bg-accent object-cover lg:aspect-auto lg:h-screen lg:w-[1000px] lg:rounded-none" src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='1024' height='1024' viewBox='0 0 1024 1024'%3E%3C/svg%3E" />} />
      </div>
    </div>
  );
}
