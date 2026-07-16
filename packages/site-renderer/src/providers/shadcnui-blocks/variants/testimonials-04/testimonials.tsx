// @ts-nocheck -- pinned upstream literal with SIAB runtime-only import adaptations
import { ProviderAction, ProviderContactLink, ProviderDemoOnly, ProviderField, ProviderImage, ProviderItemField, ProviderItemLink, ProviderItems, ProviderLogo } from "../../runtime/content";
import Link from "../../runtime/link";
import type { ComponentProps } from "react";
import { Avatar, AvatarFallback } from "@siteinabox/ui/providers/shadcnui-blocks/radix-nova";
import { Button } from "@siteinabox/ui/providers/shadcnui-blocks/radix-nova";
import { Marquee } from "@siteinabox/ui/providers/shadcnui-blocks/radix-nova";

const testimonials = [
  {
    id: 1,
    name: "John Doe",
    designation: "Software Engineer",
    company: "TechCorp",
    testimonial:
      "This product has completely transformed the way we work. The efficiency and ease of use are unmatched!",
    avatar: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='1024' height='1024' viewBox='0 0 1024 1024'%3E%3C/svg%3E#sha256:4342c",
  },
  {
    id: 2,
    name: "Sophia Lee",
    designation: "Data Analyst",
    company: "InsightTech",
    testimonial:
      "This tool has saved me hours of work! The analytics and reporting features are incredibly powerful.",
    avatar: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='1024' height='1024' viewBox='0 0 1024 1024'%3E%3C/svg%3E#sha256:2bbeb",
  },
  {
    id: 3,
    name: "Michael Johnson",
    designation: "UX Designer",
    company: "DesignPro",
    testimonial:
      "An amazing tool that simplifies complex tasks. Highly recommended for professionals in the industry.",
    avatar: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='1024' height='1024' viewBox='0 0 1024 1024'%3E%3C/svg%3E#sha256:d2820",
  },
  {
    id: 4,
    name: "Emily Davis",
    designation: "Marketing Specialist",
    company: "BrandBoost",
    testimonial:
      "I've seen a significant improvement in our team's productivity since we started using this service.",
    avatar: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='1024' height='1024' viewBox='0 0 1024 1024'%3E%3C/svg%3E#sha256:26b2d",
  },
  {
    id: 5,
    name: "Daniel Martinez",
    designation: "Full-Stack Developer",
    company: "CodeCrafters",
    testimonial:
      "The best investment we've made! The support team is also super responsive and helpful.",
    avatar: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='1024' height='1024' viewBox='0 0 1024 1024'%3E%3C/svg%3E#sha256:b52fd",
  },
  {
    id: 6,
    name: "Jane Smith",
    designation: "Product Manager",
    company: "InnovateX",
    testimonial:
      "The user experience is top-notch! The interface is clean, intuitive, and easy to navigate.",
    avatar: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='1024' height='1024' viewBox='0 0 1024 1024'%3E%3C/svg%3E#sha256:f0fb6",
  },
];

const Testimonials = () => (
  <div className="px-6 py-20">
    <h2 className="text-center font-medium text-4xl tracking-[-0.04em] md:text-[2.75rem]"><ProviderField field="title" fallback={<>
      Success Stories
    </>} inline /></h2>
    <p className="mt-3.5 text-center text-muted-foreground text-xl tracking-[-0.015em] md:text-2xl"><ProviderField field="intro" fallback={<>
      Real stories from people who use and love our product every day
    </>} inline /></p>
    <div className="mask-x-from-80% mt-14">
      <Marquee className="[--duration:60s]" pauseOnHover>
        <TestimonialList />
      </Marquee>
      <Marquee className="mt-0 [--duration:60s]" pauseOnHover reverse>
        <TestimonialList />
      </Marquee>
    </div>
  </div>
);

const TestimonialList = () =>
  <ProviderItems field="items" templates={testimonials}>{(providerItems) => providerItems.map((testimonial) => (
    <div
      className="min-w-96 max-w-sm rounded-xl bg-accent p-6"
      key={testimonial.id}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Avatar className="size-10">
            <AvatarFallback className="bg-primary font-medium text-primary-foreground text-xl">
              {testimonial.name.charAt(0)}
            </AvatarFallback>
          </Avatar>
          <div>
            <p className="font-medium">{testimonial.name}</p>
            <p className="text-muted-foreground text-sm">
              {testimonial.designation}
            </p>
          </div>
        </div>
        <Button asChild size="icon" variant="ghost">
          <Link href="#" target="_blank">
            <TwitterLogo className="h-4 w-4" />
          </Link>
        </Button>
      </div>
      <p className="mt-5 text-[17px]">{testimonial.testimonial}</p>
    </div>
  ))}</ProviderItems>;

const TwitterLogo = (props: ComponentProps<"svg">) => (
  <svg
    role="img"
    viewBox="0 0 24 24"
    xmlns="http://www.w3.org/2000/svg"
    {...props}
  >
    <title>X</title>
    <path
      d="M18.901 1.153h3.68l-8.04 9.19L24 22.846h-7.406l-5.8-7.584-6.638 7.584H.474l8.6-9.83L0 1.154h7.594l5.243 6.932ZM17.61 20.644h2.039L6.486 3.24H4.298Z"
      fill="currentColor"
    />
  </svg>
);

export default Testimonials;
