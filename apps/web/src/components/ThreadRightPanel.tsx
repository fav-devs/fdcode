import type { ReactNode } from "react";
import { PanelRightCloseIcon } from "lucide-react";
import type { EnvironmentId } from "@t3tools/contracts";
import { type TimestampFormat } from "@t3tools/contracts/settings";

import { cn } from "~/lib/utils";

import type { ActivePlanState, LatestProposedPlanState } from "../session-logic";
import DiffPanel from "./DiffPanel";
import FilePanel from "./FilePanel";
import PlanSidebar from "./PlanSidebar";
import { PortsPanel } from "./PortsPanel";
import { Button } from "./ui/button";

export type ThreadRightPanelKind = "diff" | "files" | "ports" | "plan";

interface ThreadRightPanelProps {
  panel: ThreadRightPanelKind;
  mode: "sheet" | "sidebar";
  environmentId: EnvironmentId;
  portsCwd?: string | null | undefined;
  activePlan: ActivePlanState | null;
  activeProposedPlan: LatestProposedPlanState | null;
  planLabel: string;
  markdownCwd?: string | undefined;
  workspaceRoot?: string | undefined;
  timestampFormat: TimestampFormat;
  onClose: () => void;
}

function ThreadPanelFrame(props: {
  title: string;
  mode: "sheet" | "sidebar";
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        "flex min-h-0 flex-col bg-card/50",
        props.mode === "sidebar"
          ? "h-full w-[min(42vw,820px)] min-w-[360px] max-w-[560px] shrink-0 border-l border-border/70"
          : "h-full w-full",
      )}
    >
      <div className="flex h-12 shrink-0 items-center justify-between border-b border-border/60 px-3">
        <h2 className="font-medium text-sm text-foreground">{props.title}</h2>
        <Button
          size="icon-xs"
          variant="ghost"
          onClick={props.onClose}
          aria-label={`Close ${props.title.toLowerCase()} sidebar`}
          className="text-muted-foreground/50 hover:text-foreground/70"
        >
          <PanelRightCloseIcon className="size-3.5" />
        </Button>
      </div>
      <div className="min-h-0 flex-1">{props.children}</div>
    </div>
  );
}

export function ThreadRightPanel(props: ThreadRightPanelProps) {
  if (props.panel === "diff") {
    return <DiffPanel mode={props.mode} />;
  }

  if (props.panel === "plan") {
    return (
      <PlanSidebar
        activePlan={props.activePlan}
        activeProposedPlan={props.activeProposedPlan}
        label={props.planLabel}
        environmentId={props.environmentId}
        markdownCwd={props.markdownCwd}
        workspaceRoot={props.workspaceRoot}
        timestampFormat={props.timestampFormat}
        mode={props.mode}
        onClose={props.onClose}
      />
    );
  }

  if (props.panel === "files") {
    return (
      <ThreadPanelFrame title="Files" mode={props.mode} onClose={props.onClose}>
        <FilePanel />
      </ThreadPanelFrame>
    );
  }

  return (
    <ThreadPanelFrame title="Ports" mode={props.mode} onClose={props.onClose}>
      <PortsPanel environmentId={props.environmentId} cwd={props.portsCwd ?? null} />
    </ThreadPanelFrame>
  );
}
