import type { EnvironmentId, PortForward, PortsDetectResult } from "@t3tools/contracts";
import { ExternalLink, Network, Plus, RefreshCw, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import type React from "react";
import { readEnvironmentApi } from "~/environmentApi";
import { usePortForwards } from "~/rpc/portsState";

function parsePort(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const n = parseInt(trimmed, 10);
  return Number.isInteger(n) && n >= 1 && n <= 65535 ? n : null;
}

function ForwardRow({
  forward,
  isRemoving,
  onRemove,
}: {
  forward: PortForward;
  isRemoving: boolean;
  onRemove: (id: string) => void;
}) {
  const localUrl = `http://localhost:${forward.localPort}`;
  const label = forward.label ?? `${forward.remoteHost}:${forward.remotePort}`;

  return (
    <div className="flex items-center gap-2 rounded-md border border-border/70 bg-background px-3 py-2 text-sm">
      <Network className="size-3.5 shrink-0 text-muted-foreground" />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate font-medium text-foreground">{label}</span>
          <span className="shrink-0 rounded-full bg-muted px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground">
            :{forward.localPort}
          </span>
        </div>
        <div className="truncate text-[11px] text-muted-foreground">
          → {forward.remoteHost}:{forward.remotePort}
        </div>
      </div>
      <button
        type="button"
        title={`Open ${localUrl} in browser`}
        className="shrink-0 rounded p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        onClick={() => window.open(localUrl, "_blank", "noopener,noreferrer")}
      >
        <ExternalLink className="size-3.5" />
      </button>
      <button
        type="button"
        title="Stop forwarding"
        disabled={isRemoving}
        className="shrink-0 rounded p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-destructive disabled:opacity-50"
        onClick={() => onRemove(forward.id)}
      >
        <X className="size-3.5" />
      </button>
    </div>
  );
}

function DetectedPortRow({
  port,
  isForwarding,
  onForward,
}: {
  port: PortsDetectResult["ports"][number];
  isForwarding: boolean;
  onForward: (port: number) => void;
}) {
  return (
    <div className="flex items-center gap-2 rounded-md border border-border/50 bg-background px-3 py-2 text-sm">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="font-medium text-foreground">:{port.port}</span>
          {port.framework && (
            <span className="shrink-0 rounded-full bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground">
              {port.framework}
            </span>
          )}
        </div>
        <div className="text-[11px] text-muted-foreground">{port.processName}</div>
      </div>
      <button
        type="button"
        title={`Forward port ${port.port}`}
        disabled={isForwarding}
        className="shrink-0 rounded p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-50"
        onClick={() => onForward(port.port)}
      >
        <Plus className="size-3.5" />
      </button>
    </div>
  );
}

interface PortsPanelProps {
  environmentId: EnvironmentId;
  cwd?: string | null;
}

export function PortsPanel({ environmentId, cwd }: PortsPanelProps) {
  const forwards = usePortForwards();
  const [detected, setDetected] = useState<PortsDetectResult | null>(null);
  const [detectLoading, setDetectLoading] = useState(false);
  const [detectError, setDetectError] = useState<string | null>(null);
  const [removingIds, setRemovingIds] = useState<ReadonlySet<string>>(new Set());
  const [forwardingPorts, setForwardingPorts] = useState<ReadonlySet<number>>(new Set());

  const [addPortInput, setAddPortInput] = useState("");
  const [addPortError, setAddPortError] = useState<string | null>(null);
  const [addPortLoading, setAddPortLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const runDetect = useCallback(async () => {
    const api = readEnvironmentApi(environmentId);
    if (!api) return;
    setDetectLoading(true);
    setDetectError(null);
    try {
      const result = await api.ports.detect(cwd ? { cwd } : undefined);
      setDetected(result);
    } catch (err) {
      setDetectError(err instanceof Error ? err.message : "Failed to detect ports");
    } finally {
      setDetectLoading(false);
    }
  }, [cwd, environmentId]);

  useEffect(() => {
    void runDetect();
  }, [runDetect]);

  const handleForward = useCallback(
    async (remotePort: number) => {
      const api = readEnvironmentApi(environmentId);
      if (!api) return;
      setForwardingPorts((prev) => new Set([...prev, remotePort]));
      try {
        await api.ports.forwardCreate({ remotePort });
      } catch {
        // error surfaced via atom update failing
      } finally {
        setForwardingPorts((prev) => {
          const next = new Set(prev);
          next.delete(remotePort);
          return next;
        });
      }
    },
    [environmentId],
  );

  const handleRemove = useCallback(
    async (forwardId: string) => {
      const api = readEnvironmentApi(environmentId);
      if (!api) return;
      setRemovingIds((prev) => new Set([...prev, forwardId]));
      try {
        await api.ports.forwardRemove({ forwardId });
      } catch {
        // error surfaced via atom update failing
      } finally {
        setRemovingIds((prev) => {
          const next = new Set(prev);
          next.delete(forwardId);
          return next;
        });
      }
    },
    [environmentId],
  );

  const handleAddPortSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      const api = readEnvironmentApi(environmentId);
      if (!api) return;
      const port = parsePort(addPortInput);
      if (port === null) {
        setAddPortError("Enter a port between 1 and 65535");
        return;
      }
      setAddPortError(null);
      setAddPortLoading(true);
      try {
        await api.ports.forwardCreate({ remotePort: port });
        setAddPortInput("");
        inputRef.current?.focus();
      } catch (err) {
        setAddPortError(err instanceof Error ? err.message : "Failed to forward port");
      } finally {
        setAddPortLoading(false);
      }
    },
    [addPortInput, environmentId],
  );

  const forwardedRemotePorts = new Set(forwards.map((f) => f.remotePort));
  const unforwardedDetected =
    detected?.ports.filter((p) => !forwardedRemotePorts.has(p.port)) ?? [];

  return (
    <div className="flex h-full min-h-0 flex-col overflow-y-auto">
      <div className="flex flex-col gap-4 p-3">
        {/* Active forwards */}
        <section>
          <div className="mb-2 flex items-center gap-1.5">
            <Network className="size-3.5 text-muted-foreground" />
            <span className="text-xs font-semibold text-foreground">Forwarded Ports</span>
            {forwards.length > 0 && (
              <span className="text-xs text-muted-foreground">({forwards.length})</span>
            )}
          </div>

          {forwards.length === 0 ? (
            <p className="text-xs text-muted-foreground">No active port forwards.</p>
          ) : (
            <div className="flex flex-col gap-1.5">
              {forwards.map((forward) => (
                <ForwardRow
                  key={forward.id}
                  forward={forward}
                  isRemoving={removingIds.has(forward.id)}
                  onRemove={handleRemove}
                />
              ))}
            </div>
          )}
        </section>

        {/* Add port manually */}
        <section>
          <div className="mb-2 flex items-center gap-1.5">
            <Plus className="size-3.5 text-muted-foreground" />
            <span className="text-xs font-semibold text-foreground">Forward a Port</span>
          </div>
          <form onSubmit={handleAddPortSubmit} className="flex items-start gap-2">
            <div className="flex flex-col gap-1">
              <input
                ref={inputRef}
                type="number"
                min={1}
                max={65535}
                value={addPortInput}
                onChange={(e) => {
                  setAddPortInput(e.target.value);
                  setAddPortError(null);
                }}
                placeholder="Port number"
                className="h-7 w-28 rounded-md border border-input bg-background px-2.5 text-sm outline-none placeholder:text-muted-foreground/60 focus-visible:ring-2 focus-visible:ring-ring"
              />
              {addPortError && <span className="text-[11px] text-destructive">{addPortError}</span>}
            </div>
            <button
              type="submit"
              disabled={addPortLoading || !addPortInput.trim()}
              className="inline-flex h-7 items-center gap-1.5 rounded-md border border-border bg-background px-2.5 text-xs font-medium text-foreground transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
            >
              Forward
            </button>
          </form>
        </section>

        {/* Detected ports */}
        <section>
          <div className="mb-2 flex items-center gap-1.5">
            <span className="text-xs font-semibold text-foreground">Detected Ports</span>
            {unforwardedDetected.length > 0 && (
              <span className="text-xs text-muted-foreground">({unforwardedDetected.length})</span>
            )}
            <button
              type="button"
              title="Refresh detected ports"
              disabled={detectLoading}
              className="ml-auto rounded p-0.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-50"
              onClick={runDetect}
            >
              <RefreshCw className={`size-3.5 ${detectLoading ? "animate-spin" : ""}`} />
            </button>
          </div>

          {detectError && <p className="mb-2 text-[11px] text-destructive">{detectError}</p>}

          {!detectLoading && unforwardedDetected.length === 0 && !detectError && (
            <p className="text-xs text-muted-foreground">
              {detected === null ? "Scanning…" : "No detectable ports running."}
            </p>
          )}

          {unforwardedDetected.length > 0 && (
            <div className="flex flex-col gap-1.5">
              {unforwardedDetected.map((port) => (
                <DetectedPortRow
                  key={port.port}
                  port={port}
                  isForwarding={forwardingPorts.has(port.port)}
                  onForward={handleForward}
                />
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
