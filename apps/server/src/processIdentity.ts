import * as NodeFs from "node:fs";

const readProcStat = (pid: number): string | null => {
  if (process.platform !== "linux") {
    return null;
  }
  try {
    return NodeFs.readFileSync(`/proc/${pid}/stat`, "utf8");
  } catch {
    return null;
  }
};

/**
 * Reads Linux process start ticks from /proc/[pid]/stat (field 22).
 * Returns null when unavailable (non-Linux, missing proc entry, parse failure).
 */
export const readLinuxProcessStartTicks = (pid: number): number | null => {
  const raw = readProcStat(pid);
  if (!raw) {
    return null;
  }

  const commandEnd = raw.lastIndexOf(")");
  if (commandEnd < 0) {
    return null;
  }
  const afterCommand = raw.slice(commandEnd + 2).trim();
  const fields = afterCommand.split(/\s+/);
  const startTicks = Number.parseInt(fields[19] ?? "", 10);
  return Number.isFinite(startTicks) ? startTicks : null;
};
