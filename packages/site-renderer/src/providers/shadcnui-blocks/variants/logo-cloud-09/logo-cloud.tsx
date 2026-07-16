// @ts-nocheck -- pinned upstream literal with SIAB runtime-only import adaptations
import { ProviderAction, ProviderContactLink, ProviderDemoOnly, ProviderField, ProviderImage, ProviderItemField, ProviderItemLink, ProviderItems, ProviderLogo } from "../../runtime/content";
import {
  Logo01,
  Logo02,
  Logo03,
  Logo04,
  Logo05,
  Logo06,
  Logo07,
  Logo08,
} from "../../runtime/logos";

const LogoCloud = () => {
  return (
    <div className="px-6 py-12">
      <p className="text-balance text-center font-medium text-foreground/80 text-lg"><ProviderField field="title" fallback={<>
        Trusted by teams and companies around the world
      </>} inline /></p>
      <div className="mx-auto mt-10 grid max-w-5xl grid-cols-2 place-items-center gap-x-4 gap-y-4 grayscale-100 sm:grid-cols-3 md:grid-cols-4">
        <div className="flex w-full items-center justify-center rounded-xl bg-muted px-3 py-7">
          <ProviderLogo field="logos" index={0} fallback={<Logo01 className="h-7 sm:h-8" />} />
        </div>
        <div className="flex w-full items-center justify-center rounded-xl bg-muted px-3 py-7">
          <ProviderLogo field="logos" index={1} fallback={<Logo02 className="h-7 sm:h-8" />} />
        </div>
        <div className="flex w-full items-center justify-center rounded-xl bg-muted px-3 py-7">
          <ProviderLogo field="logos" index={2} fallback={<Logo03 className="h-7 sm:h-8" />} />
        </div>
        <div className="flex w-full items-center justify-center rounded-xl bg-muted px-3 py-7">
          <ProviderLogo field="logos" index={3} fallback={<Logo04 className="h-7 sm:h-8" />} />
        </div>
        <div className="flex w-full items-center justify-center rounded-xl bg-muted px-3 py-7">
          <ProviderLogo field="logos" index={4} fallback={<Logo05 className="h-7 sm:h-8" />} />
        </div>
        <div className="flex w-full items-center justify-center rounded-xl bg-muted px-3 py-7">
          <ProviderLogo field="logos" index={5} fallback={<Logo06 className="h-7 sm:h-8" />} />
        </div>
        <div className="flex w-full items-center justify-center rounded-xl bg-muted px-3 py-7">
          <ProviderLogo field="logos" index={6} fallback={<Logo07 className="h-7 sm:h-8" />} />
        </div>
        <div className="flex w-full items-center justify-center rounded-xl bg-muted px-3 py-7">
          <ProviderLogo field="logos" index={7} fallback={<Logo08 className="h-7 sm:h-8" />} />
        </div>
      </div>
    </div>
  );
};

export default LogoCloud;
