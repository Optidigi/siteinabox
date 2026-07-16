// @ts-nocheck -- pinned upstream literal with SIAB runtime-only import adaptations
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import { Menu } from "lucide-react";
import { Button } from "@siteinabox/ui/providers/shadcnui-blocks/radix-nova";
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from "@siteinabox/ui/providers/shadcnui-blocks/radix-nova";
import { Logo } from "./logo";
import { NavMenu } from "./nav-menu";

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
        <NavMenu className="mt-6 [&>div]:h-full" orientation="vertical" />
      </SheetContent>
    </Sheet>
  );
};
