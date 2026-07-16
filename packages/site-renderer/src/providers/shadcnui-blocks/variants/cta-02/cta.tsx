// @ts-nocheck -- pinned upstream literal with SIAB runtime-only import adaptations
import { ProviderAction, ProviderContactLink, ProviderDemoOnly, ProviderField, ProviderImage, ProviderItemField, ProviderItemLink, ProviderItems, ProviderLogo } from "../../runtime/content";
import Image from "../../runtime/image";
import { ArrowUpRight } from "lucide-react";
import { Button } from "@siteinabox/ui/providers/shadcnui-blocks/radix-nova";

const CTA = () => {
  return (
    <div className="px-0 py-20 sm:px-6">
      <div className="relative mx-auto max-w-5xl overflow-hidden sm:rounded-xl sm:shadow-lg dark:border dark:border-border/80">
        <ProviderImage field="backgroundImage" fallback={<Image
          alt=""
          className="absolute inset-0 size-full object-cover"
          src="/images/ascii-art.png"
        />} />

        <div className="relative isolate bg-linear-to-r from-black to-black/50 px-10 py-14">
          <h2 className="font-medium text-4xl text-white tracking-[-0.04em] sm:text-[2.85rem]"><ProviderField field="headline" fallback={<>
            Step Into Something Better
          </>} inline /></h2>
          <p className="mt-4 max-w-md text-lg text-white/85 md:text-xl/normal"><ProviderField field="description" fallback={<>
            Get seamless access to everything you need, right from your phone.
          </>} inline /></p>
          <Button
            className="mt-10 bg-white text-black ring-4 ring-white/30 hover:bg-white/90"
            size="lg"
           asChild><ProviderAction field="primary" fallback={"Download Now"} decoration="after"><ArrowUpRight /></ProviderAction></Button>
        </div>
      </div>
    </div>
  );
};

export default CTA;
