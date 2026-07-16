// @ts-nocheck -- pinned upstream literal with SIAB runtime-only import adaptations
import { ProviderAction, ProviderContactLink, ProviderDemoOnly, ProviderField, ProviderImage, ProviderItemField, ProviderItemLink, ProviderItems, ProviderLogo } from "../../runtime/content";
import Image from "../../runtime/image";
import { ArrowUpRight } from "lucide-react";
import { Badge } from "@siteinabox/ui/providers/shadcnui-blocks/radix-nova";
import { Button } from "@siteinabox/ui/providers/shadcnui-blocks/radix-nova";

export default function Integrations() {
  return (
    <div className="my-12 px-6 sm:my-14">
      <div className="mx-auto flex w-full max-w-md flex-col rounded-lg border bg-muted p-1 shadow-lg/2">
        <div className="rounded-md border bg-card p-6">
          <h2 className="font-medium text-2xl tracking-tight"><ProviderField field="title" fallback={<>
            Our Integrations
          </>} inline /></h2>
          <p className="mt-1.5 text-pretty text-muted-foreground"><ProviderField field="intro" fallback={<>
            Connect your favorite tools and services to your account and start
            using them in your app.
          </>} inline /></p>
          <div className="mx-auto mt-8 flex w-full flex-col gap-3">
            {<ProviderItems field="logos" templates={integrations}>{(providerItems) => providerItems.map((integration) => (
              <div
                className="flex items-center gap-3 rounded-lg border bg-card px-3 py-3"
                key={integration.title}
              >
                <Image
                  alt={integration.title}
                  className="size-8 rounded-sm"
                  src={`about:blank#upstream-sha256:af5ee`}
                />
                <h3 className="font-medium">{integration.title}</h3>

                {integration.status === "connected" ? (
                  <Badge className="ms-auto h-7 min-w-26 rounded-lg bg-success/10 px-3 text-success text-sm">
                    Connected
                  </Badge>
                ) : (
                  <Button
                    className="ms-auto h-7 min-w-26"
                    size="sm"
                    variant="outline"
                  >
                    Connect <ArrowUpRight />
                  </Button>
                )}
              </div>
            ))}</ProviderItems>}
          </div>
        </div>
      </div>
    </div>
  );
}

const integrations = [
  {
    title: "PostHog",
    description: "PostHog is an open-source product analytics tool.",
    url: "about:blank#upstream-sha256:13e1e",
    status: "connected",
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
