import {
  ActivityIcon,
  CpuIcon,
  FolderIcon,
  MemoryStickIcon,
  MessageSquareIcon,
} from "lucide-react";
import { memo } from "react";
import { cn } from "../lib/utils";
import { useResourceStats, useServerWelcome } from "../rpc/serverState";
import {
  selectProjectsAcrossEnvironments,
  selectThreadsAcrossEnvironments,
  useStore,
} from "../store";
import { Tooltip, TooltipPopup, TooltipTrigger } from "./ui/tooltip";

function formatBytes(bytes: number): string {
  const gb = bytes / 1024 / 1024 / 1024;
  return gb >= 1 ? `${gb.toFixed(1)} GB` : `${(bytes / 1024 / 1024).toFixed(0)} MB`;
}

function toCpuPercent(load1m: number, cpuCount: number): number {
  return Math.min(100, Math.round((load1m / cpuCount) * 100));
}

function CpuRamStats() {
  const stats = useResourceStats();
  if (!stats) return null;

  const cpu = toCpuPercent(stats.cpuLoad1m, stats.cpuCount);
  const memUsed = formatBytes(stats.memoryUsedBytes);
  const memTotal = formatBytes(stats.memoryTotalBytes);
  const memPercent = Math.round((stats.memoryUsedBytes / stats.memoryTotalBytes) * 100);

  const cpuWarn = cpu > 60;
  const cpuHigh = cpu > 80;
  const memWarn = memPercent > 70;
  const memHigh = memPercent > 85;

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <button type="button" className="flex items-center gap-2.5 rounded-md px-1 py-.5">
            <StatItem
              icon={<CpuIcon className="size-3 shrink-0" />}
              value={`${cpu}%`}
              warn={cpuWarn}
              high={cpuHigh}
            />
            <Divider />
            <StatItem
              icon={<MemoryStickIcon className="size-3 shrink-0" />}
              value={memUsed}
              warn={memWarn}
              high={memHigh}
            />
          </button>
        }
      />
      <TooltipPopup side="top" className="text-xs">
        <div className="flex flex-col gap-1 p-0.5">
          <div className="mb-0.5 font-medium text-foreground/80">System Resources</div>
          <Row label="CPU load (1m)" value={stats.cpuLoad1m.toFixed(2)} />
          <Row label="CPU cores" value={String(stats.cpuCount)} />
          <Row label="CPU utilisation" value={`${cpu}%`} />
          <div className="my-1 border-t border-border/30" />
          <Row label="Memory used" value={memUsed} />
          <Row label="Memory total" value={memTotal} />
          <Row label="Memory %" value={`${memPercent}%`} />
        </div>
      </TooltipPopup>
    </Tooltip>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-6">
      <span className="text-muted-foreground">{label}</span>
      <span>{value}</span>
    </div>
  );
}

function StatItem({
  icon,
  value,
  warn,
  high,
}: {
  icon: React.ReactNode;
  value: string;
  warn: boolean;
  high: boolean;
}) {
  return (
    <span
      className={cn(
        "flex items-center gap-1",
        high ? "text-red-400" : warn ? "text-amber-400" : "text-muted-foreground/60",
      )}
    >
      {icon}
      <span className={cn("tabular-nums", high || warn ? "" : "text-foreground/70")}>{value}</span>
    </span>
  );
}

export const AppStatusBar = memo(function AppStatusBar() {
  const welcome = useServerWelcome();
  const threadCount = useStore((s) => selectThreadsAcrossEnvironments(s).length);
  const projectCount = useStore((s) => selectProjectsAcrossEnvironments(s).length);

  const isConnected = !!welcome;

  return (
    <div className="flex h-7 shrink-0 items-center justify-between gap-0 px-0 sm:px-4 md:px-5 text-[11px] mt-1">
      {/* Left section — connection + workspace */}
      <div className="flex min-w-0 -translate-y-px items-center gap-2 rounded-2xl border border-border/60 bg-background/68 px-2 py-0.5 shadow-sm backdrop-blur">
        <ConnectionPill
          connected={isConnected}
          {...(welcome?.projectName ? { label: welcome.projectName } : {})}
        />

        {welcome && (
          <>
            <Divider />
            <StatusItem
              icon={<MessageSquareIcon className="size-3 shrink-0" />}
              label={`${threadCount} ${threadCount === 1 ? "thread" : "threads"}`}
            />
            {projectCount > 0 && (
              <>
                <Divider />
                <StatusItem
                  icon={<FolderIcon className="size-3 shrink-0" />}
                  label={`${projectCount} ${projectCount === 1 ? "project" : "projects"}`}
                />
              </>
            )}
          </>
        )}
      </div>

      {/* Right section — system stats */}
      <div className="shrink-0 -translate-y-px rounded-2xl border border-border/60 bg-background/68 px-2 py-0.5 shadow-sm backdrop-blur">
        <CpuRamStats />
      </div>
    </div>
  );
});

function ConnectionPill({ connected, label }: { connected: boolean; label?: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span
        className={cn("relative flex size-1.5 shrink-0")}
        title={connected ? "Server connected" : "Connecting…"}
      >
        {connected && (
          <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-50 [animation-duration:2.5s]" />
        )}
        <span
          className={cn(
            "relative inline-flex size-1.5 rounded-full",
            connected ? "bg-emerald-500" : "bg-amber-400",
          )}
        />
      </span>
      {label && (
        <span className="max-w-40 truncate text-foreground/60" title={label}>
          {label}
        </span>
      )}
      {!connected && (
        <span className="flex items-center gap-1 text-amber-400/80">
          <ActivityIcon className="size-3 shrink-0" />
          Connecting
        </span>
      )}
    </div>
  );
}

function StatusItem({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <span className="flex items-center gap-1 text-muted-foreground/60">
      {icon}
      <span className="text-foreground/70">{label}</span>
    </span>
  );
}

function Divider() {
  return <span className="h-3 w-px shrink-0 bg-border/50" />;
}
