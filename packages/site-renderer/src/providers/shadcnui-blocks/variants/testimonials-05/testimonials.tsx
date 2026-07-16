// @ts-nocheck -- pinned upstream literal with SIAB runtime-only import adaptations
import { ProviderAction, ProviderContactLink, ProviderDemoOnly, ProviderField, ProviderImage, ProviderItemField, ProviderItemLink, ProviderItems, ProviderLogo } from "../../runtime/content";
import { StarIcon } from "lucide-react";
import { Avatar, AvatarFallback } from "@siteinabox/ui/providers/shadcnui-blocks/radix-nova";
import { cn } from "@siteinabox/ui/lib/utils";

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
    <div>
      <h2 className="text-center font-medium text-4xl tracking-[-0.04em] md:text-[2.75rem]"><ProviderField field="title" fallback={<>
        Loved by developers
      </>} inline /></h2>
      <p className="mt-4 text-center text-muted-foreground text-xl tracking-[-0.015em] md:text-2xl"><ProviderField field="intro" fallback={<>
        See how developers and teams are achieving more with us
      </>} inline /></p>
      <div className="mx-auto mt-8 w-full max-w-(--breakpoint-xl) sm:mt-14 lg:mt-16">
        <div className="grid grid-cols-1 overflow-hidden md:grid-cols-2 lg:grid-cols-3">
          {<ProviderItems field="items" templates={testimonials}>{(providerItems) => providerItems.map((testimonial) => (
            <div
              className={cn(
                "relative flex flex-col px-6 py-10",
                "before:absolute before:inset-0 before:-m-px before:border-border before:border-r before:border-b before:border-dashed before:content-['']"
              )}
              key={testimonial.id}
            >
              <div className="flex items-center justify-center gap-1">
                <StarIcon className="h-6 w-6 fill-rating stroke-rating" />
                <StarIcon className="h-6 w-6 fill-rating stroke-rating" />
                <StarIcon className="h-6 w-6 fill-rating stroke-rating" />
                <StarIcon className="h-6 w-6 fill-rating stroke-rating" />
                <StarIcon className="h-6 w-6 fill-rating stroke-rating" />
              </div>
              <p className="my-6 max-w-md text-pretty text-center text-[17px]">
                {testimonial.testimonial}
              </p>
              <div className="mt-auto flex items-center justify-center gap-3">
                <Avatar className="size-9">
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
            </div>
          ))}</ProviderItems>}
        </div>
      </div>
    </div>
  </div>
);

export default Testimonials;
