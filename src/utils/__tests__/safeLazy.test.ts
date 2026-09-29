import { describe, expect, it } from "vitest";
import { isChunkLoadError } from "@/utils/safeLazy";

describe("isChunkLoadError", () => {
  it("identifies standard dynamic import failures", () => {
    expect(
      isChunkLoadError(new Error("Failed to fetch dynamically imported module: https://nodes.aii.one/assets/ThemeManage-BXqMeVuN.js")),
    ).toBe(true);

    expect(
      isChunkLoadError(new Error("Failed to load module script")),
    ).toBe(true);

    expect(
      isChunkLoadError(new Error("error loading dynamically imported module")),
    ).toBe(true);

    expect(
      isChunkLoadError("Failed to fetch dynamically imported module"),
    ).toBe(true);
  });

  it("returns false for regular application errors", () => {
    expect(isChunkLoadError(new Error("Network request failed"))).toBe(false);
    expect(isChunkLoadError(new TypeError("Cannot read properties of undefined"))).toBe(false);
    expect(isChunkLoadError(null)).toBe(false);
    expect(isChunkLoadError(undefined)).toBe(false);
  });
});
