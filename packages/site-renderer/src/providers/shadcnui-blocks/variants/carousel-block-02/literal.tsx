// @ts-nocheck -- pinned upstream literal with SIAB runtime-only import adaptations
import Image from "../../runtime/image";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@siteinabox/ui/providers/shadcnui-blocks/radix-nova";

const images = [
  "data:image/gif;base64,R0lGODlhAQABAAAAACw=#sha256:6eb8f",
  "data:image/gif;base64,R0lGODlhAQABAAAAACw=#sha256:83463",
  "data:image/gif;base64,R0lGODlhAQABAAAAACw=#sha256:78241",
  "data:image/gif;base64,R0lGODlhAQABAAAAACw=#sha256:c8511",
  "data:image/gif;base64,R0lGODlhAQABAAAAACw=#sha256:1b495",
];

export default function CarouselDemo() {
  return (
    <div className="px-6 py-20">
      <Carousel
        className="mx-auto w-full max-w-5xl"
        opts={{ loop: true, align: "start" }}
      >
        <div className="mb-3 flex items-center justify-end gap-1 md:hidden">
          <CarouselPrevious className="static translate-y-0" />
          <CarouselNext className="static translate-y-0" />
        </div>
        <div className="rounded-xl bg-card p-6 shadow-xl/3 ring ring-border/80">
          <div className="mb-5 flex items-end justify-between">
            <div>
              <h2 className="font-medium text-3xl tracking-tight">dddepth</h2>
              <p className="mt-2 text-lg text-muted-foreground leading-snug">
                A Curated Collection of AI-generated Abstract 3D Shapes
              </p>
            </div>

            <div className="hidden space-x-2 md:block">
              <CarouselPrevious className="static translate-y-0" />
              <CarouselNext className="static translate-y-0" />
            </div>
          </div>

          <CarouselContent>
            {images.map((image, index) => (
              <CarouselItem
                className="basis-1/2 md:basis-1/3 lg:basis-1/4"
                key={index}
              >
                <div className="p-1">
                  <div className="aspect-square">
                    <Image className="rounded-lg object-cover" src={image} />
                  </div>
                </div>
              </CarouselItem>
            ))}
          </CarouselContent>
        </div>
      </Carousel>
    </div>
  );
}
