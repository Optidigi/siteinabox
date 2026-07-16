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
    <div className="flex min-h-screen items-center justify-center px-6">
      <div>
        <p className="text-center text-xl"><ProviderField field="title" fallback={<>
          More than 2.2 million companies worldwide already trust us
        </>} inline /></p>

        <div className="mt-20 flex max-w-(--breakpoint-lg) flex-wrap items-center justify-center gap-x-14 gap-y-12 *:h-10">
          <ProviderLogo field="logos" index={0} fallback={<Logo01 />} />
          <ProviderLogo field="logos" index={1} fallback={<Logo02 />} />
          <ProviderLogo field="logos" index={2} fallback={<Logo03 />} />
          <ProviderLogo field="logos" index={3} fallback={<Logo04 />} />
          <ProviderLogo field="logos" index={4} fallback={<Logo05 />} />
          <ProviderLogo field="logos" index={5} fallback={<Logo06 />} />
          <ProviderLogo field="logos" index={6} fallback={<Logo07 />} />
          <ProviderLogo field="logos" index={7} fallback={<Logo08 />} />
        </div>
      </div>
    </div>
  );
};

export default LogoCloud;
