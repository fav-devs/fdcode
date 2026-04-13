import { describe, expect, it } from "vitest";
import { DEFAULT_MODEL_BY_PROVIDER, type ModelCapabilities } from "@t3tools/contracts";

import {
  applyClaudePromptEffortPrefix,
  DEFAULT_GEMINI_MODEL_CAPABILITIES,
  geminiCapabilitiesForModel,
  geminiModelOptionsFromEffortValue,
  getDefaultContextWindow,
  getDefaultEffort,
  getGeminiThinkingConfigKind,
  getGeminiThinkingModelAlias,
  GEMINI_2_5_MODEL_CAPABILITIES,
  GEMINI_3_MODEL_CAPABILITIES,
  hasContextWindowOption,
  hasEffortLevel,
  isClaudeUltrathinkPrompt,
  normalizeClaudeModelOptionsWithCapabilities,
  normalizeCodexModelOptionsWithCapabilities,
  normalizeGeminiModelOptionsWithCapabilities,
  normalizeModelSlug,
  resolveApiModelId,
  resolveContextWindow,
  resolveEffort,
  resolveModelSlug,
  resolveModelSlugForProvider,
  resolveSelectableModel,
  trimOrNull,
} from "./model.ts";

const codexCaps: ModelCapabilities = {
  reasoningEffortLevels: [
    { value: "xhigh", label: "Extra High" },
    { value: "high", label: "High", isDefault: true },
  ],
  supportsFastMode: true,
  supportsThinkingToggle: false,
  contextWindowOptions: [],
  promptInjectedEffortLevels: [],
};

const claudeCaps: ModelCapabilities = {
  reasoningEffortLevels: [
    { value: "medium", label: "Medium" },
    { value: "high", label: "High", isDefault: true },
    { value: "ultrathink", label: "Ultrathink" },
  ],
  supportsFastMode: false,
  supportsThinkingToggle: false,
  contextWindowOptions: [
    { value: "200k", label: "200k" },
    { value: "1m", label: "1M", isDefault: true },
  ],
  promptInjectedEffortLevels: ["ultrathink"],
};

const gemini3Caps: ModelCapabilities = {
  reasoningEffortLevels: [
    { value: "HIGH", label: "High", isDefault: true },
    { value: "LOW", label: "Low" },
  ],
  supportsFastMode: false,
  supportsThinkingToggle: false,
  contextWindowOptions: [],
  promptInjectedEffortLevels: [],
};

const gemini25Caps: ModelCapabilities = {
  reasoningEffortLevels: [
    { value: "-1", label: "Dynamic", isDefault: true },
    { value: "512", label: "512 Tokens" },
    { value: "0", label: "Off" },
  ],
  supportsFastMode: false,
  supportsThinkingToggle: false,
  contextWindowOptions: [],
  promptInjectedEffortLevels: [],
};

describe("normalizeModelSlug", () => {
  it("maps known aliases to canonical slugs", () => {
    expect(normalizeModelSlug("gpt-5-codex")).toBe("gpt-5.4");
    expect(normalizeModelSlug("5.3")).toBe("gpt-5.3-codex");
    expect(normalizeModelSlug("sonnet", "claudeAgent")).toBe("claude-sonnet-4-6");
  });

  it("returns null for empty or missing values", () => {
    expect(normalizeModelSlug("")).toBeNull();
    expect(normalizeModelSlug("   ")).toBeNull();
    expect(normalizeModelSlug(null)).toBeNull();
    expect(normalizeModelSlug(undefined)).toBeNull();
  });
});

describe("resolveModelSlug", () => {
  it("returns defaults when the model is missing", () => {
    expect(resolveModelSlug(undefined, "codex")).toBe(DEFAULT_MODEL_BY_PROVIDER.codex);

    expect(resolveModelSlugForProvider("claudeAgent", undefined)).toBe(
      DEFAULT_MODEL_BY_PROVIDER.claudeAgent,
    );
  });

  it("preserves normalized unknown models", () => {
    expect(resolveModelSlug("custom/internal-model", "codex")).toBe("custom/internal-model");
  });
});

describe("resolveSelectableModel", () => {
  it("resolves exact slugs, labels, and aliases", () => {
    const options = [
      { slug: "gpt-5.3-codex", name: "GPT-5.3 Codex" },
      { slug: "claude-sonnet-4-6", name: "Claude Sonnet 4.6" },
    ];
    expect(resolveSelectableModel("codex", "gpt-5.3-codex", options)).toBe("gpt-5.3-codex");
    expect(resolveSelectableModel("codex", "gpt-5.3 codex", options)).toBe("gpt-5.3-codex");
    expect(resolveSelectableModel("claudeAgent", "sonnet", options)).toBe("claude-sonnet-4-6");
  });
});

describe("capability helpers", () => {
  it("reads default efforts", () => {
    expect(getDefaultEffort(codexCaps)).toBe("high");
    expect(getDefaultEffort(claudeCaps)).toBe("high");
  });

  it("checks effort support", () => {
    expect(hasEffortLevel(codexCaps, "xhigh")).toBe(true);
    expect(hasEffortLevel(codexCaps, "max")).toBe(false);
  });
});

