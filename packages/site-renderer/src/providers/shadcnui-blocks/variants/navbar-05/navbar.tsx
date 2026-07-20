import { Search } from "lucide-react";
import { Button } from "@siteinabox/ui/providers/shadcnui-blocks/radix-nova";
import { Input } from "@siteinabox/ui/providers/shadcnui-blocks/radix-nova";
import { Logo } from "./logo";

const Navbar = () => {
  return (
    <nav className="fixed inset-x-4 top-6 mx-auto h-16 max-w-(--breakpoint-xl) rounded-full border bg-background border-border">
      <div className="mx-auto flex h-full items-center justify-between px-4">
        <div className="flex items-center gap-2 md:gap-6">
          <Logo className="shrink-0" />

          <div className="relative hidden md:block">
            <Search className="absolute inset-y-0 left-2.5 my-auto h-5 w-5" />
            <Input
              className="w-[280px] flex-1 rounded-full border-none bg-muted pl-10 shadow-none"
              placeholder="Search"
            />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            className="rounded-full bg-muted text-foreground shadow-none hover:bg-accent md:hidden"
            size="icon"
          >
            <Search className="h-5! w-5!" />
          </Button>
          <Button
            className="hidden rounded-full sm:inline-flex"
            variant="outline"
          >
            Sign In
          </Button>
          <Button className="rounded-full">Get Started</Button>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
