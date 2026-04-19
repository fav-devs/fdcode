import { createFileRoute, retainSearchParams, useNavigate } from "@tanstack/react-router";
import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from "react";
import FilePanel from "../components/FilePanel";
import { cn } from "../lib/utils";

import { AppStatusBar } from "../components/AppStatusBar";
import ChatView from "../components/ChatView";
import { threadHasStarted } from "../components/ChatView.logic";
import { DiffWorkerPoolProvider } from "../components/DiffWorkerPoolProvider";
import {
  DiffPanelHeaderSkeleton,
  DiffPanelLoadingState,
  DiffPanelShell,
  type DiffPanelMode,
} from "../components/DiffPanelShell";
import { finalizePromotedDraftThreadByRef, useComposerDraftStore } from "../composerDraftStore";
import {
  type DiffRouteSearch,
  parseDiffRouteSearch,
  stripDiffSearchParams,
} from "../diffRouteSearch";
import {
  type FileRouteSearch,
  parseFileRouteSearch,
  stripFileSearchParams,
} from "../fileRouteSearch";
import { useMediaQuery } from "../hooks/useMediaQuery";
import { RIGHT_PANEL_INLINE_LAYOUT_MEDIA_QUERY } from "../rightPanelLayout";
import { selectEnvironmentState, selectThreadExistsByRef, useStore } from "../store";
import { createThreadSelectorByRef } from "../storeSelectors";
import { resolveThreadRouteRef, buildThreadRouteParams } from "../threadRoutes";
import { RightPanelSheet } from "../components/RightPanelSheet";
import { Sidebar, SidebarInset, SidebarProvider, SidebarRail } from "~/components/ui/sidebar";
import { isElectron } from "~/env";
import { XIcon } from "lucide-react";

const DiffPanel = lazy(() => import("../components/DiffPanel"));
const RIGHT_PANEL_SIDEBAR_WIDTH_STORAGE_KEY = "chat_right_panel_sidebar_width";
const RIGHT_PANEL_DEFAULT_WIDTH = "clamp(30rem,50vw,56rem)";
const RIGHT_PANEL_SIDEBAR_MIN_WIDTH = 26 * 16;
const COMPOSER_COMPACT_MIN_LEFT_CONTROLS_WIDTH_PX = 208;

type RightPanelView = "diff" | "files";

const DiffLoadingFallback = (props: { mode: DiffPanelMode }) => {
  return (
    <DiffPanelShell mode={props.mode} header={<DiffPanelHeaderSkeleton />}>
      <DiffPanelLoadingState label="Loading diff viewer..." />
    </DiffPanelShell>
  );
};

const LazyDiffPanel = (props: { mode: DiffPanelMode }) => {
  return (
    <DiffWorkerPoolProvider>
      <Suspense fallback={<DiffLoadingFallback mode={props.mode} />}>
        <DiffPanel mode={props.mode} />
      </Suspense>
    </DiffWorkerPoolProvider>
  );
};

// ─── Unified right panel content with tab nav ────────────────────────────

