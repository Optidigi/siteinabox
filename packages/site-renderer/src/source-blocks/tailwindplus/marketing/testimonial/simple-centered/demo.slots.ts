import type { TestimonialsBlock } from "@siteinabox/contracts"

export const tailwindPlusMarketingTestimonialSimpleCenteredDemoSlots = {
  blockType: "testimonials",
  designVariant: "tailwindPlusSimpleCentered",
  logo: {
    url: "https://tailwindcss.com/plus-assets/img/logos/workcation-logo-indigo-600.svg",
    alt: "",
  },
  items: [
    {
      quote: "“Lorem ipsum dolor sit amet consectetur adipisicing elit. Nemo expedita voluptas culpa sapiente alias molestiae. Numquam corrupti in laborum sed rerum et corporis.”",
      author: "Judith Black",
      role: "CEO of Workcation",
      avatar: {
        url: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?ixlib=rb-1.2.1&ixid=eyJhcHBfaWQiOjEyMDd9&auto=format&fit=facearea&facepad=2&w=256&h=256&q=80",
        alt: "",
      },
    },
  ],
} satisfies TestimonialsBlock
