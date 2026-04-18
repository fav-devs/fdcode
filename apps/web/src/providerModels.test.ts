import { describe, expect, it } from "vitest";
import type { ModelCapabilities } from "@t3tools/contracts";

import { getProviderModelCapabilities } from "./providerModels";

const EMPTY_CAPABILITIES: ModelCapabilities = {
  reasoningEffortLevels: [],
  supportsFastMode: false,
  supportsThinkingToggle: false,
  contextWindowOptions: [],
  promptInjectedEffortLevels: [],
};

describe("getProviderModelCapabilities", () => {
  it("infers Gemini 3 thinking controls when the provider snapshot lacks capabilities", () => {
    expect(
      getProviderModelCapabilities(
        [
          {
            slug: "gemini-3.1-pro-preview",
            name: "Gemini 3.1 Pro Preview",
            isCustom: false,
            capabilities: EMPTY_CAPABILITIES,
          },
        ],
        "gemini-3.1-pro-preview",
        "gemini",
      ),
    ).toEqual({
      reasoningEffortLevels: [
        { value: "HIGH", label: "High", isDefault: true },
        { value: "LOW", label: "Low" },
      ],
      supportsFastMode: false,
      supportsThinkingToggle: false,
      contextWindowOptions: [],
      promptInjectedEffortLevels: [],
    });
  });

  it("falls back to family inference for known Gemini models even when discovery is missing", () => {
    expect(getProviderModelCapabilities([], "gemini-2.5-flash", "gemini")).toEqual({
      reasoningEffortLevels: [
        { value: "-1", label: "Dynamic", isDefault: true },
        { value: "512", label: "512 Tokens" },
      ],
      supportsFastMode: false,
      supportsThinkingToggle: false,
      contextWindowOptions: [],
      promptInjectedEffortLevels: [],
    });
  });

  it("keeps empty capabilities for unknown custom Gemini models", () => {
    expect(getProviderModelCapabilities([], "custom-gemini-model", "gemini")).toEqual(
      EMPTY_CAPABILITIES,
    );
  });
});
