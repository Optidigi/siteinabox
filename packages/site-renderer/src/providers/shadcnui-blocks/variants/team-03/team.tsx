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
    bio: "Former co-founder of Opendoor. Early staff at Spotify.",
    imageUrl:
      "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='1024' height='1024' viewBox='0 0 1024 1024'%3E%3C/svg%3E#sha256:1bf22",
  },
  {
    name: "Jane Doe",
    title: "Engineering Manager",
    bio: "Lead engineering teams at Figma, Pitch, and Protocol Labs.",
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
    bio: "Founding design team at Figma. Former Pleo, Stripe, and Tile.",
    imageUrl:
      "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='1024' height='1024' viewBox='0 0 1024 1024'%3E%3C/svg%3E#sha256:b20ed",
  },
];

const Team = () => {
  return (
    <div className="mx-auto flex max-w-(--breakpoint-xl) flex-col justify-center gap-14 px-6 py-20 lg:flex-row lg:px-8">
      <div className="sm:max-w-sm lg:max-w-xs">
        <b className="font-medium text-muted-foreground text-sm uppercase">
          Our team
        </b>
        <h2 className="mt-3 font-medium text-3xl tracking-[-0.04em] md:text-4xl"><ProviderField field="title" fallback={<>
          Leadership Team
        </>} inline /></h2>
        <p className="mt-4 text-base text-foreground/80 sm:text-lg"><ProviderField field="intro" fallback={<>
          We&apos;re a cross-disciplinary team that loves to create great
          experiences for our customers.
        </>} inline /></p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row-reverse sm:justify-end">
          <ProviderDemoOnly fallback={<><Button size="lg">Open Positions</Button></>} />
          <ProviderDemoOnly fallback={<><Button size="lg" variant="outline">
            About Us
          </Button></>} />
        </div>
      </div>

      <div className="grid w-full grid-cols-1 gap-x-10 gap-y-12 sm:grid-cols-2 md:grid-cols-3">
        {<ProviderItems field="members" templates={teamMembers}>{(providerItems) => providerItems.map((member) => (
          <div className="flex items-start gap-4 md:flex-col" key={member.name}>
            <Image
              alt={member.name}
              className="h-16 w-16 shrink-0 rounded-full bg-secondary object-cover sm:h-20 sm:w-20"
              height={120}
              src={member.imageUrl}
              width={120}
            />
            <div>
              <h3 className="font-medium text-lg">{member.name}</h3>
              <p className="text-muted-foreground text-sm">{member.title}</p>
              <p className="mt-2 text-foreground/90">{member.bio}</p>
              <div className="mt-4 flex items-center gap-2.5">
                <ProviderItemLink value={member.links?.[0]} fallback={<><Button asChild size="icon" variant="secondary">
                  <Link href="#" target="_blank">
                    <TwitterIcon className="stroke-muted-foreground" />
                  </Link>
                </Button></>} />
                <ProviderItemLink value={member.links?.[1]} fallback={<><Button asChild size="icon" variant="secondary">
                  <Link href="#" target="_blank">
                    <DribbbleIcon className="stroke-muted-foreground" />
                  </Link>
                </Button></>} />
                <ProviderItemLink value={member.links?.[2]} fallback={<><Button asChild size="icon" variant="secondary">
                  <Link href="#" target="_blank">
                    <TwitchIcon className="stroke-muted-foreground" />
                  </Link>
                </Button></>} />
              </div>
            </div>
          </div>
        ))}</ProviderItems>}
      </div>
    </div>
  );
};

export default Team;
