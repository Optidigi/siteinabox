import { readFileSync } from "node:fs"

// Public release/manifest facts. Compose and Dockerfiles retain literal pins;
// the contract test checks that their copies match this reviewed inventory.
export const infrastructure = JSON.parse(readFileSync(new URL("../docs/infrastructure-images.json", import.meta.url), "utf8"))
