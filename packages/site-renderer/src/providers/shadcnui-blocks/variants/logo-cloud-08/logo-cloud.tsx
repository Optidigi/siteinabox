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

const logos = [Logo01, Logo02, Logo03, Logo07, Logo05, Logo06, Logo04, Logo08];

const LogoCloud = () => {
  return (
    <section className="mx-auto max-w-5xl px-6 py-12">
      <p className="text-balance text-center font-medium text-muted-foreground text-sm uppercase"><ProviderField field="intro" fallback={<>
        Trusted by teams and companies around the world
      </>} inline /></p>
      <div className="mt-10 grid grid-cols-2 place-items-center border-t border-l border-dashed grayscale-100 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-4">
        {<ProviderItems field="logos" templates={logos}>{(providerItems) => providerItems.map((Logo, index) => (
          <div
            className="flex w-full items-center justify-center border-r border-b border-dashed bg-card p-6"
            key={index}
          >
            <Logo className="h-7 sm:h-8" />
          </div>
        ))}</ProviderItems>}
      </div>
    </section>
  );
};

export default LogoCloud;
