import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

interface PinnedThreadsStoreState {
  pinnedThreadKeys: string[];
  pinThread: (threadKey: string) => void;
  unpinThread: (threadKey: string) => void;
  togglePinnedThread: (threadKey: string) => void;
  prunePinnedThreads: (threadKeys: readonly string[]) => void;
}

const PINNED_THREADS_STORAGE_KEY = "t3code:pinned-threads:v1";

function normalizePinnedThreadKeys(threadKeys: readonly string[]): string[] {
  const seen = new Set<string>();
  const normalized: string[] = [];

  for (const threadKey of threadKeys) {
    if (threadKey.length === 0 || seen.has(threadKey)) {
      continue;
    }
    seen.add(threadKey);
    normalized.push(threadKey);
  }

  return normalized;
}

export const usePinnedThreadsStore = create<PinnedThreadsStoreState>()(
  persist(
    (set) => ({
      pinnedThreadKeys: [],
      pinThread: (threadKey) => {
        if (threadKey.length === 0) return;
        set((state) => {
          if (state.pinnedThreadKeys.includes(threadKey)) {
            return state;
          }
          return {
            pinnedThreadKeys: [threadKey, ...state.pinnedThreadKeys],
          };
        });
      },
      unpinThread: (threadKey) => {
        if (threadKey.length === 0) return;
        set((state) => {
          if (!state.pinnedThreadKeys.includes(threadKey)) {
            return state;
          }
          return {
            pinnedThreadKeys: state.pinnedThreadKeys.filter((candidate) => candidate !== threadKey),
          };
        });
      },
      togglePinnedThread: (threadKey) => {
        if (threadKey.length === 0) return;
        set((state) => {
          if (state.pinnedThreadKeys.includes(threadKey)) {
            return {
              pinnedThreadKeys: state.pinnedThreadKeys.filter(
                (candidate) => candidate !== threadKey,
              ),
            };
          }
          return {
            pinnedThreadKeys: [threadKey, ...state.pinnedThreadKeys],
          };
        });
      },
      prunePinnedThreads: (threadKeys) => {
        const allowedThreadKeys = new Set(threadKeys);
        set((state) => {
          const nextPinnedThreadKeys = state.pinnedThreadKeys.filter((threadKey) =>
            allowedThreadKeys.has(threadKey),
          );
          return nextPinnedThreadKeys.length === state.pinnedThreadKeys.length
            ? state
            : { pinnedThreadKeys: nextPinnedThreadKeys };
        });
      },
    }),
    {
      name: PINNED_THREADS_STORAGE_KEY,
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        pinnedThreadKeys: normalizePinnedThreadKeys(state.pinnedThreadKeys),
      }),
      merge: (persistedState, currentState) => {
        const candidate =
          (persistedState as Partial<Pick<PinnedThreadsStoreState, "pinnedThreadKeys">> | undefined)
            ?.pinnedThreadKeys ?? [];
        return {
          ...currentState,
          pinnedThreadKeys: normalizePinnedThreadKeys(candidate),
        };
      },
    },
  ),
);
