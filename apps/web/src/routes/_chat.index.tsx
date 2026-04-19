import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef } from "react";
import { scopeProjectRef } from "@t3tools/client-runtime";
import { NoActiveThreadState } from "../components/NoActiveThreadState";
import { usePrimaryEnvironmentId } from "../environments/primary";
import { useNewThreadHandler } from "../hooks/useHandleNewThread";
import { useServerWelcome } from "../rpc/serverState";
import { selectEnvironmentState, useStore } from "../store";

function ChatIndexRouteView() {
  const welcome = useServerWelcome();
  const primaryEnvironmentId = usePrimaryEnvironmentId();
  const bootstrapComplete = useStore((store) =>
    selectEnvironmentState(store, primaryEnvironmentId).bootstrapComplete,
  );
  const { handleNewThread } = useNewThreadHandler();
  const handleNewThreadRef = useRef(handleNewThread);
  handleNewThreadRef.current = handleNewThread;

  useEffect(() => {
    if (!bootstrapComplete) return;
    const homeDir = welcome?.homeDir;
    if (!homeDir || !primaryEnvironmentId) return;
    const environmentId = primaryEnvironmentId;
    void (async () => {
      const { ensureHomeChatProject } = await import("../lib/chatProjects");
      const projectId = await ensureHomeChatProject(homeDir, environmentId);
      if (!projectId) return;
      await handleNewThreadRef.current(
        scopeProjectRef(environmentId as never, projectId as never),
      );
    })();
  }, [bootstrapComplete, welcome?.homeDir, primaryEnvironmentId]);

  return <NoActiveThreadState />;
}

export const Route = createFileRoute("/_chat/")({
  component: ChatIndexRouteView,
});
