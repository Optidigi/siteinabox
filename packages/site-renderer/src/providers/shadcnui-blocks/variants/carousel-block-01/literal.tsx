// @ts-nocheck -- pinned upstream literal with SIAB runtime-only import adaptations
import Image from "../../runtime/image";
import Link from "../../runtime/link";
import { Button } from "@siteinabox/ui/providers/shadcnui-blocks/radix-nova";
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
    <div className="mx-auto max-w-5xl px-14 py-20">
      <div className="flex items-end justify-between">
        <div>
          <h2 className="font-medium text-3xl tracking-tight">dddepth</h2>
          <p className="mt-2 text-pretty text-lg text-muted-foreground leading-snug">
            A Curated Collection of AI-generated Abstract 3D Shapes
          </p>
        </div>
        <Button className="max-sm:hidden" size="sm" variant="outline">
          <Link href="about:blank#upstream-sha256:92c87" target="_blank">
            View all
          </Link>
        </Button>
      </div>
      <Carousel className="mt-6 w-full" opts={{ loop: true, align: "start" }}>
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
        <div className="mt-4 flex items-center justify-between sm:justify-end">
          <div className="flex items-center justify-end gap-1.5">
            <CarouselPrevious className="-left-10 max-md:static max-md:translate-y-0" />
            <CarouselNext className="-right-10 max-md:static max-md:translate-y-0" />
          </div>

          <Button className="sm:hidden" size="sm" variant="outline">
            <Link href="about:blank#upstream-sha256:92c87">View all</Link>
          </Button>
        </div>
      </Carousel>
    </div>
  );
}
