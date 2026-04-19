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

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <button type="button" className="flex items-center gap-2 rounded px-8 hover:bg-white/5">
            <StatChip label="CPU" value={`${cpu}%`} warn={cpu > 60} high={cpu > 80} />
            <Divider />
            <StatChip
              label="RAM"
              value={`${memUsed} / ${memTotal}`}
              warn={memPercent > 70}
              high={memPercent > 85}
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

function StatChip({
  label,
  value,
  warn,
  high,
}: {
  label: string;
  value: string;
  warn: boolean;
  high: boolean;
}) {
  return (
    <span className={cn(high ? "text-red-400" : warn ? "text-amber-400" : "")}>
      <span className="text-muted-foreground/50">{label} </span>
      {value}
    </span>
  );
}

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

      <div className="ml-auto">
        <CpuRamStats />
      </div>
    </div>
  );
});

function Divider() {
  return <span className="text-border">·</span>;
}
