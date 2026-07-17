import { writeFile } from "node:fs/promises"
import { fileURLToPath } from "node:url"
import { generateStaticThemeCss } from "../src/theme/static-css.ts"

await writeFile(fileURLToPath(new URL("../src/theme-presets.generated.css", import.meta.url)), generateStaticThemeCss())
