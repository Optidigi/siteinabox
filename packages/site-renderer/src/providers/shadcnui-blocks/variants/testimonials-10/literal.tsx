// @ts-nocheck -- pinned upstream literal with SIAB runtime-only import adaptations
import Image from "../../runtime/image";
const testimonials = [
  {
    name: "Sarah Johnson",
    role: "Product Designer at Canva",
    avatar: "data:image/gif;base64,R0lGODlhAQABAAAAACw=#sha256:1afc9",
    testimonial:
      "This product completely changed the way I work. The interface is intuitive and the performance is top-notch.",
  },
  {
    name: "Daniel Kim",
    role: "CTO at NextLaunch",
    avatar: "data:image/gif;base64,R0lGODlhAQABAAAAACw=#sha256:9e883",
    testimonial:
      "We integrated this solution into our stack within days, and the benefits were immediate. Our team collaboration improved, deployment times dropped, and the analytics insights have helped us fine-tune performance at every level.",
  },
  {
    name: "Emily Chen",
    role: "Marketing Manager at HubSpot",
    avatar: "data:image/gif;base64,R0lGODlhAQABAAAAACw=#sha256:4dca5",
    testimonial:
      "I've worked with multiple marketing platforms over the years, but none have offered the kind of personalized experience and seamless integration that this one does. It has truly elevated our campaigns and improved our ROI.",
  },
  {
    name: "Raj Mehta",
    role: "Frontend Developer at Zomato",
    avatar: "data:image/gif;base64,R0lGODlhAQABAAAAACw=#sha256:6f6a8",
    testimonial: "Clean, fast, and reliable. Everything a dev could ask for.",
  },
  {
    name: "Aisha Patel",
    role: "Software Engineer at Swiggy",
    avatar: "data:image/gif;base64,R0lGODlhAQABAAAAACw=#sha256:3e0f4",
    testimonial: "Smooth and delightful experience!",
  },
  {
    name: "Liam Garcia",
    role: "Startup Founder",
    avatar: "data:image/gif;base64,R0lGODlhAQABAAAAACw=#sha256:e4121",
    testimonial:
      "I've used dozens of tools in the past year alone, and this is one of the few I'd actually recommend to other founders. It doesn't just work — it works smart. Everything feels thoughtfully designed and built with care.",
  },
];

const Testimonials = () => {
  return (
    <div className="mx-auto max-w-7xl px-6 py-12 sm:py-20">
      <h2 className="text-center font-medium text-4xl tracking-[-0.04em] md:text-[2.75rem]">
        Loved by Our Users
      </h2>
      <p className="mt-2 text-balance text-center text-lg text-muted-foreground tracking-[-0.015em] sm:mt-4 sm:text-2xl">
        Their experiences speak louder than words
      </p>

      <div className="mx-auto mt-16 max-w-5xl columns-1 gap-6 sm:columns-2 lg:columns-3">
        {testimonials.map(({ name, avatar, role, testimonial }, index) => (
          <div
            className="mb-6 break-inside-avoid rounded-lg border bg-muted p-1"
            key={index}
          >
            <div className="relative flex flex-col rounded-md border bg-linear-to-bl from-muted/50 via-background to-background px-5 pt-10 pb-3 dark:border-muted-foreground/30 dark:bg-background">
              {/* Quote */}
              <span className="absolute top-0 left-4 font-satoshi text-9xl text-foreground/30">
                &ldquo;
              </span>

              <p className="grow py-6 font-medium text-lg">{testimonial}</p>
              <div className="mt-2 flex items-center gap-3 py-3.5 sm:mt-4">
                <Image
                  alt=""
                  className="h-12 w-12 rounded-full ring-2 ring-border ring-offset-[2px] ring-offset-background"
                  src={avatar}
                />
                <div className="flex flex-col">
                  <p className="font-medium">{name}</p>
                  <p className="text-muted-foreground text-sm">{role}</p>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Testimonials;
