import { describe, expect, it } from "vitest";

import {
  buildGeminiThinkingModelConfigAliases,
  geminiRequestTimeoutMs,
  resolveStartedGeminiSessionId,
} from "./GeminiAdapter.ts";

describe("resolveStartedGeminiSessionId", () => {
  it("prefers the actual session id returned by Gemini over the requested resume id", () => {
    expect(
      resolveStartedGeminiSessionId("stale-session-id", {
        sessionId: "fresh-session-id",
      }),
    ).toBe("fresh-session-id");
  });

  it("falls back to the requested resume id when the load response omits sessionId", () => {
    expect(resolveStartedGeminiSessionId("resume-session-id", {})).toBe("resume-session-id");
  });

  it("returns the started session id for fresh sessions", () => {
    expect(resolveStartedGeminiSessionId(undefined, { sessionId: "new-session-id" })).toBe(
      "new-session-id",
    );
  });

  it("returns undefined when neither a requested nor started session id is available", () => {
    expect(resolveStartedGeminiSessionId(undefined, {})).toBeUndefined();
  });
});

describe("geminiRequestTimeoutMs", () => {
  it("uses the short ACP timeout for control-plane requests", () => {
    expect(geminiRequestTimeoutMs("session/new")).toBe(60_000);
    expect(geminiRequestTimeoutMs("session/set_model")).toBe(60_000);
  });

  it("uses a long timeout for session/prompt turns", () => {
    expect(geminiRequestTimeoutMs("session/prompt")).toBe(30 * 60_000);
  });
});

describe("buildGeminiThinkingModelConfigAliases", () => {
  it("builds Gemini 3 and Gemini 2.5 aliases from model families", () => {
    expect(
      buildGeminiThinkingModelConfigAliases(["auto-gemini-3", "gemini-2.5-flash", "custom-model"]),
    ).toMatchObject({
      "t3code-gemini-auto-gemini-3-thinking-level-high": {
        extends: "chat-base-3",
        modelConfig: {
          model: "auto-gemini-3",
          generateContentConfig: {
            thinkingConfig: {
              thinkingLevel: "HIGH",
            },
          },
        },
      },
      "t3code-gemini-auto-gemini-3-thinking-level-low": {
        extends: "chat-base-3",
        modelConfig: {
          model: "auto-gemini-3",
          generateContentConfig: {
            thinkingConfig: {
              thinkingLevel: "LOW",
            },
          },
        },
      },
      "t3code-gemini-gemini-2-5-flash-thinking-budget-dynamic": {
        extends: "chat-base-2.5",
        modelConfig: {
          model: "gemini-2.5-flash",
          generateContentConfig: {
            thinkingConfig: {
              thinkingBudget: -1,
            },
          },
        },
      },
      "t3code-gemini-gemini-2-5-flash-thinking-budget-512": {
        extends: "chat-base-2.5",
        modelConfig: {
          model: "gemini-2.5-flash",
          generateContentConfig: {
            thinkingConfig: {
              thinkingBudget: 512,
            },
          },
        },
      },
      "t3code-gemini-gemini-2-5-flash-thinking-budget-0": {
        extends: "chat-base-2.5",
        modelConfig: {
          model: "gemini-2.5-flash",
          generateContentConfig: {
            thinkingConfig: {
              thinkingBudget: 0,
            },
          },
        },
      },
    });
  });
});
