// @ts-nocheck -- pinned upstream literal with SIAB runtime-only import adaptations
import Image from "../../runtime/image";
const teamMembers = [
  {
    name: "Liam Martinez",
    image: "data:image/gif;base64,R0lGODlhAQABAAAAACw=#sha256:9e883",
    role: "Chief Technology Officer",
  },
  {
    name: "Ava Thompson",
    image: "data:image/gif;base64,R0lGODlhAQABAAAAACw=#sha256:1afc9",
    role: "Chief Executive Officer",
  },
  {
    name: "Sophia Patel",
    image: "data:image/gif;base64,R0lGODlhAQABAAAAACw=#sha256:4dca5",
    role: "Head of Design",
  },
  {
    name: "Noah Chen",
    image: "data:image/gif;base64,R0lGODlhAQABAAAAACw=#sha256:4da3c",
    role: "Product Manager",
  },
  {
    name: "Emma Garcia",
    image: "data:image/gif;base64,R0lGODlhAQABAAAAACw=#sha256:3e0f4",
    role: "Software Engineer",
  },
  {
    name: "Ethan Kim",
    image: "data:image/gif;base64,R0lGODlhAQABAAAAACw=#sha256:e4121",
    role: "DevOps Engineer",
  },
  {
    name: "Mia Johnson",
    image: "data:image/gif;base64,R0lGODlhAQABAAAAACw=#sha256:4d5d6",
    role: "Marketing Lead",
  },
  {
    name: "Oliver Singh",
    image: "data:image/gif;base64,R0lGODlhAQABAAAAACw=#sha256:6f6a8",
    role: "Customer Success Manager",
  },
];

const Team = () => {
  return (
    <div className="mx-auto max-w-7xl px-6 py-20">
      <h2 className="text-balance text-center font-medium text-3xl capitalize tracking-[-0.04em] sm:text-4xl md:text-[2.75rem]">
        Our core team
      </h2>
      <p className="mt-3 text-balance text-center text-lg text-muted-foreground tracking-[-0.01em] md:text-2xl">
        Passionate people building great products
      </p>

      <div className="mt-12 grid grid-cols-1 gap-10 sm:mt-16 sm:grid-cols-2 lg:grid-cols-4">
        {teamMembers.map((member, index) => (
          <div key={index}>
            <div className="aspect-square overflow-hidden rounded-lg">
              <Image alt={member.name} src={member.image} />
            </div>
            <p className="mt-4 font-medium text-lg">{member.name}</p>
            <p className="text-muted-foreground">{member.role}</p>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Team;
