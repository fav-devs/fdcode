import { describe, expect, it } from "vitest";

import { formatAppModelOptionName } from "./providerModelNames";

describe("formatAppModelOptionName", () => {
  it("formats Gemini fallback names", () => {
    expect(formatAppModelOptionName("gemini", "gemini-3.1-flash-lite-preview")).toBe(
      "Gemini 3.1 Flash Lite Preview",
    );
  });

  it("leaves other provider slugs unchanged", () => {
    expect(formatAppModelOptionName("codex", "gpt-5.4")).toBe("gpt-5.4");
  });
});
