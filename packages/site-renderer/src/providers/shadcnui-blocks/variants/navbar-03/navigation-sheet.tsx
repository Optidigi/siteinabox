import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import { Menu } from "lucide-react";
import Link from "../../runtime/link";
import { Button } from "@siteinabox/ui/providers/shadcnui-blocks/radix-nova";
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from "@siteinabox/ui/providers/shadcnui-blocks/radix-nova";
import { Logo } from "./logo";
import {
  foods,
  travelMenuItems,
} from "./navbar-data";

export const NavigationSheet = () => {
  return (
    <Sheet>
      <VisuallyHidden>
        <SheetTitle>Navigation Menu</SheetTitle>
      </VisuallyHidden>

      <SheetTrigger asChild>
        <Button size="icon" variant="outline">
          <Menu />
        </Button>
      </SheetTrigger>
      <SheetContent className="px-6 py-3">
        <Logo />

        <div className="mt-12 space-y-4 text-base">
          <Link className="inline-block" href="#">
            Home
          </Link>

          <div>
            <div className="font-bold">Food</div>
            <ul className="mt-2 ml-1 space-y-3 border-l pl-4">
              {foods.map((foodItem) => (
                <li key={foodItem.title}>
                  <Link className="flex items-center gap-2" href="#">
                    <foodItem.icon className="mr-2 h-5 w-5 text-muted-foreground" />
                    {foodItem.title}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <div className="font-bold">Travel</div>
            <ul className="mt-2 ml-1 space-y-3 border-l pl-4">
              {travelMenuItems.map((item) => (
                <li key={item.title}>
                  <Link className="flex items-center gap-2" href="#">
                    <item.icon className="mr-2 h-5 w-5 text-muted-foreground" />
                    {item.title}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
};
