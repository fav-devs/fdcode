import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import type { TurnId } from "@t3tools/contracts";
import type { ChatRightPanel } from "./chatRightPanel";

export interface SingleChatPanelState {
  panel: ChatRightPanel | null;
  diffTurnId: TurnId | null;
  diffFilePath: string | null;
  filesPath: string | null;
  hasOpenedPanel: boolean;
  lastOpenPanel: ChatRightPanel;
}

interface SingleChatPanelStore {
  panelStateByThreadKey: Record<string, SingleChatPanelState | undefined>;
  setThreadPanelState: (threadKey: string, patch: Partial<SingleChatPanelState>) => void;
  clearThreadPanelState: (threadKey: string) => void;
}

const SINGLE_CHAT_PANEL_STORAGE_KEY = "t3code:single-chat-panel-state:v2";

export function createDefaultSingleChatPanelState(): SingleChatPanelState {
  return {
    panel: null,
    diffTurnId: null,
    diffFilePath: null,
    filesPath: null,
    hasOpenedPanel: false,
    lastOpenPanel: "diff",
  };
}

const DEFAULT_SINGLE_CHAT_PANEL_STATE = createDefaultSingleChatPanelState();

function getDefaultSingleChatPanelState(): SingleChatPanelState {
  return DEFAULT_SINGLE_CHAT_PANEL_STATE;
}

export const useSingleChatPanelStore = create<SingleChatPanelStore>()(
  persist(
    (set) => ({
      panelStateByThreadKey: {},
      setThreadPanelState: (threadKey, patch) =>
        set((state) => {
          const previous =
            state.panelStateByThreadKey[threadKey] ?? getDefaultSingleChatPanelState();
          const next = {
            ...previous,
            ...patch,
          };

          if (
            previous.panel === next.panel &&
            previous.diffTurnId === next.diffTurnId &&
            previous.diffFilePath === next.diffFilePath &&
            previous.filesPath === next.filesPath &&
            previous.hasOpenedPanel === next.hasOpenedPanel &&
            previous.lastOpenPanel === next.lastOpenPanel
          ) {
            return state;
          }

          return {
            panelStateByThreadKey: {
              ...state.panelStateByThreadKey,
              [threadKey]: next,
            },
          };
        }),
      clearThreadPanelState: (threadKey) =>
        set((state) => {
          if (!Object.hasOwn(state.panelStateByThreadKey, threadKey)) {
            return state;
          }
          const nextPanelStateByThreadKey = { ...state.panelStateByThreadKey };
          delete nextPanelStateByThreadKey[threadKey];
          return {
            panelStateByThreadKey: nextPanelStateByThreadKey,
          };
        }),
    }),
    {
      name: SINGLE_CHAT_PANEL_STORAGE_KEY,
      storage: createJSONStorage(() => localStorage),
    },
  ),
);

export function selectSingleChatPanelState(threadKey: string) {
  return (store: SingleChatPanelStore) =>
    store.panelStateByThreadKey[threadKey] ?? getDefaultSingleChatPanelState();
}
