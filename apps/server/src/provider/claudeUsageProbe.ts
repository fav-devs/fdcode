import type { ServerProviderUsageLimits } from "@t3tools/contracts";

const FALLBACK_TRIGGER_DELAY_MS = 150;
const PROBE_TIMEOUT_MS = 4_000;
const SESSION_WINDOW_DURATION_MINS = 300;
const WEEKLY_WINDOW_DURATION_MINS = 10080;

export interface ClaudeUsageOutput {
  readonly checkedAt: string;
  readonly output: string;
}

export function parseClaudeUsageLimitsOutput(input: ClaudeUsageOutput): ServerProviderUsageLimits {
  const windows: Array<ServerProviderUsageLimits["windows"][number]> = [];

  const sessionMatch = /session usage\s+(\d+)%\s+resets at\s+(\S+)/i.exec(input.output);
  if (sessionMatch) {
    windows.push({
      kind: "session",
      label: "Session",
      usedPercent: parseInt(sessionMatch[1]!, 10),
      windowDurationMins: SESSION_WINDOW_DURATION_MINS,
      resetsAt: new Date(sessionMatch[2]!).toISOString(),
    });
  }

  const weeklyMatch = /weekly usage\s+(\d+)%\s+resets at\s+(\S+)/i.exec(input.output);
  if (weeklyMatch) {
    windows.push({
      kind: "weekly",
      label: "Weekly",
      usedPercent: parseInt(weeklyMatch[1]!, 10),
      windowDurationMins: WEEKLY_WINDOW_DURATION_MINS,
      resetsAt: new Date(weeklyMatch[2]!).toISOString(),
    });
  }

  if (windows.length > 0) {
    return { source: "claudeStatusProbe", available: true, checkedAt: input.checkedAt, windows };
  }

  return {
    source: "claudeStatusProbe",
    available: false,
    checkedAt: input.checkedAt,
    reason: "Usage limits unavailable for this Claude account.",
    windows: [],
  };
}

export function shouldRequestClaudeUsageFallback(input: ClaudeUsageOutput): boolean {
  return !/session usage|weekly usage/i.test(input.output);
}

export interface ClaudeUsageProbeResult {
  readonly usageLimits: ServerProviderUsageLimits;
  readonly rawOutput: string;
}

export async function probeClaudeUsageLimits(input: {
  readonly binaryPath: string;
  readonly cwd: string;
  readonly checkedAt: string;
}): Promise<ClaudeUsageProbeResult> {
  const { spawn } = await import("node-pty");

  return new Promise((resolve) => {
    let rawOutput = "";
    let settled = false;
    let fallbackHandle: ReturnType<typeof setTimeout> | undefined;
    let timeoutHandle: ReturnType<typeof setTimeout> | undefined;

    const child = spawn(input.binaryPath, [], { cwd: input.cwd });

    const finish = () => {
      if (settled) return;
      settled = true;
      clearTimeout(fallbackHandle);
      clearTimeout(timeoutHandle);
      resolve({
        usageLimits: parseClaudeUsageLimitsOutput({ checkedAt: input.checkedAt, output: rawOutput }),
        rawOutput,
      });
    };

    child.onData((data: string) => {
      rawOutput += data;
      if (!shouldRequestClaudeUsageFallback({ checkedAt: input.checkedAt, output: rawOutput })) {
        finish();
      }
    });

    child.onExit(() => {
      finish();
    });

    child.write("/status\r");

    fallbackHandle = setTimeout(() => {
      if (settled) return;
      if (!shouldRequestClaudeUsageFallback({ checkedAt: input.checkedAt, output: rawOutput })) {
        finish();
        return;
      }
      child.write("/usage\r");
    }, FALLBACK_TRIGGER_DELAY_MS);

    timeoutHandle = setTimeout(() => {
      child.kill();
      finish();
    }, PROBE_TIMEOUT_MS);
  });
}
