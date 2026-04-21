import type { ReactNode } from "react";
import {
  FolderTreeIcon,
  GitCompareArrowsIcon,
  ListTreeIcon,
  PanelRightCloseIcon,
} from "lucide-react";
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
  onSelectPanel?: (panel: ThreadRightPanelKind) => void;
}

function RightPanelTabs(props: {
  activePanel: ThreadRightPanelKind;
  planLabel: string;
  onClose: () => void;
  onSelectPanel?: ((panel: ThreadRightPanelKind) => void) | undefined;
}) {
  const tabs: Array<{
    icon: ReactNode;
    key: ThreadRightPanelKind;
    label: string;
  }> = [
    {
      key: "diff",
      label: "Diff",
      icon: <GitCompareArrowsIcon className="size-3.5" />,
    },
    {
      key: "files",
      label: "Files",
      icon: <FolderTreeIcon className="size-3.5" />,
    },
    {
      key: "ports",
      label: "Ports",
      icon: <ListTreeIcon className="size-3.5" />,
    },
    {
      key: "plan",
      label: props.planLabel,
      icon: <ListTreeIcon className="size-3.5" />,
    },
  ];

  return (
    <div className="flex h-11 shrink-0 items-center gap-2 border-border/60 border-b px-3">
      <div className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            title={tab.label}
            className={cn(
              "inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border transition",
              props.activePanel === tab.key
                ? "border-border bg-accent text-accent-foreground"
                : "border-transparent text-muted-foreground hover:bg-accent/60 hover:text-foreground",
            )}
            onClick={() => props.onSelectPanel?.(tab.key)}
          >
            {tab.icon}
          </button>
        ))}
      </div>
      <Button
        size="icon-xs"
        variant="ghost"
        onClick={props.onClose}
        aria-label="Close right panel"
        className="text-muted-foreground/50 hover:text-foreground/70"
      >
        <PanelRightCloseIcon className="size-3.5" />
      </Button>
    </div>
  );
}

function ThreadPanelFrame(props: { mode: "sheet" | "sidebar"; children: ReactNode }) {
  return (
    <div
      className={cn(
        "flex min-h-0 flex-col bg-card/50",
        props.mode === "sidebar" ? "h-full w-full" : "h-full w-full",
      )}
    >
      <div className="min-h-0 flex-1">{props.children}</div>
    </div>
  );
}

export function ThreadRightPanel(props: ThreadRightPanelProps) {
  const content =
    props.panel === "diff" ? (
      <DiffPanel mode={props.mode} />
    ) : props.panel === "plan" ? (
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
    ) : props.panel === "files" ? (
      <ThreadPanelFrame mode={props.mode}>
        <FilePanel />
      </ThreadPanelFrame>
    ) : (
      <ThreadPanelFrame mode={props.mode}>
        <PortsPanel environmentId={props.environmentId} cwd={props.portsCwd ?? null} />
      </ThreadPanelFrame>
    );

  return (
    <div className="flex h-full min-h-0 flex-col">
      <RightPanelTabs
        activePanel={props.panel}
        planLabel={props.planLabel}
        onClose={props.onClose}
        onSelectPanel={props.onSelectPanel}
      />
      <div className="min-h-0 flex-1">{content}</div>
    </div>
  );
}
