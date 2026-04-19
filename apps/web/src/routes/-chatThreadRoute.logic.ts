import type { TurnId } from "@t3tools/contracts";

import type { ChatRightPanel } from "../chatRightPanel";
import type { DiffRouteSearch } from "../diffRouteSearch";
import type { FileRouteSearch } from "../fileRouteSearch";
import type { PortsRouteSearch } from "../portsRouteSearch";

export interface ChatPanelStateSnapshot {
  panel: ChatRightPanel | null;
  diffTurnId: TurnId | null;
  diffFilePath: string | null;
  filesPath: string | null;
  hasOpenedPanel: boolean;
  lastOpenPanel: ChatRightPanel;
}

export interface ChatPanelStatePatch {
  panel?: ChatRightPanel | null;
  diffTurnId?: TurnId | null;
  diffFilePath?: string | null;
  filesPath?: string | null;
  hasOpenedPanel?: boolean;
  lastOpenPanel?: ChatRightPanel;
}

export type ThreadRouteSearch = DiffRouteSearch & FileRouteSearch & PortsRouteSearch;

export function resolveRoutePanelState(search: ThreadRouteSearch): ChatPanelStatePatch {
  const panel: ChatRightPanel | null =
    search.files === "1"
      ? "files"
      : search.diff === "1"
        ? "diff"
        : search.ports === "1"
          ? "ports"
          : null;

  return {
    panel,
    diffTurnId: search.diffTurnId ?? null,
    diffFilePath: search.diffFilePath ?? null,
    filesPath: search.filesPath ?? null,
    ...(panel
      ? {
          hasOpenedPanel: true,
          lastOpenPanel: panel,
        }
      : {}),
  };
}

export function resolvePanelToOpen(previousState: ChatPanelStateSnapshot): ChatRightPanel {
  if (previousState.hasOpenedPanel) {
    return previousState.lastOpenPanel;
  }
  return "diff";
}

export function resolveToggledChatPanelPatch(
  previousState: ChatPanelStateSnapshot,
  panel: ChatRightPanel,
): ChatPanelStatePatch {
  const nextPanel = previousState.panel === panel ? null : panel;
  return {
    panel: nextPanel,
    diffTurnId: previousState.diffTurnId,
    diffFilePath: previousState.diffFilePath,
    filesPath: previousState.filesPath,
    ...(nextPanel
      ? {
          hasOpenedPanel: true,
          lastOpenPanel: nextPanel,
        }
      : {}),
  };
}
