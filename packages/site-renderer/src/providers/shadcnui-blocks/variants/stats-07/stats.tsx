// @ts-nocheck -- pinned upstream literal with SIAB runtime-only import adaptations
import { ProviderAction, ProviderContactLink, ProviderDemoOnly, ProviderField, ProviderImage, ProviderItemField, ProviderItemLink, ProviderItems, ProviderLogo } from "../../runtime/content";
import { cn } from "@siteinabox/ui/lib/utils";

function Stats() {
  return (
    <div className="mx-auto max-w-5xl px-6 py-20">
      <h2 className="text-balance text-center font-medium text-4xl tracking-[-0.04em] md:text-[2.75rem]"><ProviderField field="title" fallback={<>
        Built with scale in mind
      </>} inline /></h2>
      <p className="mt-3.5 text-center text-muted-foreground text-xl tracking-[-0.015em] sm:text-lg md:text-2xl"><ProviderField field="intro" fallback={<>
        A quick look at the impact and adoption of our UI components
      </>} inline /></p>

      <div className="mt-14 rounded-2xl border bg-muted p-1">
        <div
          className={cn(
            "grid grid-cols-1 gap-1 overflow-hidden rounded-xl sm:grid-cols-2 md:grid-cols-3",
            "*:rounded *:border *:first:rounded-t-xl *:last:rounded-b-xl sm:*:nth-2:rounded-tr-xl sm:*:first:rounded-tl-xl sm:*:first:rounded-tr md:*:nth-2:rounded-tr md:*:last:rounded-e-xl md:*:last:rounded-bl md:*:first:rounded-s-xl dark:*:border-foreground/20"
          )}
        >
          <div className="bg-background p-10">
            <span className="font-medium text-5xl"><ProviderItemField field="items" index={0} subField="value" fallback={<>70%</>} /></span>
            <p className="mt-4 text-foreground/80 text-xl"><ProviderItemField field="items" index={0} subField="label" fallback={<>
              Faster UI development
            </>} /></p>
          </div>
          <div className="bg-background p-10">
            <span className="font-medium text-5xl"><ProviderItemField field="items" index={1} subField="value" fallback={<>5x</>} /></span>
            <p className="mt-4 text-foreground/80 text-xl"><ProviderItemField field="items" index={1} subField="label" fallback={<>
              Increase in productivity
            </>} /></p>
          </div>
          <div className="bg-background p-10 sm:col-span-2 md:col-span-1">
            <span className="font-medium text-5xl"><ProviderItemField field="items" index={2} subField="value" fallback={<>98%</>} /></span>
            <p className="mt-4 text-foreground/80 text-xl"><ProviderItemField field="items" index={2} subField="label" fallback={<>
              Customer satisfaction
            </>} /></p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Stats;
