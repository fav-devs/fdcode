import {
  type DetectedPort,
  type PortForward,
  type PortForwardMetadataStreamEvent,
  type PortsDetectInput,
  type PortsDetectResult,
  PortsError,
} from "@t3tools/contracts";
import { Context, Effect, Layer, Ref } from "effect";
import * as net from "node:net";
import { exec } from "node:child_process";
import { promisify } from "node:util";
import { readFile, readlink } from "node:fs/promises";
import path from "node:path";

const execAsync = promisify(exec);

type DetectedPortCandidate = DetectedPort & {
  cwd: string | null;
};

// ---------------------------------------------------------------------------
// Framework detection
// ---------------------------------------------------------------------------

const FRAMEWORK_PATTERNS: Array<{ match: RegExp; label: string }> = [
  { match: /next[\s-]?server|next\.js/i, label: "Next.js" },
  { match: /vite/i, label: "Vite" },
  { match: /webpack/i, label: "Webpack" },
  { match: /react[-_]scripts/i, label: "Create React App" },
  { match: /nuxt/i, label: "Nuxt" },
  { match: /remix/i, label: "Remix" },
  { match: /astro/i, label: "Astro" },
  { match: /svelte/i, label: "SvelteKit" },
  { match: /express/i, label: "Express" },
  { match: /fastify/i, label: "Fastify" },
  { match: /hono/i, label: "Hono" },
  { match: /django/i, label: "Django" },
  { match: /flask/i, label: "Flask" },
  { match: /uvicorn/i, label: "FastAPI" },
  { match: /rails/i, label: "Rails" },
  { match: /postgres|psql/i, label: "PostgreSQL" },
  { match: /mysql/i, label: "MySQL" },
  { match: /redis-server/i, label: "Redis" },
  { match: /mongod/i, label: "MongoDB" },
];

function detectFramework(processName: string, cmdline?: string): string | null {
  const haystack = `${processName} ${cmdline ?? ""}`;
  for (const { match, label } of FRAMEWORK_PATTERNS) {
    if (match.test(haystack)) return label;
  }
  return null;
}

// ---------------------------------------------------------------------------
// OS port scanning
// ---------------------------------------------------------------------------

async function getProcessCwd(pid: number): Promise<string | null> {
  if (process.platform === "linux") {
    try {
      return await readlink(`/proc/${pid}/cwd`);
    } catch {
      return null;
    }
  }

  if (process.platform === "darwin") {
    try {
      const { stdout } = await execAsync(`lsof -a -p ${pid} -d cwd -Fn`, { timeout: 3000 });
      const cwdLine = stdout
        .split("\n")
        .map((line) => line.trim())
        .find((line) => line.startsWith("n"));
      return cwdLine ? cwdLine.slice(1) : null;
    } catch {
      return null;
    }
  }

  return null;
}

function normalizeCwd(value: string): string {
  const resolved = path.resolve(value);
  return resolved.endsWith(path.sep) ? resolved.slice(0, -path.sep.length) : resolved;
}

function isWithinCwd(candidateCwd: string | null, filterCwd: string | undefined): boolean {
  if (!filterCwd) return true;
  if (!candidateCwd) return false;

  const normalizedCandidate = normalizeCwd(candidateCwd);
  const normalizedFilter = normalizeCwd(filterCwd);
  return (
    normalizedCandidate === normalizedFilter ||
    normalizedCandidate.startsWith(`${normalizedFilter}${path.sep}`)
  );
}

