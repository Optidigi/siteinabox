// @ts-nocheck -- pinned upstream literal with SIAB runtime-only import adaptations
import { ProviderAction, ProviderContactLink, ProviderDemoOnly, ProviderField, ProviderImage, ProviderItemField, ProviderItemLink, ProviderItems, ProviderLogo } from "../../runtime/content";
import Image from "../../runtime/image";
export default function Integrations() {
  return (
    <div className="mx-auto flex max-w-7xl flex-col px-6 py-12 sm:py-14">
      <h2 className="text-center font-medium text-4xl tracking-[-0.04em] sm:text-[2.75rem]"><ProviderField field="title" fallback={<>
        Easy integrations
      </>} inline /></h2>
      <p className="mt-3 text-pretty text-center text-muted-foreground text-xl -tracking-[0.01em] sm:text-2xl"><ProviderField field="intro" fallback={<>
        Connect your favorite tools and services to your account
      </>} inline /></p>
      <div className="mt-12 grid grid-cols-1 gap-6 sm:mt-16 sm:grid-cols-2 lg:grid-cols-3">
        {<ProviderItems field="logos" templates={integrations}>{(providerItems) => providerItems.map((integration) => (
          <div
            className="relative flex flex-col items-start border bg-card p-8"
            key={integration.title}
          >
            {/* Decorative borders */}
            <div className="absolute inset-x-0 bottom-0 h-2 w-full border-t border-dashed bg-muted/75" />
            <div className="absolute inset-x-0 top-0 h-2 w-full border-b border-dashed bg-muted/75" />
            <div className="absolute inset-y-0 left-0 h-full w-2 border-e border-dashed bg-muted/75" />
            <div className="absolute inset-y-0 right-0 h-full w-2 border-s border-dashed bg-muted/75" />

            <Image
              alt={integration.title}
              className="size-10 rounded-sm"
              src={`about:blank#upstream-sha256:af5ee`}
            />
            <h3 className="mt-5 font-medium text-xl">{integration.title}</h3>
            <p className="mt-1.5 text-pretty text-muted-foreground tracking-normal">
              {integration.description}
            </p>
          </div>
        ))}</ProviderItems>}
      </div>
    </div>
  );
}

const integrations = [
  {
    title: "PostHog",
    description: "PostHog is an open-source product analytics tool.",
    url: "about:blank#upstream-sha256:13e1e",
  },
  {
    title: "Mailchimp",
    description:
      "Marketing platform for creating, sending, and automating emails.",
    url: "about:blank#upstream-sha256:846e2",
  },
  {
    title: "Webflow",
    description: "Website builder for creating and managing websites.",
    url: "about:blank#upstream-sha256:3b7f0",
    status: "pending",
  },
  {
    title: "Stripe",
    description: "Payment processing for online businesses and platforms.",
    url: "about:blank#upstream-sha256:9abab",
  },
  {
    title: "Sanity",
    description:
      "Content management system for creating and managing websites.",
    url: "about:blank#upstream-sha256:5aff9",
    status: "pending",
  },
  {
    title: "Zapier",
    description:
      "Automation tool for connecting and syncing data between different apps and services.",
    url: "about:blank#upstream-sha256:0e878",
  },
];
