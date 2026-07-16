// @ts-nocheck -- pinned upstream literal with SIAB runtime-only import adaptations
import { ProviderAction, ProviderContactLink, ProviderDemoOnly, ProviderField, ProviderImage, ProviderItemField, ProviderItemLink, ProviderItems, ProviderLogo } from "../../runtime/content";
import Image from "../../runtime/image";
import { Separator } from "@siteinabox/ui/providers/shadcnui-blocks/radix-nova";

const testimonials = [
  {
    name: "Sarah Johnson",
    role: "Product Designer at Canva",
    avatar: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='1024' height='1024' viewBox='0 0 1024 1024'%3E%3C/svg%3E#sha256:1afc9",
    testimonial:
      "This product completely changed the way I work. The interface is intuitive and the performance is top-notch.",
  },
  {
    name: "Raj Mehta",
    role: "Frontend Developer at Zomato",
    avatar: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='1024' height='1024' viewBox='0 0 1024 1024'%3E%3C/svg%3E#sha256:9e883",
    testimonial:
      "It’s rare to find a tool that blends design and usability so well. Highly recommend it to all developers!",
  },
  {
    name: "Emily Chen",
    role: "Marketing Manager at HubSpot",
    avatar: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='1024' height='1024' viewBox='0 0 1024 1024'%3E%3C/svg%3E#sha256:4dca5",
    testimonial:
      "The experience has been seamless from day one. Great support, fast delivery, and amazing value.",
  },
  {
    name: "Daniel Kim",
    role: "CTO at NextLaunch",
    avatar: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='1024' height='1024' viewBox='0 0 1024 1024'%3E%3C/svg%3E#sha256:6f6a8",
    testimonial:
      "We integrated this solution into our workflow and saw an instant boost in productivity and collaboration.",
  },
  {
    name: "Aisha Patel",
    role: "Software Engineer at Swiggy",
    avatar: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='1024' height='1024' viewBox='0 0 1024 1024'%3E%3C/svg%3E#sha256:3e0f4",
    testimonial:
      "I've used several tools in this category, but nothing matches the polish and reliability of this one.",
  },
  {
    name: "Liam Garcia",
    role: "Startup Founder",
    avatar: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='1024' height='1024' viewBox='0 0 1024 1024'%3E%3C/svg%3E#sha256:e4121",
    testimonial:
      "As a founder, I care about speed and simplicity. This product delivers on both fronts beautifully.",
  },
];

const Testimonials = () => {
  return (
    <div className="mx-auto max-w-7xl px-6 py-12 sm:py-20">
      <h2 className="text-center font-medium text-4xl tracking-[-0.04em] md:text-[2.75rem]"><ProviderField field="title" fallback={<>
        Testimonials
      </>} inline /></h2>
      <p className="mt-2.5 text-balance text-center text-lg text-muted-foreground tracking-normal sm:text-2xl"><ProviderField field="intro" fallback={<>
        What our customers say about us
      </>} inline /></p>

      <div className="mx-auto mt-16 grid max-w-5xl grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {<ProviderItems field="items" templates={testimonials}>{(providerItems) => providerItems.map(({ name, avatar, role, testimonial }, index) => (
          <div
            className="relative flex flex-col rounded-lg border border-border/85 bg-card pb-1 shadow-xs/3"
            key={index}
          >
            <p className="grow rounded-t-lg px-5 py-6 font-medium text-lg">
              {testimonial}
            </p>
            <Separator />
            <div className="flex items-center gap-3 px-5 py-3.5">
              <Image alt="" className="h-10 w-10 rounded-full" src={avatar} />
              <div className="flex flex-col">
                <p className="font-medium">{name}</p>
                <p className="text-muted-foreground text-sm">{role}</p>
              </div>
            </div>
          </div>
        ))}</ProviderItems>}
      </div>
    </div>
  );
};

export default Testimonials;
