// @ts-nocheck -- pinned upstream literal with SIAB runtime-only import adaptations
import { ProviderAction, ProviderContactLink, ProviderDemoOnly, ProviderField, ProviderImage, ProviderItemField, ProviderItemLink, ProviderItems, ProviderLogo } from "../../runtime/content";
const Stats = () => {
  return (
    <div className="py-20">
      <div className="mx-auto w-full max-w-(--breakpoint-xl) px-6 py-12 xl:px-0">
        <h2 className="font-medium text-4xl tracking-[-0.04em] md:text-[2.75rem]"><ProviderField field="title" fallback={<>
          The impact we've made so far
        </>} inline /></h2>
        <p className="mt-4.5 max-w-2xl text-lg text-muted-foreground md:text-xl"><ProviderField field="intro" fallback={<>
          The world&apos;s most advanced UI kit for Figma. Meticulously crafted
          with 100% Auto Layout 5.0, variables, smart variants, and WCAG
          accessibility.
        </>} inline /></p>

        <div className="mt-16 grid justify-center gap-x-10 gap-y-16 sm:mt-24 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          <div>
            <span className="font-medium text-5xl tracking-tight md:text-6xl"><ProviderItemField field="items" index={0} subField="value" fallback={<>
              900+
            </>} /></span>
            <p className="mt-6 font-medium text-xl"><ProviderItemField field="items" index={0} subField="label" fallback={<>
              Global styles + variables
            </>} /></p>
            <p className="mt-2 text-muted-foreground"><ProviderItemField field="items" index={0} subField="description" fallback={<>
              Super smart global color, typography and effects styles +
              variables!
            </>} /></p>
          </div>
          <div>
            <span className="font-medium text-5xl text-muted-foreground tracking-tight md:text-6xl"><ProviderItemField field="items" index={1} subField="value" fallback={<>
              10,000+
            </>} /></span>
            <p className="mt-6 font-medium text-xl"><ProviderItemField field="items" index={1} subField="label" fallback={<>Components and variants</>} /></p>
            <p className="mt-2 text-muted-foreground"><ProviderItemField field="items" index={1} subField="description" fallback={<>
              We&apos;ve thought of everything you need so you don&apos;t have
              to.
            </>} /></p>
          </div>
          <div>
            <span className="font-medium text-5xl tracking-tight md:text-6xl"><ProviderItemField field="items" index={2} subField="value" fallback={<>
              420+
            </>} /></span>
            <p className="mt-6 font-medium text-xl"><ProviderItemField field="items" index={2} subField="label" fallback={<>Page design examples</>} /></p>
            <p className="mt-2 text-muted-foreground"><ProviderItemField field="items" index={2} subField="description" fallback={<>
              A whopping 420+ ready-to-go desktop and mobile page examples.
            </>} /></p>
          </div>
          <div>
            <span className="font-medium text-5xl text-muted-foreground tracking-tight md:text-6xl"><ProviderItemField field="items" index={3} subField="value" fallback={<>
              2,000+
            </>} /></span>
            <p className="mt-6 font-medium text-xl"><ProviderItemField field="items" index={3} subField="label" fallback={<>Icons and logos</>} /></p>
            <p className="mt-2 text-muted-foreground"><ProviderItemField field="items" index={3} subField="description" fallback={<>
              All the icons you&apos;ll need, including country flags and
              payments.
            </>} /></p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Stats;
