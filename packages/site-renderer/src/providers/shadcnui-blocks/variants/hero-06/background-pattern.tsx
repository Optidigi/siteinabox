// @ts-nocheck -- pinned upstream literal with SIAB runtime-only import adaptations
"use client";
import { useTheme } from "../../runtime/theme";
import DotPattern from "./dot-pattern";
import Particles from "./particles";
import { cn } from "@siteinabox/ui/lib/utils";

export const BackgroundPattern = () => {
  const { resolvedTheme } = useTheme();
  const isLightTheme = resolvedTheme === "light";

  return (
    <>
      <DotPattern
        className={cn(
          "mask-[radial-gradient(ellipse,rgba(0,0,0,0.3)_30%,black_50%)]",
          "dark:fill-muted-foreground/50"
        )}
        cr={1}
        cx={1}
        cy={1}
        height={20}
        width={20}
      />
      <Particles
        className="absolute inset-0"
        color={isLightTheme ? "#000" : "#fff"}
        ease={80}
        quantity={100}
        refresh
      />
    </>
  );
};
