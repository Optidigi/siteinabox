// @ts-nocheck -- pinned upstream literal with SIAB runtime-only import adaptations
import { ProviderAction, ProviderContactLink, ProviderDemoOnly, ProviderField, ProviderImage, ProviderItemField, ProviderItemLink, ProviderItems, ProviderLogo } from "../../runtime/content";
import Image from "../../runtime/image";
import { ArrowUpRight } from "lucide-react";
import { Badge } from "@siteinabox/ui/providers/shadcnui-blocks/radix-nova";
import { Button } from "@siteinabox/ui/providers/shadcnui-blocks/radix-nova";

export default function Integrations() {
  return (
    <div className="mx-auto flex max-w-7xl flex-col px-6 py-12 sm:py-14">
      <h2 className="text-center font-medium text-4xl tracking-[-0.04em] sm:text-[2.75rem]"><ProviderField field="title" fallback={<>
        Connect your tools
      </>} inline /></h2>
      <p className="mt-3 text-pretty text-center text-muted-foreground text-xl -tracking-[0.01em] sm:text-2xl"><ProviderField field="intro" fallback={<>
        Connect your favorite tools and services to your account
      </>} inline /></p>
      <div className="mt-12 grid grid-cols-1 gap-5 sm:mt-16 sm:grid-cols-2 lg:grid-cols-3">
        {<ProviderItems field="logos" templates={integrations}>{(providerItems) => providerItems.map((integration) => (
          <div
            className="flex items-center gap-4 rounded-lg border border-border/85 bg-card pe-4 shadow-xs/2"
            key={integration.title}
          >
            <div className="border-e border-dashed p-4">
              <Image
                alt={integration.title}
                className="size-8 rounded"
                src={`about:blank#upstream-sha256:af5ee`}
              />
            </div>
            <h3 className="font-medium text-lg">{integration.title}</h3>

            {integration.status === "connected" ? (
              <Badge className="ms-auto h-7 min-w-26 rounded-lg bg-emerald-600/10 px-3 text-emerald-600 text-sm">
                Connected
              </Badge>
            ) : (
              <Button className="ms-auto h-7.5" size="sm" variant="outline">
                Connect <ArrowUpRight />
              </Button>
            )}
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
    status: "connected",
  },
  {
    title: "Mailchimp",
    description:
      "Marketing platform for creating, sending, and automating emails.",
    url: "about:blank#upstream-sha256:846e2",
    status: "pending",
  },
  {
    title: "Notion",
    description:
      "Note-taking and project management tool for organizing ideas, tasks, and documents.",
    url: "about:blank#upstream-sha256:203e7",
    status: "pending",
  },
  {
    title: "Stripe",
    description: "Payment processing for online businesses and platforms.",
    url: "about:blank#upstream-sha256:9abab",
    status: "pending",
  },
  {
    title: "Resend",
    description: "Email platform for developers to send, track, and manage.",
    url: "about:blank#upstream-sha256:48e70",
    status: "pending",
  },
  {
    title: "Zapier",
    description:
      "Automation tool for connecting and syncing data between different apps and services.",
    url: "about:blank#upstream-sha256:0e878",
    status: "pending",
  },
  {
    title: "Cal.com",
    description:
      "Calendar booking tool for scheduling meetings and appointments.",
    url: "about:blank#upstream-sha256:cf27f",
    status: "pending",
  },
  {
    title: "Linear",
    description: "Project management tool for tracking tasks and projects.",
    url: "about:blank#upstream-sha256:0d094",
    status: "connected",
  },
  {
    title: "Plausible",
    description:
      "Analytics tool for tracking website traffic and user behavior.",
    url: "about:blank#upstream-sha256:60ff4",
    status: "pending",
  },
  {
    title: "Webflow",
    description: "Website builder for creating and managing websites.",
    url: "about:blank#upstream-sha256:3b7f0",
    status: "pending",
  },
  {
    title: "Sanity",
    description:
      "Content management system for creating and managing websites.",
    url: "about:blank#upstream-sha256:5aff9",
    status: "pending",
  },
  {
    title: "Clerk",
    description: "Authentication for your website and application.",
    url: "about:blank#upstream-sha256:28160",
    status: "pending",
  },
];
