import { describe, expect, it } from "vitest";

import {
  resolvePanelToOpen,
  resolveRoutePanelState,
  resolveToggledChatPanelPatch,
  type ChatPanelStateSnapshot,
} from "./-chatThreadRoute.logic";

function createPanelStateSnapshot(
  overrides: Partial<ChatPanelStateSnapshot> = {},
): ChatPanelStateSnapshot {
  return {
    panel: null,
    diffTurnId: null,
    diffFilePath: null,
    filesPath: null,
    hasOpenedPanel: false,
    lastOpenPanel: "diff",
    ...overrides,
  };
}

describe("resolveRoutePanelState", () => {
  it("tracks the plan panel as the last-open panel", () => {
    expect(resolveRoutePanelState({ plan: "1" })).toEqual({
      panel: "plan",
      diffTurnId: null,
      diffFilePath: null,
      filesPath: null,
      hasOpenedPanel: true,
      lastOpenPanel: "plan",
    });
  });
});

describe("resolvePanelToOpen", () => {
  it("reopens the last-open plan panel", () => {
    expect(
      resolvePanelToOpen(
        createPanelStateSnapshot({
          hasOpenedPanel: true,
          lastOpenPanel: "plan",
        }),
      ),
    ).toBe("plan");
  });
});

describe("resolveToggledChatPanelPatch", () => {
  it("opens the plan panel and persists it as the last-open panel", () => {
    expect(resolveToggledChatPanelPatch(createPanelStateSnapshot(), "plan")).toEqual({
      panel: "plan",
      diffTurnId: null,
      diffFilePath: null,
      filesPath: null,
      hasOpenedPanel: true,
      lastOpenPanel: "plan",
    });
  });

  it("closes the active plan panel without clearing its reopen target", () => {
    expect(
      resolveToggledChatPanelPatch(
        createPanelStateSnapshot({
          panel: "plan",
          hasOpenedPanel: true,
          lastOpenPanel: "plan",
        }),
        "plan",
      ),
    ).toEqual({
      panel: null,
      diffTurnId: null,
      diffFilePath: null,
      filesPath: null,
    });
  });
});
