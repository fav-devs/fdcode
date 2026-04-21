import { scopedThreadKey, scopeThreadRef } from "@t3tools/client-runtime";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo } from "react";

import { parseThreadRouteSearch, type ThreadRouteSearch } from "../chatPanelRouteSearch";
import { threadHasStarted } from "../components/ChatView.logic";
import { finalizePromotedDraftThreadByRef, useComposerDraftStore } from "../composerDraftStore";
import { resolveRoutePanelState } from "./-chatThreadRoute.logic";
import { useSingleChatPanelStore } from "../singleChatPanelStore";
import { selectEnvironmentState, selectThreadExistsByRef, useStore } from "../store";
import { createThreadSelectorByRef } from "../storeSelectors";
import { resolveThreadRouteRef } from "../threadRoutes";
import { useWorkspaceStore } from "../workspace/store";

function ChatThreadRouteView() {
  const navigate = useNavigate();
  const openThreadSurface = useWorkspaceStore((state) => state.openThreadSurface);
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

  const currentThreadKey = threadRef
    ? scopedThreadKey(scopeThreadRef(threadRef.environmentId, threadRef.threadId))
    : null;

  useEffect(() => {
    if (!currentThreadKey) return;
    useSingleChatPanelStore
      .getState()
      .setThreadPanelState(currentThreadKey, resolveRoutePanelState(search));
  }, [currentThreadKey, search]);

  useEffect(() => {
    if (!threadRef || !bootstrapComplete) return;
    if (!routeThreadExists && environmentHasAnyThreads) {
      void navigate({ to: "/", replace: true });
    }
  }, [bootstrapComplete, environmentHasAnyThreads, navigate, routeThreadExists, threadRef]);

  useEffect(() => {
    if (!threadRef || !bootstrapComplete || !routeThreadExists) {
      return;
    }

    openThreadSurface(
      {
        scope: "server",
        threadRef,
      },
      "focus-or-replace",
    );
  }, [bootstrapComplete, openThreadSurface, routeThreadExists, threadRef]);

  useEffect(() => {
    if (!threadRef || !serverThreadStarted || !draftThread?.promotedTo) return;
    finalizePromotedDraftThreadByRef(threadRef);
  }, [draftThread?.promotedTo, serverThreadStarted, threadRef]);

  if (!threadRef || !bootstrapComplete || !routeThreadExists) {
    return null;
  }

  return null;
}

export const Route = createFileRoute("/_chat/$environmentId/$threadId")({
  validateSearch: (search): ThreadRouteSearch => parseThreadRouteSearch(search),
  component: ChatThreadRouteView,
});
