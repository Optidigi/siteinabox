// @ts-nocheck -- pinned upstream literal with SIAB runtime-only import adaptations
import { ProviderAction, ProviderContactLink, ProviderDemoOnly, ProviderField, ProviderImage, ProviderItemField, ProviderItemLink, ProviderItems, ProviderLogo } from "../../runtime/content";
import { Logo01, Logo02, Logo03, Logo04 } from "../../runtime/logos";

const LogoCloud = () => {
  return (
    <div className="flex min-h-screen items-center justify-center px-6">
      <div>
        <p className="text-center text-xl"><ProviderField field="title" fallback={<>
          More than 2.2 million companies worldwide already trust us
        </>} inline /></p>

        <div className="mt-14 flex flex-wrap items-center justify-center gap-14 *:h-10">
          <ProviderLogo field="logos" index={0} fallback={<Logo01 />} />
          <ProviderLogo field="logos" index={1} fallback={<Logo02 />} />
          <ProviderLogo field="logos" index={2} fallback={<Logo03 />} />
          <ProviderLogo field="logos" index={3} fallback={<Logo04 />} />
        </div>
      </div>
    </div>
  );
};

export default LogoCloud;
