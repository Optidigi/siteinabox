import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";

import { TLD_CAPABILITY_CATALOG } from "./tld-capabilities";

const canonicalize = (value: unknown): unknown => {
  if (Array.isArray(value)) {
    return value.map(canonicalize);
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
        .map(([key, item]) => [key, canonicalize(item)]),
    );
  }

  return value;
};

describe("TLD capability catalog stability", () => {
  it("keeps the reviewed catalog snapshot stable", () => {
    const serialized = JSON.stringify(canonicalize(TLD_CAPABILITY_CATALOG));
    const digest = createHash("sha256").update(serialized).digest("hex");

    expect(digest).toBe(
      "b65551549649440352bdf16e8cece7641777b8a86bfb9df7a3e5ffce5a99b8a0",
    );
  });
});
