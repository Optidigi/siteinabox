import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from '@/components/ui/carousel';

const testimonials = [
  {
    logo: '/theme/images/logo/clients/amblast.png',
    alt: 'AMBLAST Facility Services',
    quote: 'Professioneel en strak, precies wat ik zocht. Meerdere mensen merken hoe overzichtelijk de site is. Absoluut een aanrader.',
    name: 'AMBLAST Facility Services',
  },
  {
    logo: '/theme/images/logo/clients/quitantie.png',
    alt: 'Quitantie Inkomensbeheer & Bewindvoering',
    quote: 'Professioneel, gebruiksvriendelijk, en weerspiegelt perfect onze kernwaarden. Het team wist onze verwachtingen te overtreffen.',
    name: 'Rick, Quitantie',
  },
  {
    logo: '/theme/images/logo/clients/kbkc.png',
    alt: 'KBKC & Partners',
    quote: 'Veel zorg en expertise. De samenwerking verliep professioneel en efficiënt, met een duidelijke focus op onze doelen.',
    name: 'KBKC & Partners',
  },
  {
    logo: '/theme/images/logo/clients/rasko.png',
    alt: 'RASKO Bouw en Renovatie',
    quote: 'Een professionele website die perfect aansluit bij mijn bedrijf. Heldere communicatie, heel tevreden met het resultaat.',
    name: 'RASKO Bouw en Renovatie',
  },
];

export function Testimonials() {
  return (
    <Carousel opts={{ loop: true, align: 'center' }} className="w-full" aria-label="Klantbeoordelingen">
      <CarouselContent className="-ml-5">
        {testimonials.map((testimonial, index) => (
          <CarouselItem key={testimonial.name} className="basis-[88%] pl-5 md:basis-[58%] lg:basis-[42%] xl:basis-[36%]">
            <article
              data-analytics-component={`testimonial-${index + 1}`}
              data-analytics-component-type="testimonial"
              data-analytics-component-role="social_proof"
              data-analytics-item={`testimonial-${index + 1}`}
              data-analytics-index={index + 1}
              className={`flex min-h-[400px] flex-col border-2 border-white/[.08] p-[30px_25px_35px] text-white md:min-h-[520px] md:p-9 ${index === 0 ? 'bg-white/[.08]' : 'bg-transparent'}`}
            >
              <img src={testimonial.logo} alt={testimonial.alt} width="192" height="48" className="h-10 w-auto max-w-[200px] object-contain object-left opacity-70 brightness-0 invert transition-[filter,opacity] hover:opacity-100 hover:filter-none motion-reduce:transition-none" />
              <blockquote className="mb-10 mt-8 font-head text-2xl font-medium leading-[1.38] md:mb-14 md:mt-12 md:text-3xl">“{testimonial.quote}”</blockquote>
              <div className="mt-auto flex items-end justify-between gap-4">
                <p className="text-sm font-medium text-white">{testimonial.name}</p>
                <img src="/theme/images/icon/icon_56.svg" alt="" width="38" height="38" className="size-10" />
              </div>
            </article>
          </CarouselItem>
        ))}
      </CarouselContent>
      <CarouselPrevious
        data-analytics-action="previous_testimonial"
        data-analytics-placement="testimonials"
        data-analytics-destination="carousel"
        className="bottom-[-6.75rem] left-[calc(50%-66px)] top-auto size-[58px] translate-y-0 border-white bg-transparent text-white shadow-none [&_svg]:!size-[22px] hover:translate-y-0 hover:bg-white/[.08] active:translate-y-0"
      />
      <CarouselNext
        data-analytics-action="next_testimonial"
        data-analytics-placement="testimonials"
        data-analytics-destination="carousel"
        className="bottom-[-6.75rem] left-[calc(50%+8px)] right-auto top-auto size-[58px] translate-y-0 border-white bg-transparent text-white shadow-none [&_svg]:!size-[22px] hover:translate-y-0 hover:bg-white/[.08] active:translate-y-0"
      />
    </Carousel>
  );
}
