import { describe, expect, it } from "vitest";

import { formatGeminiModelDisplayName } from "./gemini.ts";

describe("formatGeminiModelDisplayName", () => {
  it("formats raw Gemini model slugs for display", () => {
    expect(formatGeminiModelDisplayName("gemini-3.1-flash-lite-preview")).toBe(
      "Gemini 3.1 Flash Lite Preview",
    );
    expect(formatGeminiModelDisplayName("gemini-2.5-pro")).toBe("Gemini 2.5 Pro");
    expect(formatGeminiModelDisplayName("auto-gemini-next")).toBe("Auto (Gemini Next)");
  });

  it("returns an empty string for missing values", () => {
    expect(formatGeminiModelDisplayName("")).toBe("");
    expect(formatGeminiModelDisplayName(null)).toBe("");
  });
});