async function detectLinuxPorts(): Promise<DetectedPortCandidate[]> {
  let stdout: string;
  try {
    ({ stdout } = await execAsync("ss -tlnp", { timeout: 8000 }));
  } catch {
    return [];
  }
  const entries: DetectedPortCandidate[] = [];
  for (const line of stdout.split("\n")) {
    if (!line.startsWith("LISTEN")) continue;
    const portMatch = line.match(/:(\d+)\s+\S+:\*/);
    if (!portMatch) continue;
    const port = parseInt(portMatch[1]!, 10);
    if (!port || port > 65535) continue;

    let pid: number | null = null;
    let processName = "unknown";
    const usersMatch = line.match(/users:\(\("([^"]+)",pid=(\d+)/);
    if (usersMatch) {
      processName = usersMatch[1]!;
      pid = parseInt(usersMatch[2]!, 10);
    }

    let cmdline: string | undefined;
    let cwd: string | null = null;
    if (pid) {
      try {
        const raw = await readFile(`/proc/${pid}/cmdline`, "utf8");
        cmdline = raw.replace(/\0/g, " ").trim();
      } catch {
        /* process may have exited */
      }
      cwd = await getProcessCwd(pid);
    }

    let uptimeSeconds: number | null = null;
    if (pid) {
      try {
        const statRaw = await readFile(`/proc/${pid}/stat`, "utf8");
        const fields = statRaw.split(" ");
        const startTimeTicks = parseInt(fields[21] ?? "0", 10);
        const uptimeRaw = await readFile("/proc/uptime", "utf8");
        const systemUptimeSec = parseFloat(uptimeRaw.split(" ")[0] ?? "0");
        uptimeSeconds = Math.max(0, Math.floor(systemUptimeSec - startTimeTicks / 100));
      } catch {
        /* ignore */
      }
    }

    entries.push({
      port,
      pid,
      processName,
      framework: detectFramework(processName, cmdline),
      uptimeSeconds,
      cwd,
    });
  }
  return entries;
}

async function detectMacOsPorts(): Promise<DetectedPortCandidate[]> {
  let stdout: string;
  try {
    ({ stdout } = await execAsync("lsof -iTCP -sTCP:LISTEN -n -P -F pcn", { timeout: 10000 }));
  } catch {
    return [];
  }

  type LsofRecord = { pid: number; command: string; ports: number[] };
  const records: LsofRecord[] = [];
  let current: Partial<LsofRecord> = {};
  for (const rawLine of stdout.split("\n")) {
    const line = rawLine.trim();
    if (!line) continue;
    const indicator = line[0];
    const value = line.slice(1);
    if (indicator === "p") {
      current = { pid: parseInt(value, 10), ports: [] };
      records.push(current as LsofRecord);
    } else if (indicator === "c") {
      if (current) current.command = value;
    } else if (indicator === "n") {
      const portMatch = value.match(/:(\d+)$/);
      if (portMatch && current.ports) current.ports.push(parseInt(portMatch[1]!, 10));
    }
  }

  const entries: DetectedPortCandidate[] = [];
  for (const record of records) {
    if (!record.pid || !record.command || !record.ports?.length) continue;
    const cwd = await getProcessCwd(record.pid);
    let uptimeSeconds: number | null = null;
    try {
      const { stdout: psOut } = await execAsync(`ps -p ${record.pid} -o etimes=`, {
        timeout: 3000,
      });
      const parsed = parseInt(psOut.trim(), 10);
      if (!Number.isNaN(parsed)) uptimeSeconds = parsed;
    } catch {
      /* ignore */
    }
    for (const port of record.ports) {
      entries.push({
        port,
        pid: record.pid,
        processName: record.command,
        framework: detectFramework(record.command),
        uptimeSeconds,
        cwd,
      });
    }
  }
  return entries;
}

async function runDetectPorts(input?: PortsDetectInput): Promise<PortsDetectResult> {
  const ports =
    process.platform === "linux"
      ? await detectLinuxPorts()
      : process.platform === "darwin"
        ? await detectMacOsPorts()
        : [];

  const unique = Array.from(new Map(ports.map((p) => [p.port, p])).values())
    .filter((p) => isWithinCwd(p.cwd, input?.cwd))
    .filter((p) => p.port > 1024)
    .toSorted((a, b) => a.port - b.port)
    .map(({ cwd: _cwd, ...port }) => port);
  return { ports: unique };
}

// ---------------------------------------------------------------------------
// Free port finder
// ---------------------------------------------------------------------------

function findFreePort(preferred?: number): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.listen(preferred ?? 0, "127.0.0.1", () => {
      const addr = server.address();
      if (!addr || typeof addr === "string") {
        server.close();
        reject(new Error("Could not determine free port"));
        return;
      }
      const port = addr.port;
      server.close((err) => (err ? reject(err) : resolve(port)));
    });
    server.on("error", (err) => {
      if ((err as NodeJS.ErrnoException).code === "EADDRINUSE" && preferred) {
        findFreePort().then(resolve, reject);
      } else {
        reject(err);
      }
    });
  });
}

// ---------------------------------------------------------------------------
// Service shape
// ---------------------------------------------------------------------------

export interface PortsManagerShape {
  readonly detect: (input?: PortsDetectInput) => Effect.Effect<PortsDetectResult, PortsError>;
  readonly createForward: (input: {
    remotePort: number;
    remoteHost?: string;
    localPort?: number;
    label?: string | null;
  }) => Effect.Effect<PortForward, PortsError>;
  readonly removeForward: (forwardId: string) => Effect.Effect<void, PortsError>;
  readonly getForwards: Effect.Effect<ReadonlyArray<PortForward>>;
  readonly subscribeMetadata: (
    listener: (event: PortForwardMetadataStreamEvent) => Effect.Effect<void, never, never>,
  ) => Effect.Effect<() => void, never, never>;
}

