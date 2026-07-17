import { access, readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const files = execFileSync(
  "git",
  ["ls-files", "--cached", "--others", "--exclude-standard", "*.md"],
  {
  cwd: root,
  encoding: "utf8",
  },
)
  .trim()
  .split("\n")
  .filter(Boolean);

const failures = [];
const linkPattern = /\[[^\]]*\]\(([^)]+)\)/g;

for (const file of files) {
  let source;
  try {
    source = await readFile(resolve(root, file), "utf8");
  } catch (error) {
    if (error.code === "ENOENT") continue;
    throw error;
  }
  for (const match of source.matchAll(linkPattern)) {
    const target = match[1].trim().replace(/^<|>$/g, "").split("#", 1)[0];
    if (!target || /^(?:https?:|mailto:)/.test(target)) continue;
    const path = resolve(root, dirname(file), decodeURIComponent(target));
    try {
      await access(path);
    } catch {
      failures.push(`${file}: ${match[1]}`);
    }
  }
}

if (failures.length > 0) {
  throw new Error(`Broken local Markdown links:\n${failures.join("\n")}`);
}

console.log(`Checked local links in ${files.length} Markdown files.`);
