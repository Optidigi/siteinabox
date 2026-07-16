// @ts-nocheck -- pinned upstream literal with SIAB runtime-only import adaptations
import { ProviderAction, ProviderContactLink, ProviderDemoOnly, ProviderField, ProviderImage, ProviderItemField, ProviderItemLink, ProviderItems, ProviderLogo } from "../../runtime/content";
import Image from "../../runtime/image";

const teamMembers = [
  {
    name: "John Doe",
    title: "Founder & CEO",
    bio: "Former co-founder of Opendoor. Early staff at Spotify and Clearbit.",
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
  {
    name: "Michael Brown",
    title: "UX Researcher",
    bio: "Lead user research for Slack. Contractor for Netflix and Udacity.",
    imageUrl:
      "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='1024' height='1024' viewBox='0 0 1024 1024'%3E%3C/svg%3E#sha256:4855b",
  },
  {
    name: "Elizabeth Johnson",
    title: "Customer Success",
    bio: "Lead CX at Wealthsimple. Former PagerDuty and Sqreen.",
    imageUrl:
      "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='1024' height='1024' viewBox='0 0 1024 1024'%3E%3C/svg%3E#sha256:02613",
  },
];

const Team = () => {
  return (
    <div className="mx-auto flex max-w-(--breakpoint-xl) flex-col justify-center px-6 py-8 sm:py-20 lg:px-8">
      <b className="font-medium text-muted-foreground text-sm uppercase">
        Our team
      </b>
      <h2 className="mt-4 font-medium text-3xl tracking-[-0.04em] md:text-4xl"><ProviderField field="title" fallback={<>
        Meet the people behind the product
      </>} inline /></h2>
      <p className="mt-3 text-pretty text-lg text-muted-foreground -tracking-[0.01em] sm:text-xl"><ProviderField field="intro" fallback={<>
        We&apos;re a 100% remote team spread all across the world. Join us!
      </>} inline /></p>

      <div className="mt-14 grid w-full grid-cols-1 gap-x-8 gap-y-12 sm:mt-20 sm:grid-cols-2 md:grid-cols-4">
        {<ProviderItems field="members" templates={teamMembers}>{(providerItems) => providerItems.map((member) => (
          <div key={member.name}>
            <Image
              alt={member.name}
              className="h-20 w-20 rounded-full bg-secondary object-cover"
              height={120}
              src={member.imageUrl}
              width={120}
            />
            <h3 className="mt-4 font-medium text-lg">{member.name}</h3>
            <p className="text-muted-foreground text-sm">{member.title}</p>
            <p className="mt-3 text-foreground/90">{member.bio}</p>
          </div>
        ))}</ProviderItems>}
      </div>
    </div>
  );
};

export default Team;
