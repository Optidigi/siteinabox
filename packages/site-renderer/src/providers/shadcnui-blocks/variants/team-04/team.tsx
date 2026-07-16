// @ts-nocheck -- pinned upstream literal with SIAB runtime-only import adaptations
import { ProviderAction, ProviderContactLink, ProviderDemoOnly, ProviderField, ProviderImage, ProviderItemField, ProviderItemLink, ProviderItems, ProviderLogo } from "../../runtime/content";
import { DribbbleIcon, TwitchIcon, TwitterIcon } from "../../runtime/social-icons";
import Image from "../../runtime/image";
import Link from "../../runtime/link";
import { Button } from "@siteinabox/ui/providers/shadcnui-blocks/radix-nova";

const teamMembers = [
  {
    name: "John Doe",
    title: "Founder & CEO",
    bio: "Former founder of Opendoor. Early staff at Spotify.",
    imageUrl:
      "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='1024' height='1024' viewBox='0 0 1024 1024'%3E%3C/svg%3E#sha256:1bf22",
  },
  {
    name: "Jane Doe",
    title: "Engineering Manager",
    bio: "Lead engineering teams at Figma and Protocol Labs.",
    imageUrl:
      "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='1024' height='1024' viewBox='0 0 1024 1024'%3E%3C/svg%3E#sha256:488d6",
  },
  {
    name: "Bob Smith",
    title: "Product Manager",
    bio: "Former PM for Linear, Lambda School, and On Deck.",
    imageUrl:
      "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='1024' height='1024' viewBox='0 0 1024 1024'%3E%3C/svg%3E#sha256:41bea",
  },
  {
    name: "Peter Johnson",
    title: "Frontend Developer",
    bio: "Former frontend dev for Linear, Coinbase, and Postscript.",
    imageUrl:
      "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='1024' height='1024' viewBox='0 0 1024 1024'%3E%3C/svg%3E#sha256:61bb8",
  },
  {
    name: "David Lee",
    title: "Backend Developer",
    bio: "Lead backend dev at Clearbit. Former Clearbit and Loom.",
    imageUrl:
      "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='1024' height='1024' viewBox='0 0 1024 1024'%3E%3C/svg%3E#sha256:af976",
  },
  {
    name: "Sarah Williams",
    title: "Product Designer",
    bio: "Founding design team at Figma. Former Pleo and Stripe.",
    imageUrl:
      "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='1024' height='1024' viewBox='0 0 1024 1024'%3E%3C/svg%3E#sha256:b20ed",
  },
  {
    name: "Michael Brown",
    title: "UX Researcher",
    bio: "Lead user research for Slack. Contractor for Netflix.",
    imageUrl:
      "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='1024' height='1024' viewBox='0 0 1024 1024'%3E%3C/svg%3E#sha256:4855b",
  },
  {
    name: "Elizabeth Johnson",
    title: "Customer Success",
    bio: "Lead CX at Wealthsimple. Former PagerDuty.",
    imageUrl:
      "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='1024' height='1024' viewBox='0 0 1024 1024'%3E%3C/svg%3E#sha256:02613",
  },
];

const Team = () => {
  return (
    <div className="mx-auto flex max-w-(--breakpoint-xl) flex-col justify-center gap-16 px-6 py-20 lg:px-8">
      <div className="mx-auto max-w-2xl text-center">
        <b className="text-center font-medium text-muted-foreground text-sm uppercase">
          We&apos;re hiring!
        </b>
        <h2 className="mt-3 font-medium text-4xl tracking-[-0.04em] sm:text-[2.75rem]"><ProviderField field="title" fallback={<>
          Team behind the product
        </>} inline /></h2>
        <p className="mt-4 text-pretty text-base text-muted-foreground sm:text-xl"><ProviderField field="intro" fallback={<>
          Our philosophy is simple — hire a team of diverse, passionate people
          and foster a culture that empowers you to do you best work.
        </>} inline /></p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row-reverse sm:justify-center">
          <ProviderDemoOnly fallback={<><Button size="lg">Open Positions</Button></>} />
          <ProviderDemoOnly fallback={<><Button size="lg" variant="outline">
            About Us
          </Button></>} />
        </div>
      </div>

      <div className="grid w-full grid-cols-1 gap-x-10 gap-y-12 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
        {<ProviderItems field="members" templates={teamMembers}>{(providerItems) => providerItems.map((member) => (
          <div
            className="flex flex-col items-center rounded-lg bg-accent px-6 py-8 text-center"
            key={member.name}
          >
            <Image
              alt={member.name}
              className="h-16 w-16 shrink-0 rounded-full bg-accent object-cover sm:h-20 sm:w-20"
              height={120}
              src={member.imageUrl}
              width={120}
            />
            <h3 className="mt-5 font-medium text-lg">{member.name}</h3>
            <p className="text-muted-foreground text-sm">{member.title}</p>
            <p className="mt-3 mb-6 text-pretty">{member.bio}</p>
            <div className="mt-auto flex items-center gap-4">
              <ProviderItemLink value={member.links?.[0]} fallback={<><Link href="#" target="_blank">
                <TwitterIcon className="h-5 w-5 stroke-muted-foreground" />
              </Link></>} />
              <ProviderItemLink value={member.links?.[1]} fallback={<><Link href="#" target="_blank">
                <DribbbleIcon className="h-5 w-5 stroke-muted-foreground" />
              </Link></>} />
              <ProviderItemLink value={member.links?.[2]} fallback={<><Link href="#" target="_blank">
                <TwitchIcon className="h-5 w-5 stroke-muted-foreground" />
              </Link></>} />
            </div>
          </div>
        ))}</ProviderItems>}
      </div>
    </div>
  );
};

export default Team;
