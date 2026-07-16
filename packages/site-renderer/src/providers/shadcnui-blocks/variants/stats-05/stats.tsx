// @ts-nocheck -- pinned upstream literal with SIAB runtime-only import adaptations
import { ProviderAction, ProviderContactLink, ProviderDemoOnly, ProviderField, ProviderImage, ProviderItemField, ProviderItemLink, ProviderItems, ProviderLogo } from "../../runtime/content";
import { FastForward, HeartHandshake, MonitorSmartphone } from "lucide-react";

function Stats() {
  return (
    <div className="mx-auto max-w-5xl px-6 py-20">
      <h2 className="text-balance text-center font-medium text-4xl tracking-[-0.04em] md:text-[2.75rem]"><ProviderField field="title" fallback={<>
        Built with scale in mind
      </>} inline /></h2>
      <p className="mt-3.5 text-center text-muted-foreground text-xl tracking-[-0.015em] sm:text-lg md:text-2xl"><ProviderField field="intro" fallback={<>
        Trusted by thousands to build modern UIs faster
      </>} inline /></p>

      <div className="mt-14 grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3">
        <div className="rounded-xl border bg-muted p-6 py-7">
          <MonitorSmartphone className="mb-8 h-10 w-10 stroke-[1.75px] text-chart-1" />
          <span className="font-medium text-5xl tracking-[-0.01em]"><ProviderItemField field="items" index={0} subField="value" fallback={<>70%</>} /></span>
          <p className="mt-4 text-foreground/80 text-xl"><ProviderItemField field="items" index={0} subField="label" fallback={<>
            Faster UI development
          </>} /></p>
        </div>
        <div className="rounded-xl border bg-muted p-6 py-7">
          <FastForward className="mb-8 h-10 w-10 stroke-[1.75px] text-chart-2" />
          <span className="font-medium text-5xl tracking-[-0.01em]"><ProviderItemField field="items" index={1} subField="value" fallback={<>5x</>} /></span>
          <p className="mt-4 text-foreground/80 text-xl"><ProviderItemField field="items" index={1} subField="label" fallback={<>
            Increase in productivity
          </>} /></p>
        </div>
        <div className="rounded-xl border bg-muted p-6 py-7">
          <HeartHandshake className="mb-8 h-10 w-10 stroke-[1.75px] text-chart-4" />
          <span className="font-medium text-5xl tracking-[-0.01em]"><ProviderItemField field="items" index={2} subField="value" fallback={<>98%</>} /></span>
          <p className="mt-4 text-foreground/80 text-xl"><ProviderItemField field="items" index={2} subField="label" fallback={<>
            Customer satisfaction
          </>} /></p>
        </div>
      </div>
    </div>
  );
}

export default Stats;