describe("resolveEffort", () => {
  it("returns the explicit value when supported and not prompt-injected", () => {
    expect(resolveEffort(codexCaps, "xhigh")).toBe("xhigh");
    expect(resolveEffort(codexCaps, "high")).toBe("high");
    expect(resolveEffort(claudeCaps, "medium")).toBe("medium");
  });

  it("falls back to default when value is unsupported", () => {
    expect(resolveEffort(codexCaps, "bogus")).toBe("high");
    expect(resolveEffort(claudeCaps, "bogus")).toBe("high");
  });

  it("returns the default when no value is provided", () => {
    expect(resolveEffort(codexCaps, undefined)).toBe("high");
    expect(resolveEffort(codexCaps, null)).toBe("high");
    expect(resolveEffort(codexCaps, "")).toBe("high");
    expect(resolveEffort(codexCaps, "  ")).toBe("high");
  });

  it("excludes prompt-injected efforts and falls back to default", () => {
    expect(resolveEffort(claudeCaps, "ultrathink")).toBe("high");
  });

  it("returns undefined for models with no effort levels", () => {
    const noCaps: ModelCapabilities = {
      reasoningEffortLevels: [],
      supportsFastMode: false,
      supportsThinkingToggle: false,
      contextWindowOptions: [],
      promptInjectedEffortLevels: [],
    };
    expect(resolveEffort(noCaps, undefined)).toBeUndefined();
    expect(resolveEffort(noCaps, "high")).toBeUndefined();
  });
});

describe("misc helpers", () => {
  it("detects ultrathink prompts", () => {
    expect(isClaudeUltrathinkPrompt("Ultrathink:\nInvestigate")).toBe(true);
    expect(isClaudeUltrathinkPrompt("Investigate")).toBe(false);
  });

  it("prefixes ultrathink prompts once", () => {
    expect(applyClaudePromptEffortPrefix("Investigate", "ultrathink")).toBe(
      "Ultrathink:\nInvestigate",
    );
    expect(applyClaudePromptEffortPrefix("Ultrathink:\nInvestigate", "ultrathink")).toBe(
      "Ultrathink:\nInvestigate",
    );
  });

  it("trims strings to null", () => {
    expect(trimOrNull("  hi  ")).toBe("hi");
    expect(trimOrNull("   ")).toBeNull();
  });
});

describe("context window helpers", () => {
  it("reads default context window", () => {
    expect(getDefaultContextWindow(claudeCaps)).toBe("1m");
  });

  it("returns null for models without context window options", () => {
    expect(getDefaultContextWindow(codexCaps)).toBeNull();
  });

  it("checks context window support", () => {
    expect(hasContextWindowOption(claudeCaps, "1m")).toBe(true);
    expect(hasContextWindowOption(claudeCaps, "200k")).toBe(true);
    expect(hasContextWindowOption(claudeCaps, "bogus")).toBe(false);
    expect(hasContextWindowOption(codexCaps, "1m")).toBe(false);
  });
});

describe("resolveContextWindow", () => {
  it("returns the explicit value when supported", () => {
    expect(resolveContextWindow(claudeCaps, "200k")).toBe("200k");
    expect(resolveContextWindow(claudeCaps, "1m")).toBe("1m");
  });

  it("falls back to default when value is unsupported", () => {
    expect(resolveContextWindow(claudeCaps, "bogus")).toBe("1m");
  });

  it("returns the default when no value is provided", () => {
    expect(resolveContextWindow(claudeCaps, undefined)).toBe("1m");
    expect(resolveContextWindow(claudeCaps, null)).toBe("1m");
    expect(resolveContextWindow(claudeCaps, "")).toBe("1m");
  });

  it("returns undefined for models with no context window options", () => {
    expect(resolveContextWindow(codexCaps, undefined)).toBeUndefined();
    expect(resolveContextWindow(codexCaps, "1m")).toBeUndefined();
  });
});

describe("resolveApiModelId", () => {
  it("appends [1m] suffix for 1m context window", () => {
    expect(
      resolveApiModelId({
        provider: "claudeAgent",
        model: "claude-opus-4-6",
        options: { contextWindow: "1m" },
      }),
    ).toBe("claude-opus-4-6[1m]");
  });

  it("returns the model as-is for 200k context window", () => {
    expect(
      resolveApiModelId({
        provider: "claudeAgent",
        model: "claude-opus-4-6",
        options: { contextWindow: "200k" },
      }),
    ).toBe("claude-opus-4-6");
  });

  it("returns the model as-is when no context window is set", () => {
    expect(resolveApiModelId({ provider: "claudeAgent", model: "claude-opus-4-6" })).toBe(
      "claude-opus-4-6",
    );
    expect(
      resolveApiModelId({ provider: "claudeAgent", model: "claude-opus-4-6", options: {} }),
    ).toBe("claude-opus-4-6");
  });

  it("returns the model as-is for Codex selections", () => {
    expect(resolveApiModelId({ provider: "codex", model: "gpt-5.4" })).toBe("gpt-5.4");
  });

  it("maps Gemini 3 thinking selections to a generated alias", () => {
    expect(
      resolveApiModelId({
        provider: "gemini",
        model: "auto-gemini-3",
        options: { thinkingLevel: "LOW" },
      }),
    ).toBe("t3code-gemini-auto-gemini-3-thinking-level-low");
  });

  it("maps Gemini 2.5 thinking budgets to a generated alias", () => {
    expect(
      resolveApiModelId({
        provider: "gemini",
        model: "gemini-2.5-flash",
        options: { thinkingBudget: 0 },
      }),
    ).toBe("t3code-gemini-gemini-2-5-flash-thinking-budget-0");
  });
});

