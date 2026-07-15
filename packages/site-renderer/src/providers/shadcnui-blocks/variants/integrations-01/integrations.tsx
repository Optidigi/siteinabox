// @ts-nocheck -- pinned upstream literal with SIAB runtime-only import adaptations
import Image from "../../runtime/image";
import { ArrowUpRight } from "lucide-react";
import { Button } from "@siteinabox/ui/providers/shadcnui-blocks/radix-nova";

export default function Integrations() {
  return (
    <div className="mx-auto flex max-w-7xl flex-col px-6 py-20">
      <h2 className="text-center font-medium text-4xl tracking-[-0.04em] sm:text-[2.75rem]">
        Our Integrations
      </h2>
      <p className="mt-3 text-pretty text-center text-muted-foreground text-xl -tracking-[0.01em] sm:text-2xl">
        Connect your favorite tools and services
      </p>
      <div className="mt-12 grid grid-cols-1 gap-6 sm:mt-16 sm:grid-cols-2 lg:grid-cols-3">
        {integrations.map((integration) => (
          <div
            className="flex flex-col items-start rounded-lg border bg-card p-6 shadow-xs/3"
            key={integration.title}
          >
            <div className="grow">
              <Image
                alt={integration.title}
                className="size-10 rounded"
                src={`about:blank#upstream-sha256:af5ee`}
              />
              <h3 className="mt-5 font-medium text-xl">{integration.title}</h3>
              <p className="mt-1 text-pretty text-muted-foreground tracking-normal">
                {integration.description}
              </p>
            </div>

            <Button className="mt-6">
              Connect <ArrowUpRight />
            </Button>
          </div>
        ))}
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
