// @ts-nocheck -- pinned upstream literal with SIAB runtime-only import adaptations
"use client";
import { ProviderAction, ProviderContactLink, ProviderDemoOnly, ProviderField, ProviderImage, ProviderItemField, ProviderItemLink, ProviderItems, ProviderLogo } from "../../runtime/content";
import { Button } from "@siteinabox/ui/providers/shadcnui-blocks/radix-nova";

const CTA = () => {
  return (
    <div className="px-0 py-20 sm:px-6">
      <div className="relative flex w-full flex-col items-center justify-center py-16">
        <h2 className="font-medium text-5xl tracking-tighter"><ProviderField field="headline" fallback={<>
          Ready to Build Faster?
        </>} inline /></h2>
        <p className="mx-auto mt-6 max-w-xl text-center text-muted-foreground text-xl/normal"><ProviderField field="description" fallback={<>
          Join thousands of developers using our premium component library to
          ship beautiful UIs in minutes, not hours.
        </>} inline /></p>
        <Button className="mt-8" asChild><ProviderAction field="primary" fallback={"Get Started"} decoration="after"></ProviderAction></Button>
      </div>
    </div>
  );
};

export default CTA;
