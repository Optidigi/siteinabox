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

const fingerprint = (value: string): string => {
  let hash = 0xcbf29ce484222325n;

  for (let index = 0; index < value.length; index += 1) {
    hash ^= BigInt(value.charCodeAt(index));
    hash = BigInt.asUintN(64, hash * 0x100000001b3n);
  }

  return hash.toString(16).padStart(16, "0");
};

describe("TLD capability catalog stability", () => {
  it("keeps the reviewed catalog snapshot stable", () => {
    const serialized = JSON.stringify(canonicalize(TLD_CAPABILITY_CATALOG));

    expect(fingerprint(serialized)).toBe("3e32f2cda91c8263");
  });
});
