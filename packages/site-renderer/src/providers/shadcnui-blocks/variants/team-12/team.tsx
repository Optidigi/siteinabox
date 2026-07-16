// @ts-nocheck -- pinned upstream literal with SIAB runtime-only import adaptations
import { ProviderAction, ProviderContactLink, ProviderDemoOnly, ProviderField, ProviderImage, ProviderItemField, ProviderItemLink, ProviderItems, ProviderLogo } from "../../runtime/content";
import Image from "../../runtime/image";
import { cn } from "@siteinabox/ui/lib/utils";

const teamMembers = [
  {
    name: "Liam Martinez",
    image: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='1024' height='1024' viewBox='0 0 1024 1024'%3E%3C/svg%3E#sha256:9e883",
    role: "Chief Technology Officer",
  },
  {
    name: "Ava Thompson",
    image: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='1024' height='1024' viewBox='0 0 1024 1024'%3E%3C/svg%3E#sha256:1afc9",
    role: "Chief Executive Officer",
  },
  {
    name: "Sophia Patel",
    image: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='1024' height='1024' viewBox='0 0 1024 1024'%3E%3C/svg%3E#sha256:4dca5",
    role: "Head of Design",
  },
  {
    name: "Noah Chen",
    image: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='1024' height='1024' viewBox='0 0 1024 1024'%3E%3C/svg%3E#sha256:4da3c",
    role: "Product Manager",
  },
  {
    name: "Emma Garcia",
    image: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='1024' height='1024' viewBox='0 0 1024 1024'%3E%3C/svg%3E#sha256:3e0f4",
    role: "Software Engineer",
  },
  {
    name: "Ethan Kim",
    image: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='1024' height='1024' viewBox='0 0 1024 1024'%3E%3C/svg%3E#sha256:e4121",
    role: "DevOps Engineer",
  },
  {
    name: "Mia Johnson",
    image: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='1024' height='1024' viewBox='0 0 1024 1024'%3E%3C/svg%3E#sha256:4d5d6",
    role: "Marketing Lead",
  },
  {
    name: "Oliver Singh",
    image: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='1024' height='1024' viewBox='0 0 1024 1024'%3E%3C/svg%3E#sha256:6f6a8",
    role: "Customer Success Manager",
  },
  {
    name: "Your Name",
    image: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='1024' height='1024' viewBox='0 0 1024 1024'%3E%3C/svg%3E#sha256:6f6a8",
    role: "Your Dream Role",
    isPlaceholder: true,
  },
];

const Team = () => {
  return (
    <div className="mx-auto max-w-7xl px-6 py-20">
      <h2 className="text-balance text-center font-medium text-3xl capitalize tracking-[-0.04em] sm:text-4xl md:text-[2.75rem]"><ProviderField field="title" fallback={<>
        Our core team
      </>} inline /></h2>
      <p className="mt-3 text-balance text-center text-lg text-muted-foreground tracking-[-0.01em] md:text-2xl"><ProviderField field="intro" fallback={<>
        Passionate people building great products
      </>} inline /></p>

      <div className="mt-12 grid grid-cols-1 border border-e-0 border-b-0 max-sm:justify-center sm:mt-18 sm:grid-cols-2 lg:grid-cols-3">
        {<ProviderItems field="members" templates={teamMembers}>{(providerItems) => providerItems.map((member, index) => (
          <div
            className={cn("flex items-center gap-6 border-e border-b p-4", {
              "bg-[repeating-linear-gradient(315deg,color-mix(in_srgb,var(--muted),transparent_50%)_0,color-mix(in_srgb,var(--muted),transparent_50%)_1px,transparent_0,transparent_50%)] bg-size-[10px_10px] bg-fixed":
                member.isPlaceholder,
            })}
            key={index}
          >
            <div className="aspect-square w-20 shrink-0 overflow-hidden rounded bg-foreground/10 dark:bg-muted/75">
              {member.isPlaceholder ? null : (
                <Image
                  alt={member.name}
                  height={80}
                  src={member.image}
                  width={80}
                />
              )}
            </div>
            <div>
              <p className="font-medium text-lg">{member.name}</p>
              <p className="mt-0.5 text-muted-foreground">{member.role}</p>
            </div>
          </div>
        ))}</ProviderItems>}
      </div>
    </div>
  );
};

export default Team;
