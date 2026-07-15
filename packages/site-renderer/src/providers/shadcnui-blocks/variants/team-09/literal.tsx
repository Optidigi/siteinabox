// @ts-nocheck -- pinned upstream literal with SIAB runtime-only import adaptations
import Image from "../../runtime/image";
import { Dribbble, Github, Twitter } from "../../runtime/social-icons";
import Link from "../../runtime/link";

const teamMembers = [
  {
    name: "Liam Martinez",
    image: "data:image/gif;base64,R0lGODlhAQABAAAAACw=#sha256:9e883",
    role: "Chief Executive Officer",
  },
  {
    name: "Ava Thompson",
    image: "data:image/gif;base64,R0lGODlhAQABAAAAACw=#sha256:1afc9",
    role: "Chief Technology Officer",
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
      <h2 className="text-balance text-center font-medium text-3xl tracking-[-0.04em] sm:text-4xl md:text-[2.75rem]">
        Built by makers
      </h2>
      <p className="mt-3 text-balance text-center text-lg text-muted-foreground tracking-[-0.01em] md:text-2xl">
        A team that values simplicity and speed
      </p>

      <div className="mt-12 grid grid-cols-1 gap-4 sm:mt-16 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
        {teamMembers.map((member, index) => (
          <div className="border bg-muted py-8" key={index}>
            <div className="mx-auto aspect-square max-w-48 overflow-hidden rounded-full bg-muted">
              <Image alt={member.name} src={member.image} />
            </div>
            <p className="mt-6 text-center font-medium text-lg">
              {member.name}
            </p>
            <p className="mt-0.5 text-center text-muted-foreground">
              {member.role}
            </p>
            <div className="mt-6 flex items-center justify-center gap-4">
              <Link href="#" target="_blank">
                <Twitter className="h-5 w-5 text-muted-foreground hover:text-primary" />
              </Link>
              <Link href="#" target="_blank">
                <Github className="h-5 w-5 text-muted-foreground hover:text-primary" />
              </Link>
              <Link href="#" target="_blank">
                <Dribbble className="h-5 w-5 text-muted-foreground hover:text-primary" />
              </Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Team;