function RightPanelContent({
  activeView,
  onSwitchToDiff,
  onSwitchToFiles,
  onClose,
  mountedViews,
  mode,
}: {
  activeView: RightPanelView;
  onSwitchToDiff: () => void;
  onSwitchToFiles: () => void;
  onClose: () => void;
  mountedViews: ReadonlySet<RightPanelView>;
  mode: DiffPanelMode;
}) {
  const shouldUseDragRegion = isElectron && mode !== "sheet";

  return (
    <div className="flex h-full min-w-0 flex-col bg-background">
      {/* Tab nav row */}
      <div
        className={cn(
          "flex shrink-0 items-center gap-1 border-b border-border px-3",
          shouldUseDragRegion
            ? "drag-region h-[52px] wco:h-[env(titlebar-area-height)]"
            : "h-11",
        )}
      >
        <div className="flex items-center gap-0.5 [-webkit-app-region:no-drag]">
          <button
            type="button"
            onClick={onSwitchToDiff}
            className={cn(
              "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
              activeView === "diff"
                ? "bg-accent text-accent-foreground"
                : "text-muted-foreground hover:bg-accent/50 hover:text-foreground",
            )}
          >
            Diff
          </button>
          <button
            type="button"
            onClick={onSwitchToFiles}
            className={cn(
              "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
              activeView === "files"
                ? "bg-accent text-accent-foreground"
                : "text-muted-foreground hover:bg-accent/50 hover:text-foreground",
            )}
          >
            Files
          </button>
        </div>
        <div className="flex-1 [-webkit-app-region:drag]" />
        <button
          type="button"
          className="shrink-0 rounded p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground [-webkit-app-region:no-drag]"
          onClick={onClose}
          aria-label="Close panel"
        >
          <XIcon className="size-4" />
        </button>
      </div>

      {/* Panel views — kept mounted once visited for perf */}
      <div className="relative min-h-0 flex-1 overflow-hidden">
        {mountedViews.has("diff") && (
          <div className={cn("absolute inset-0", activeView !== "diff" && "hidden")}>
            <LazyDiffPanel mode={mode} />
          </div>
        )}
        {mountedViews.has("files") && (
          <div className={cn("absolute inset-0", activeView !== "files" && "hidden")}>
            <FilePanel />
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Inline sidebar wrapper ───────────────────────────────────────────────

const RightPanelInlineSidebar = (props: {
  panelOpen: boolean;
  activeView: RightPanelView;
  mountedViews: ReadonlySet<RightPanelView>;
  onClose: () => void;
  onOpenChange: (open: boolean) => void;
  onSwitchToDiff: () => void;
  onSwitchToFiles: () => void;
}) => {
  const { panelOpen, activeView, mountedViews, onClose, onOpenChange, onSwitchToDiff, onSwitchToFiles } = props;

  const shouldAcceptInlineSidebarWidth = useCallback(
    ({ nextWidth, wrapper }: { nextWidth: number; wrapper: HTMLElement }) => {
      const composerForm = document.querySelector<HTMLElement>("[data-chat-composer-form='true']");
      if (!composerForm) return true;
      const composerViewport = composerForm.parentElement;
      if (!composerViewport) return true;
      const previousSidebarWidth = wrapper.style.getPropertyValue("--sidebar-width");
      wrapper.style.setProperty("--sidebar-width", `${nextWidth}px`);

      const viewportStyle = window.getComputedStyle(composerViewport);
      const viewportPaddingLeft = Number.parseFloat(viewportStyle.paddingLeft) || 0;
      const viewportPaddingRight = Number.parseFloat(viewportStyle.paddingRight) || 0;
      const viewportContentWidth = Math.max(
        0,
        composerViewport.clientWidth - viewportPaddingLeft - viewportPaddingRight,
      );
      const formRect = composerForm.getBoundingClientRect();
      const composerFooter = composerForm.querySelector<HTMLElement>(
        "[data-chat-composer-footer='true']",
      );
      const composerRightActions = composerForm.querySelector<HTMLElement>(
        "[data-chat-composer-actions='right']",
      );
      const composerRightActionsWidth = composerRightActions?.getBoundingClientRect().width ?? 0;
      const composerFooterGap = composerFooter
        ? Number.parseFloat(window.getComputedStyle(composerFooter).columnGap) ||
          Number.parseFloat(window.getComputedStyle(composerFooter).gap) ||
          0
        : 0;
      const minimumComposerWidth =
        COMPOSER_COMPACT_MIN_LEFT_CONTROLS_WIDTH_PX + composerRightActionsWidth + composerFooterGap;
      const hasComposerOverflow = composerForm.scrollWidth > composerForm.clientWidth + 0.5;
      const overflowsViewport = formRect.width > viewportContentWidth + 0.5;
      const violatesMinimumComposerWidth = composerForm.clientWidth + 0.5 < minimumComposerWidth;

      if (previousSidebarWidth.length > 0) {
        wrapper.style.setProperty("--sidebar-width", previousSidebarWidth);
      } else {
        wrapper.style.removeProperty("--sidebar-width");
      }

      return !hasComposerOverflow && !overflowsViewport && !violatesMinimumComposerWidth;
    },
    [],
  );

  return (
    <SidebarProvider
      defaultOpen={false}
      open={panelOpen}
      onOpenChange={onOpenChange}
      className="w-auto min-h-0 flex-none bg-transparent"
      style={{ "--sidebar-width": RIGHT_PANEL_DEFAULT_WIDTH } as React.CSSProperties}
    >
      <Sidebar
        side="right"
        variant="inset"
        collapsible="offcanvas"
        className="md:p-3"
        innerClassName="overflow-hidden rounded-[28px] border border-border/70 bg-[linear-gradient(180deg,color-mix(in_srgb,var(--card)_96%,black_4%),color-mix(in_srgb,var(--card)_90%,black_10%))] shadow-[0_28px_80px_-36px_rgba(0,0,0,0.75)] backdrop-blur-xl text-foreground"
        resizable={{
          minWidth: RIGHT_PANEL_SIDEBAR_MIN_WIDTH,
          shouldAcceptWidth: shouldAcceptInlineSidebarWidth,
          storageKey: RIGHT_PANEL_SIDEBAR_WIDTH_STORAGE_KEY,
        }}
      >
        {panelOpen || mountedViews.size > 0 ? (
          <RightPanelContent
            activeView={activeView}
            onSwitchToDiff={onSwitchToDiff}
            onSwitchToFiles={onSwitchToFiles}
            onClose={onClose}
            mountedViews={mountedViews}
            mode="sidebar"
          />
        ) : null}
        <SidebarRail />
      </Sidebar>
    </SidebarProvider>
  );
};

// ─── Main route view ──────────────────────────────────────────────────────

function ChatThreadRouteView() {
  const navigate = useNavigate();
  const threadRef = Route.useParams({
    select: (params) => resolveThreadRouteRef(params),
  });
  const search = Route.useSearch();
  const bootstrapComplete = useStore(
    (store) => selectEnvironmentState(store, threadRef?.environmentId ?? null).bootstrapComplete,
  );
  const serverThread = useStore(useMemo(() => createThreadSelectorByRef(threadRef), [threadRef]));
  const threadExists = useStore((store) => selectThreadExistsByRef(store, threadRef));
  const environmentHasServerThreads = useStore(
    (store) => selectEnvironmentState(store, threadRef?.environmentId ?? null).threadIds.length > 0,
  );
  const draftThreadExists = useComposerDraftStore((store) =>
    threadRef ? store.getDraftThreadByRef(threadRef) !== null : false,
  );
  const draftThread = useComposerDraftStore((store) =>
    threadRef ? store.getDraftThreadByRef(threadRef) : null,
  );
  const environmentHasDraftThreads = useComposerDraftStore((store) => {
    if (!threadRef) return false;
    return store.hasDraftThreadsInEnvironment(threadRef.environmentId);
  });

  const routeThreadExists = threadExists || draftThreadExists;
  const serverThreadStarted = threadHasStarted(serverThread);
  const environmentHasAnyThreads = environmentHasServerThreads || environmentHasDraftThreads;

  const diffOpen = search.diff === "1";
  const filesOpen = search.files === "1";
  const panelOpen = diffOpen || filesOpen;
  const activeView: RightPanelView = filesOpen ? "files" : "diff";

  const shouldUseDiffSheet = useMediaQuery(RIGHT_PANEL_INLINE_LAYOUT_MEDIA_QUERY);
  const currentThreadKey = threadRef ? `${threadRef.environmentId}:${threadRef.threadId}` : null;

  // Track which panel views have ever been mounted (for lazy keep-alive)
  const [mountedViews, setMountedViews] = useState<ReadonlySet<RightPanelView>>(() => {
    const views = new Set<RightPanelView>();
    if (diffOpen) views.add("diff");
    if (filesOpen) views.add("files");
    return views;
  });

  useEffect(() => {
    if (!panelOpen) return;
    setMountedViews((prev) => {
      if (prev.has(activeView)) return prev;
      const next = new Set(prev);
      next.add(activeView);
      return next;
    });
  }, [activeView, panelOpen]);

  // Reset mounted views when switching threads
  const lastThreadKeyRef = useRef(currentThreadKey);
  useEffect(() => {
    if (lastThreadKeyRef.current !== currentThreadKey) {
      lastThreadKeyRef.current = currentThreadKey;
      const views = new Set<RightPanelView>();
      if (diffOpen) views.add("diff");
      if (filesOpen) views.add("files");
      setMountedViews(views);
    }
  });

  const closePanel = useCallback(() => {
    if (!threadRef) return;
    void navigate({
      to: "/$environmentId/$threadId",
      params: buildThreadRouteParams(threadRef),
      search: (previous) => {
        const { diff: _diff, ...rest } = stripFileSearchParams(previous);
        return rest;
      },
    });
  }, [navigate, threadRef]);

  const openDiff = useCallback(() => {
    if (!threadRef) return;
    void navigate({
      to: "/$environmentId/$threadId",
      params: buildThreadRouteParams(threadRef),
      search: (previous) => {
        const rest = stripFileSearchParams(stripDiffSearchParams(previous));
        return { ...rest, diff: "1" };
      },
    });
  }, [navigate, threadRef]);

  const openFiles = useCallback(() => {
    if (!threadRef) return;
    void navigate({
      to: "/$environmentId/$threadId",
      params: buildThreadRouteParams(threadRef),
      search: (previous) => {
        const rest = stripFileSearchParams(stripDiffSearchParams(previous));
        return { ...rest, files: "1" };
      },
    });
  }, [navigate, threadRef]);

  const switchToDiff = useCallback(() => {
    if (!threadRef) return;
    void navigate({
      to: "/$environmentId/$threadId",
      params: buildThreadRouteParams(threadRef),
      search: (previous) => {
        const rest = stripFileSearchParams(previous);
        return { ...rest, diff: "1" };
      },
    });
  }, [navigate, threadRef]);

  const switchToFiles = useCallback(() => {
    if (!threadRef) return;
    void navigate({
      to: "/$environmentId/$threadId",
      params: buildThreadRouteParams(threadRef),
      search: (previous) => {
        const { diff: _diff, ...rest } = stripDiffSearchParams(previous);
        return { ...rest, files: "1" };
      },
    });
  }, [navigate, threadRef]);

  const handlePanelOpenChange = useCallback(
    (open: boolean) => {
      if (open) openDiff();
      else closePanel();
    },
    [openDiff, closePanel],
  );

  useEffect(() => {
    if (!threadRef || !bootstrapComplete) return;
    if (!routeThreadExists && environmentHasAnyThreads) {
      void navigate({ to: "/", replace: true });
    }
  }, [bootstrapComplete, environmentHasAnyThreads, navigate, routeThreadExists, threadRef]);

  useEffect(() => {
    if (!threadRef || !serverThreadStarted || !draftThread?.promotedTo) return;
    finalizePromotedDraftThreadByRef(threadRef);
  }, [draftThread?.promotedTo, serverThreadStarted, threadRef]);

  if (!threadRef || !bootstrapComplete || !routeThreadExists) {
    return null;
  }

  if (!shouldUseDiffSheet) {
    return (
      <>
        <SidebarInset className="h-[calc(100dvh-1rem)] md:h-[calc(100dvh-1.5rem)] min-h-0 overflow-hidden overscroll-y-none bg-transparent text-foreground">
          <ChatView
            environmentId={threadRef.environmentId}
            threadId={threadRef.threadId}
            onDiffPanelOpen={openDiff}
            reserveTitleBarControlInset={!panelOpen}
            routeKind="server"
          />
          <AppStatusBar />
        </SidebarInset>
        <RightPanelInlineSidebar
          panelOpen={panelOpen}
          activeView={activeView}
          mountedViews={mountedViews}
          onClose={closePanel}
          onOpenChange={handlePanelOpenChange}
          onSwitchToDiff={switchToDiff}
          onSwitchToFiles={switchToFiles}
        />
      </>
    );
  }

  return (
    <>
      <SidebarInset className="h-[calc(100dvh-1rem)] md:h-[calc(100dvh-1.5rem)] min-h-0 overflow-hidden overscroll-y-none bg-transparent text-foreground">
        <ChatView
          environmentId={threadRef.environmentId}
          threadId={threadRef.threadId}
          onDiffPanelOpen={openDiff}
          routeKind="server"
        />
        <AppStatusBar />
      </SidebarInset>
      <RightPanelSheet open={panelOpen} onClose={closePanel}>
        <RightPanelContent
          activeView={activeView}
          onSwitchToDiff={switchToDiff}
          onSwitchToFiles={switchToFiles}
          onClose={closePanel}
          mountedViews={mountedViews}
          mode="sheet"
        />
      </RightPanelSheet>
    </>
  );
}

type ThreadRouteSearch = DiffRouteSearch & FileRouteSearch;

export const Route = createFileRoute("/_chat/$environmentId/$threadId")({
  validateSearch: (search): ThreadRouteSearch => ({
    ...parseDiffRouteSearch(search),
    ...parseFileRouteSearch(search),
  }),
  search: {
    middlewares: [retainSearchParams<ThreadRouteSearch>(["diff", "files"])],
  },
  component: ChatThreadRouteView,
});