describe("normalize*ModelOptionsWithCapabilities", () => {
  it("preserves explicit false codex fast mode", () => {
    expect(
      normalizeCodexModelOptionsWithCapabilities(codexCaps, {
        reasoningEffort: "high",
        fastMode: false,
      }),
    ).toEqual({
      reasoningEffort: "high",
      fastMode: false,
    });
  });

  it("preserves the default Claude context window explicitly", () => {
    expect(
      normalizeClaudeModelOptionsWithCapabilities(
        {
          ...claudeCaps,
          contextWindowOptions: [
            { value: "200k", label: "200k", isDefault: true },
            { value: "1m", label: "1M" },
          ],
        },
        {
          effort: "high",
          contextWindow: "200k",
        },
      ),
    ).toEqual({
      effort: "high",
      contextWindow: "200k",
    });
  });

  it("omits unsupported Claude context window options", () => {
    expect(
      normalizeClaudeModelOptionsWithCapabilities(
        {
          ...claudeCaps,
          reasoningEffortLevels: [],
          supportsThinkingToggle: true,
          contextWindowOptions: [],
        },
        {
          thinking: true,
          contextWindow: "1m",
        },
      ),
    ).toEqual({
      thinking: true,
    });
  });

  it("normalizes Gemini 3 selections to thinkingLevel values", () => {
    expect(
      normalizeGeminiModelOptionsWithCapabilities(gemini3Caps, {
        thinkingBudget: 512,
      }),
    ).toEqual({
      thinkingLevel: "HIGH",
    });

    expect(
      normalizeGeminiModelOptionsWithCapabilities(gemini3Caps, {
        thinkingLevel: "LOW",
      }),
    ).toEqual({
      thinkingLevel: "LOW",
    });
  });

  it("normalizes Gemini 2.5 selections to thinkingBudget values", () => {
    expect(normalizeGeminiModelOptionsWithCapabilities(gemini25Caps, undefined)).toEqual({
      thinkingBudget: -1,
    });

    expect(
      normalizeGeminiModelOptionsWithCapabilities(gemini25Caps, {
        thinkingLevel: "LOW",
        thinkingBudget: 0,
      }),
    ).toEqual({
      thinkingBudget: 0,
    });
  });
});

describe("Gemini helpers", () => {
  it("classifies Gemini model families for thinking config", () => {
    expect(getGeminiThinkingConfigKind("auto-gemini-3")).toBe("level");
    expect(getGeminiThinkingConfigKind("gemini-3.1-pro-preview")).toBe("level");
    expect(getGeminiThinkingConfigKind("auto-gemini-2.5")).toBe("budget");
    expect(getGeminiThinkingConfigKind("gemini-2.5-flash")).toBe("budget");
    expect(getGeminiThinkingConfigKind("custom-model")).toBeNull();
  });

  it("builds Gemini model options from effort values", () => {
    expect(geminiModelOptionsFromEffortValue("HIGH")).toEqual({ thinkingLevel: "HIGH" });
    expect(geminiModelOptionsFromEffortValue("512")).toEqual({ thinkingBudget: 512 });
    expect(geminiModelOptionsFromEffortValue("bogus")).toBeUndefined();
  });

  it("builds Gemini thinking aliases only for matching model families", () => {
    expect(
      getGeminiThinkingModelAlias("auto-gemini-3", {
        thinkingLevel: "HIGH",
      }),
    ).toBe("t3code-gemini-auto-gemini-3-thinking-level-high");
    expect(
      getGeminiThinkingModelAlias("gemini-2.5-pro", {
        thinkingBudget: -1,
      }),
    ).toBe("t3code-gemini-gemini-2-5-pro-thinking-budget-dynamic");
    expect(
      getGeminiThinkingModelAlias("custom-model", {
        thinkingLevel: "HIGH",
      }),
    ).toBeNull();
  });

  it("maps Gemini model families to capability presets", () => {
    expect(geminiCapabilitiesForModel("gemini-3.1-pro-preview")).toEqual(
      GEMINI_3_MODEL_CAPABILITIES,
    );
    expect(geminiCapabilitiesForModel("gemini-2.5-flash")).toEqual(GEMINI_2_5_MODEL_CAPABILITIES);
    expect(geminiCapabilitiesForModel("custom-model")).toEqual(DEFAULT_GEMINI_MODEL_CAPABILITIES);
  });
});
