// @ts-nocheck -- pinned upstream literal with SIAB runtime-only import adaptations
import { ProviderAction, ProviderContactLink, ProviderDemoOnly, ProviderField, ProviderImage, ProviderItemField, ProviderItemLink, ProviderItems, ProviderLogo } from "../../runtime/content";
import Image from "../../runtime/image";
const features = [
  {
    title: "Blazing Fast Performance",
    description:
      "Optimized for speed with minimal loading times and instant interactions.",
    image: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='1024' height='1024' viewBox='0 0 1024 1024'%3E%3C/svg%3E#sha256:003d6",
  },
  {
    title: "Fully Customizable",
    description: "Tailor every component to match your brand or workflow.",
    image: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='1024' height='1024' viewBox='0 0 1024 1024'%3E%3C/svg%3E#sha256:85f35",
  },
  {
    title: "Developer-Friendly",
    description: "Built with clean, modern code and best practices in mind.",
    image: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='1024' height='1024' viewBox='0 0 1024 1024'%3E%3C/svg%3E#sha256:d30fc",
  },
  {
    title: "Responsive by Default",
    description:
      "Every component is designed to look great on all screen sizes.",
    image: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='1024' height='1024' viewBox='0 0 1024 1024'%3E%3C/svg%3E#sha256:1218e",
  },
  {
    title: "Accessible for Everyone",
    description: "Built with accessibility best practices in mind.",
    image: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='1024' height='1024' viewBox='0 0 1024 1024'%3E%3C/svg%3E#sha256:19eb3",
  },
  {
    title: "Seamless Integration",
    description: "Easily connect with your favorite tools, APIs, and services.",
    image: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='1024' height='1024' viewBox='0 0 1024 1024'%3E%3C/svg%3E#sha256:c1427",
  },
];

const Features = () => {
  return (
    <div className="mx-auto flex max-w-7xl flex-col px-6 py-20">
      <h2 className="text-pretty text-center font-medium text-4xl tracking-[-0.04em] sm:text-[2.75rem]"><ProviderField field="title" fallback={<>
        Built with intention
      </>} inline /></h2>
      <p className="mt-3 text-pretty text-center text-muted-foreground text-xl -tracking-[0.01em] sm:text-2xl"><ProviderField field="intro" fallback={<>
        Carefully structured blocks that feel right in projects
      </>} inline /></p>

      <div className="mx-auto mt-16 grid max-w-6xl grid-cols-1 gap-6 sm:mt-20 sm:grid-cols-2 lg:grid-cols-3">
        {<ProviderItems field="features" templates={features}>{(providerItems) => providerItems.map((feature, index) => (
          <div className="rounded-lg border border-border/80" key={index}>
            <div className="mask-b-from-70% dark:mask-b-from-40% aspect-square w-full rounded-t-lg">
              <Image
                alt=""
                className="size-full rounded-t-lg object-cover"
                src={feature.image}
              />
            </div>

            <div className="-mt-3 p-6 pt-0">
              <h3 className="font-medium text-xl tracking-[-0.005em]">
                {feature.title}
              </h3>
              <p className="mt-2 text-foreground/80 text-lg">
                {feature.description}
              </p>
            </div>
          </div>
        ))}</ProviderItems>}
      </div>
    </div>
  );
};

export default Features;
