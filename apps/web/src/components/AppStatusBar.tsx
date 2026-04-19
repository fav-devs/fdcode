import { memo } from "react";
import { cn } from "../lib/utils";
import { useServerWelcome } from "../rpc/serverState";
import {
  selectProjectsAcrossEnvironments,
  selectThreadsAcrossEnvironments,
  useStore,
} from "../store";

export const AppStatusBar = memo(function AppStatusBar() {
  const welcome = useServerWelcome();
  const threadCount = useStore((s) => selectThreadsAcrossEnvironments(s).length);
  const projectCount = useStore((s) => selectProjectsAcrossEnvironments(s).length);

  return (
    <div className="flex h-7 shrink-0 items-center gap-2.5 border-t border-border/30 bg-black/[0.03] px-8 text-[11px] text-muted-foreground/70 dark:bg-white/[0.02]">
      <div
        className={cn(
          "size-1.5 shrink-0 rounded-full",
          welcome ? "bg-emerald-500" : "bg-amber-400",
        )}
        title={welcome ? "Server connected" : "Connecting…"}
      />
      {welcome && (
        <>
          <span className="max-w-40 truncate text-foreground/60" title={welcome.projectName}>
            {welcome.projectName}
          </span>
          <Divider />
        </>
      )}
      <span>
        {threadCount} {threadCount === 1 ? "thread" : "threads"}
      </span>
      {projectCount > 0 && (
        <>
          <Divider />
          <span>
            {projectCount} {projectCount === 1 ? "project" : "projects"}
          </span>
        </>
      )}
    </div>
  );
});

function Divider() {
  return <span className="text-border">·</span>;
}
