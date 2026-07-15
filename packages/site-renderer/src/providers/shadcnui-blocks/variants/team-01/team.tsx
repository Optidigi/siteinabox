// @ts-nocheck -- pinned upstream literal with SIAB runtime-only import adaptations
import Image from "../../runtime/image";

const teamMembers = [
  {
    name: "John Doe",
    title: "Founder & CEO",
    imageUrl:
      "data:image/gif;base64,R0lGODlhAQABAAAAACw=#sha256:1bf22",
  },
  {
    name: "Jane Doe",
    title: "Engineering Manager",
    imageUrl:
      "data:image/gif;base64,R0lGODlhAQABAAAAACw=#sha256:488d6",
  },
  {
    name: "Bob Smith",
    title: "Product Manager",
    imageUrl:
      "data:image/gif;base64,R0lGODlhAQABAAAAACw=#sha256:41bea",
  },
  {
    name: "Peter Johnson",
    title: "Frontend Developer",
    imageUrl:
      "data:image/gif;base64,R0lGODlhAQABAAAAACw=#sha256:61bb8",
  },
  {
    name: "David Lee",
    title: "Backend Developer",
    imageUrl:
      "data:image/gif;base64,R0lGODlhAQABAAAAACw=#sha256:af976",
  },
  {
    name: "Sarah Williams",
    title: "Product Designer",
    imageUrl:
      "data:image/gif;base64,R0lGODlhAQABAAAAACw=#sha256:b20ed",
  },
  {
    name: "Michael Brown",
    title: "UX Researcher",
    imageUrl:
      "data:image/gif;base64,R0lGODlhAQABAAAAACw=#sha256:4855b",
  },
  {
    name: "Elizabeth Johnson",
    title: "Customer Success",
    imageUrl:
      "data:image/gif;base64,R0lGODlhAQABAAAAACw=#sha256:02613",
  },
];

const Team = () => {
  return (
    <div className="flex flex-col items-center justify-center px-4 py-20 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-xl text-center">
        <b className="text-center font-medium text-muted-foreground text-sm uppercase">
          We&apos;re hiring!
        </b>
        <h2 className="mt-4 font-medium text-4xl tracking-[-0.04em] sm:text-[2.75rem]">
          Meet Our Team
        </h2>
        <p className="mt-4 text-base text-muted-foreground -tracking-[0.01em] sm:text-xl">
          Our philosophy is simple — hire a team of passionate people and foster
          a culture that empowers you to do you best work.
        </p>
      </div>

      <div className="mx-auto mt-20 grid w-full max-w-(--breakpoint-lg) grid-cols-2 gap-12 sm:grid-cols-3 md:grid-cols-4">
        {teamMembers.map((member) => (
          <div className="text-center" key={member.name}>
            <Image
              alt={member.name}
              className="mx-auto h-20 w-20 rounded-full bg-secondary object-cover"
              height={120}
              src={member.imageUrl}
              width={120}
            />
            <h3 className="mt-5 font-medium text-lg">{member.name}</h3>
            <p className="text-muted-foreground">{member.title}</p>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Team;
