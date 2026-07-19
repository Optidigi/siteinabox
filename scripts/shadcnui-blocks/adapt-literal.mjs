import { transparentSquare } from "./constants.mjs"
import { sha256 } from "./hash.mjs"

/**
 * Generic upstream literal normalization. Must not branch on variant upstream names.
 */
export function adaptLiteralImports(contents) {
  const clientDirective = contents.match(/^\s*(["']use client["'];?)\s*/)
  const literalBody = clientDirective ? contents.slice(clientDirective[0].length) : contents
  const nativeImageImport = contents.includes("<img") && !/from ["']next\/image["']/.test(contents)
    ? 'import Image from "../../runtime/image";\n'
    : ""
  return `// @ts-nocheck -- pinned upstream literal with SIAB runtime-only import adaptations\n${clientDirective ? `${clientDirective[1]}\n` : ""}${nativeImageImport}${literalBody.replaceAll("<img", "<Image")}`
    .replaceAll('import { Accordion as AccordionPrimitive } from "radix-ui";', 'import { AccordionPrimitive } from "@siteinabox/ui/providers/shadcnui-blocks/radix-nova";')
    .replaceAll('import {\n  DribbbleIcon,\n  GithubIcon,\n  TwitchIcon,\n  TwitterIcon,\n} from "lucide-react";', 'import { DribbbleIcon, GithubIcon, TwitchIcon, TwitterIcon } from "../../runtime/social-icons";')
    .replaceAll('import { Dribbble, Github, Twitter, Wheat } from "lucide-react";', 'import { Wheat } from "lucide-react";\nimport { Dribbble, Github, Twitter } from "../../runtime/social-icons";')
    .replaceAll(/import \{ (Dribbble(?:Icon)?), (Github|TwitchIcon), (Twitter(?:Icon)?) \} from ["']lucide-react["'];?/g, 'import { $1, $2, $3 } from "../../runtime/social-icons";')
    .replaceAll(/from ["']next\/link["']/g, 'from "../../runtime/link"')
    .replaceAll(/from ["']next\/image["']/g, 'from "../../runtime/image"')
    .replaceAll(/from ["']@\/lib\/utils["']/g, 'from "@siteinabox/ui/lib/utils"')
    .replaceAll(/import (\w+) from ["']@\/registry\/bases\/radix\/ui\/([^"']+)["']/g, 'import $1 from "./$2"')
    .replaceAll(/from ["']@\/registry\/bases\/radix\/ui\/[^"']+["']/g, 'from "@siteinabox/ui/providers/shadcnui-blocks/radix-nova"')
    .replaceAll(/import \{ Button \} from ["']@\/registry\/ui\/button["'];?/g, 'import { SharedButton as Button } from "@siteinabox/ui/providers/shadcnui-blocks/radix-nova";')
    .replaceAll(/from ["']@\/components\/logos["']/g, 'from "../../runtime/logos"')
    .replaceAll(/from ["']@\/components\/[^"']*\/([^/"']+)["']/g, 'from "./$1"')
    .replaceAll(/from ["']@\/registry\/[^"']+\/([^/"']+)["']/g, 'from "./$1"')
    .replaceAll(/from ["']\.\/[^"']+\/([^/"']+)["']/g, 'from "./$1"')
    .replaceAll(/from ["']next-themes["']/g, 'from "../../runtime/theme"')
    .replaceAll("clip-path=", "clipPath=")
    .replaceAll("clip-rule=", "clipRule=")
    .replaceAll("color-interpolation-filters=", "colorInterpolationFilters=")
    .replaceAll("fill-rule=", "fillRule=")
    .replaceAll("flood-opacity=", "floodOpacity=")
    .replaceAll("stop-color=", "stopColor=")
    .replaceAll('<TooltipTrigger className="cursor-help">', '<TooltipTrigger aria-label="More information" className="cursor-help">')
    .replace(/(<button\s*\n)(\s*)(className=\{cn\("h-3\.5 w-3\.5)/g, '$1$2aria-label={`Go to slide ${index + 1}`}\n$2$3')
    .replaceAll("categorizedFaqs[0].category", "categorizedFaqs[0]?.category ?? null")
    .replaceAll(/x=\{x \* width \+ 1\}/g, "x={(x ?? 0) * width + 1}")
    .replaceAll(/y=\{y \* height \+ 1\}/g, "y={(y ?? 0) * height + 1}")
    .replaceAll(/https?:\/\/[^"'`\s]+\.(?:avif|gif|jpe?g|png|webp)(?:\?[^"'`\s]*)?/gi, (url) => `${transparentSquare}#${sha256(url).slice(0, 12)}`)
    .replaceAll(/https?:\/\/(?!www\.w3\.org\/2000\/svg)[^"'`\s]+/g, (url) => `about:blank#upstream-${sha256(url).slice(0, 12)}`)
}
