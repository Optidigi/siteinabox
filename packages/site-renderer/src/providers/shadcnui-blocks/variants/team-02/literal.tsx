// @ts-nocheck -- pinned upstream literal with SIAB runtime-only import adaptations
import Image from "../../runtime/image";

const teamMembers = [
  {
    name: "John Doe",
    title: "Founder & CEO",
    bio: "Former co-founder of Opendoor. Early staff at Spotify and Clearbit.",
    imageUrl:
      "data:image/gif;base64,R0lGODlhAQABAAAAACw=#sha256:1bf22",
  },
  {
    name: "Jane Doe",
    title: "Engineering Manager",
    bio: "Lead engineering teams at Figma, Pitch, and Protocol Labs.",
    imageUrl:
      "data:image/gif;base64,R0lGODlhAQABAAAAACw=#sha256:488d6",
  },
  {
    name: "Bob Smith",
    title: "Product Manager",
    bio: "Former PM for Linear, Lambda School, and On Deck.",
    imageUrl:
      "data:image/gif;base64,R0lGODlhAQABAAAAACw=#sha256:41bea",
  },
  {
    name: "Peter Johnson",
    title: "Frontend Developer",
    bio: "Former frontend dev for Linear, Coinbase, and Postscript.",
    imageUrl:
      "data:image/gif;base64,R0lGODlhAQABAAAAACw=#sha256:61bb8",
  },
  {
    name: "David Lee",
    title: "Backend Developer",
    bio: "Lead backend dev at Clearbit. Former Clearbit and Loom.",
    imageUrl:
      "data:image/gif;base64,R0lGODlhAQABAAAAACw=#sha256:af976",
  },
  {
    name: "Sarah Williams",
    title: "Product Designer",
    bio: "Founding design team at Figma. Former Pleo, Stripe, and Tile.",
    imageUrl:
      "data:image/gif;base64,R0lGODlhAQABAAAAACw=#sha256:b20ed",
  },
  {
    name: "Michael Brown",
    title: "UX Researcher",
    bio: "Lead user research for Slack. Contractor for Netflix and Udacity.",
    imageUrl:
      "data:image/gif;base64,R0lGODlhAQABAAAAACw=#sha256:4855b",
  },
  {
    name: "Elizabeth Johnson",
    title: "Customer Success",
    bio: "Lead CX at Wealthsimple. Former PagerDuty and Sqreen.",
    imageUrl:
      "data:image/gif;base64,R0lGODlhAQABAAAAACw=#sha256:02613",
  },
];

const Team = () => {
  return (
    <div className="mx-auto flex max-w-(--breakpoint-xl) flex-col justify-center px-6 py-8 sm:py-20 lg:px-8">
      <b className="font-medium text-muted-foreground text-sm uppercase">
        Our team
      </b>
      <h2 className="mt-4 font-medium text-3xl tracking-[-0.04em] md:text-4xl">
        Meet the people behind the product
      </h2>
      <p className="mt-3 text-pretty text-lg text-muted-foreground -tracking-[0.01em] sm:text-xl">
        We&apos;re a 100% remote team spread all across the world. Join us!
      </p>

      <div className="mt-14 grid w-full grid-cols-1 gap-x-8 gap-y-12 sm:mt-20 sm:grid-cols-2 md:grid-cols-4">
        {teamMembers.map((member) => (
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
        ))}
      </div>
    </div>
  );
};

export default Team;
