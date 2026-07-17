import { readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const check = process.argv.includes("--check");
const canonicalPath = resolve(root, ".mcp.json");
const canonical = JSON.parse(await readFile(canonicalPath, "utf8"));

if (!canonical.mcpServers || typeof canonical.mcpServers !== "object") {
  throw new Error(".mcp.json must contain an mcpServers object");
}

const quote = (value) => JSON.stringify(value);
const toml = Object.entries(canonical.mcpServers)
  .flatMap(([name, server]) => {
    const lines = [`[mcp_servers.${name}]`];
    if (server.command) lines.push(`command = ${quote(server.command)}`);
    if (server.args) lines.push(`args = [${server.args.map(quote).join(", ")}]`);
    if (server.url) lines.push(`url = ${quote(server.url)}`);
    return [...lines, ""];
  })
  .join("\n");

const json = `${JSON.stringify(canonical, null, 2)}\n`;
const projections = new Map([
  [resolve(root, ".mcp.toml"), toml],
  [resolve(root, ".codex/config.toml"), toml],
  [resolve(root, ".codex/mcp.toml"), toml],
  [resolve(root, ".cursor/mcp.json"), json],
]);

const stale = [];
for (const [path, expected] of projections) {
  let actual;
  try {
    actual = await readFile(path, "utf8");
  } catch {
    actual = undefined;
  }

  if (actual === expected) continue;
  if (check) {
    stale.push(path.slice(root.length + 1));
  } else {
    await writeFile(path, expected, "utf8");
  }
}

if (stale.length > 0) {
  throw new Error(`MCP projections are stale: ${stale.join(", ")}. Run pnpm mcp:sync.`);
}

console.log(check ? "MCP projections are current." : "MCP projections updated.");
