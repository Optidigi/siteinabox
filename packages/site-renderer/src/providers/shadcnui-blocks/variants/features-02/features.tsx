// @ts-nocheck -- pinned upstream literal with SIAB runtime-only import adaptations
import { ProviderAction, ProviderContactLink, ProviderDemoOnly, ProviderField, ProviderImage, ProviderItemField, ProviderItemLink, ProviderItems, ProviderLogo } from "../../runtime/content";
import Image from "../../runtime/image";
const features = [
  {
    title: "Identify Opportunities",
    description: "Find untapped areas to explore effortlessly.",
    image: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='1024' height='1024' viewBox='0 0 1024 1024'%3E%3C/svg%3E#sha256:85f35",
  },
  {
    title: "Build Authority",
    description: "Craft content that resonates and inspires trust.",
    image: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='1024' height='1024' viewBox='0 0 1024 1024'%3E%3C/svg%3E#sha256:d30fc",
  },
  {
    title: "Instant Insights",
    description: "Get actionable insights instantly at a glance.",
    image: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='1024' height='1024' viewBox='0 0 1024 1024'%3E%3C/svg%3E#sha256:19eb3",
  },
];

const Features = () => {
  return (
    <div className="flex min-h-screen items-center justify-center px-6 py-20">
      <div className="w-full grow sm:max-w-(--breakpoint-md) lg:max-w-(--breakpoint-lg)">
        <h2 className="mx-auto text-center font-medium text-4xl tracking-[-0.045em] sm:text-[2.75rem]/[1.2]"><ProviderField field="title" fallback={<>
          Where ideas take shape
        </>} inline /></h2>
        <p className="mt-3 text-pretty text-center text-lg text-muted-foreground tracking-[-0.01em] sm:text-2xl"><ProviderField field="intro" fallback={<>
          No complex configs. Just copy, paste, and start building
        </>} inline /></p>
        <div className="mt-18 grid w-full gap-x-6 gap-y-12 sm:grid-cols-2 lg:grid-cols-3">
          {<ProviderItems field="features" templates={features}>{(providerItems) => providerItems.map((feature) => (
            <div
              className="flex w-full flex-col text-start"
              key={feature.title}
            >
              <div className="relative mb-5 aspect-4/5 w-full overflow-hidden rounded-xl sm:mb-6">
                <Image
                  alt=""
                  className="size-full bg-muted object-cover"
                  sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                  src={feature.image}
                />
              </div>
              <div className="px-1">
                <span className="font-medium text-[22px] tracking-[-0.015em]">
                  {feature.title}
                </span>
                <p className="mt-1 max-w-[25ch] text-[17px] text-muted-foreground">
                  {feature.description}
                </p>
              </div>
            </div>
          ))}</ProviderItems>}
        </div>
      </div>
    </div>
  );
};

export default Features;
