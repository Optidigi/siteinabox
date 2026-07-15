// @ts-nocheck -- pinned upstream literal with SIAB runtime-only import adaptations
import Image from "../../runtime/image";
export default function Integrations() {
  return (
    <div className="mx-auto flex max-w-7xl flex-col px-6 py-12 sm:py-14">
      <h2 className="text-center font-medium text-4xl tracking-[-0.04em] sm:text-[2.75rem]">
        Plug into your stack
      </h2>
      <p className="mt-3 text-pretty text-center text-muted-foreground text-xl -tracking-[0.01em] sm:text-2xl">
        Connect your favorite tools and services to your account
      </p>
      <div className="mt-12 grid grid-cols-1 gap-6 sm:mt-16 sm:grid-cols-2 lg:grid-cols-3">
        {integrations.map((integration) => (
          <div
            className="relative flex flex-col items-start overflow-hidden border bg-card"
            key={integration.title}
          >
            <div className="absolute inset-x-0 top-7 h-9.5 border-y border-dashed bg-muted/30" />
            <div className="absolute inset-y-0 left-7 w-9.5 border-x border-dashed bg-muted/30" />

            <div className="relative isolate flex items-start justify-between gap-5 p-6">
              <div className="w-fit shrink-0 rounded-3xl bg-transparent p-1">
                <div className="relative border bg-background">
                  <Image
                    alt={integration.title}
                    className="absolute inset-0 size-9 blur-[36px]"
                    src={`about:blank#upstream-sha256:af5ee`}
                  />
                  <Image
                    alt={integration.title}
                    className="size-9"
                    src={`about:blank#upstream-sha256:af5ee`}
                  />
                </div>
              </div>
              <div>
                <h3 className="py-2 font-medium text-xl">
                  {integration.title}
                </h3>
                <p className="mt-4 mb-2 text-pretty text-muted-foreground tracking-normal">
                  {integration.description}
                </p>
              </div>
            </div>
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
    title: "Zapier",
    description:
      "Automation tool for connecting and syncing data between different apps.",
    url: "about:blank#upstream-sha256:0e878",
  },
  {
    title: "Webflow",
    description: "Website builder for creating and managing websites.",
    url: "about:blank#upstream-sha256:3b7f0",
    status: "pending",
  },
  {
    title: "Semrush",
    description: "SEO and digital marketing analytics platform.",
    url: "about:blank#upstream-sha256:eaf08",
  },
  {
    title: "Mailchimp",
    description:
      "Marketing platform for creating, sending, and automating emails.",
    url: "about:blank#upstream-sha256:846e2",
  },
  {
    title: "Sanity",
    description:
      "Content management system for creating and managing websites.",
    url: "about:blank#upstream-sha256:5aff9",
    status: "pending",
  },
];
