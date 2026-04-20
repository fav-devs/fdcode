import { create } from "zustand";

interface CommandPaletteOpenIntent {
  kind: "add-project";
  requestId: number;
}

export interface CommandPaletteWorkspaceTarget {
  disposition: "split-right" | "split-down";
}

interface CommandPaletteStore {
  open: boolean;
  openIntent: CommandPaletteOpenIntent | null;
  workspaceTarget: CommandPaletteWorkspaceTarget | null;
  setOpen: (open: boolean) => void;
  toggleOpen: () => void;
  openAddProject: () => void;
  clearOpenIntent: () => void;
  openWorkspaceTarget: (target: CommandPaletteWorkspaceTarget) => void;
  clearWorkspaceTarget: () => void;
}

export const useCommandPaletteStore = create<CommandPaletteStore>((set) => ({
  open: false,
  openIntent: null,
  workspaceTarget: null,
  setOpen: (open) => set({ open, ...(open ? {} : { openIntent: null, workspaceTarget: null }) }),
  toggleOpen: () =>
    set((state) => ({
      open: !state.open,
      ...(state.open ? { openIntent: null, workspaceTarget: null } : {}),
    })),
  openAddProject: () =>
    set((state) => ({
      open: true,
      openIntent: {
        kind: "add-project",
        requestId: (state.openIntent?.requestId ?? 0) + 1,
      },
    })),
  clearOpenIntent: () => set({ openIntent: null }),
  openWorkspaceTarget: (target) => set({ open: true, workspaceTarget: target }),
  clearWorkspaceTarget: () => set({ workspaceTarget: null }),
}));