export class PortsManager extends Context.Service<PortsManager, PortsManagerShape>()(
  "t3/portsManager",
) {}

// ---------------------------------------------------------------------------
// Live implementation
// ---------------------------------------------------------------------------

interface ForwardSession {
  readonly forward: PortForward;
  readonly server: net.Server;
}

export const PortsManagerLive = Layer.effect(
  PortsManager,
  Effect.gen(function* () {
    const sessionsSync = new Map<string, ForwardSession>();
    const sessionsRef = yield* Ref.make<Map<string, ForwardSession>>(sessionsSync);
    const listeners = new Set<
      (event: PortForwardMetadataStreamEvent) => Effect.Effect<void, never, never>
    >();

    const emit = (event: PortForwardMetadataStreamEvent): Effect.Effect<void, never, never> =>
      Effect.forEach(
        Array.from(listeners),
        (listener) =>
          listener(event).pipe(
            Effect.catchCause(() => Effect.void as Effect.Effect<void, never, never>),
          ),
        { concurrency: "unbounded", discard: true },
      ) as Effect.Effect<void, never, never>;

    const shape: PortsManagerShape = {
      detect: (input) =>
        Effect.tryPromise({
          try: () => runDetectPorts(input),
          catch: (err) => new PortsError({ reason: `Port scan failed: ${err}` }),
        }),

      createForward: ({ remotePort, remoteHost = "127.0.0.1", localPort, label = null }) =>
        Effect.tryPromise({
          try: async () => {
            const resolvedLocalPort = await findFreePort(localPort ?? 0);
            const id = crypto.randomUUID();
            const forward: PortForward = {
              id,
              localPort: resolvedLocalPort,
              remotePort,
              remoteHost,
              label: label ?? null,
              createdAt: new Date().toISOString(),
            };

            const server = net.createServer((clientSocket) => {
              const remote = net.createConnection({ host: remoteHost, port: remotePort });
              clientSocket.pipe(remote);
              remote.pipe(clientSocket);
              const cleanup = () => {
                clientSocket.destroy();
                remote.destroy();
              };
              clientSocket.on("error", cleanup);
              remote.on("error", cleanup);
            });

            await new Promise<void>((resolve, reject) => {
              server.listen(resolvedLocalPort, "127.0.0.1", resolve);
              server.once("error", reject);
            });

            return { server, forward };
          },
          catch: (err) => new PortsError({ reason: `Failed to create port forward: ${err}` }),
        }).pipe(
          Effect.tap(({ forward, server }) =>
            Ref.update(sessionsRef, (m) => new Map([...m, [forward.id, { forward, server }]])).pipe(
              Effect.tap(() =>
                Effect.sync(() => {
                  sessionsSync.set(forward.id, { forward, server });
                }).pipe(Effect.andThen(emit({ type: "upsert", forward }))),
              ),
            ),
          ),
          Effect.map(({ forward }) => forward),
        ),

      removeForward: (forwardId) =>
        Effect.gen(function* () {
          const sessions = yield* Ref.get(sessionsRef);
          const session = sessions.get(forwardId);
          if (!session) {
            return yield* new PortsError({ reason: `Port forward not found: ${forwardId}` });
          }
          yield* Effect.tryPromise({
            try: () => new Promise<void>((resolve) => session.server.close(() => resolve())),
            catch: (err) => new PortsError({ reason: `Failed to close forward: ${err}` }),
          });
          yield* Ref.update(sessionsRef, (m) => {
            const next = new Map(m);
            next.delete(forwardId);
            return next;
          });
          yield* Effect.sync(() => {
            sessionsSync.delete(forwardId);
          });
          yield* emit({ type: "remove", forwardId });
        }),

      getForwards: Ref.get(sessionsRef).pipe(
        Effect.map((m) => Array.from(m.values()).map((s) => s.forward)),
      ),

      subscribeMetadata: (listener) =>
        Effect.gen(function* () {
          listeners.add(listener);
          const forwards = Array.from(sessionsSync.values()).map((s) => s.forward);
          yield* listener({ type: "snapshot", forwards }).pipe(
            Effect.catchCause(() => Effect.void),
          );
          return () => {
            listeners.delete(listener);
          };
        }),
    };

    return shape;
  }),
);
