import type { TerminalEvent, TerminalSessionSnapshot } from "@t3tools/contracts";
import { Atom, type AtomRegistry } from "effect/unstable/reactivity";

export interface TerminalSessionState {
  readonly snapshot: TerminalSessionSnapshot | null;
  readonly buffer: string;
  readonly status: TerminalSessionSnapshot["status"] | "closed";
  readonly error: string | null;
  readonly hasRunningSubprocess: boolean;
  readonly updatedAt: string | null;
  readonly version: number;
}

export interface TerminalSessionTarget {
  readonly environmentId: string | null;
  readonly threadId: string | null;
  readonly terminalId: string | null;
}

export interface KnownTerminalSessionTarget {
  readonly environmentId: string;
  readonly threadId: string;
  readonly terminalId: string;
}

export interface KnownTerminalSession {
  readonly target: KnownTerminalSessionTarget;
  readonly state: TerminalSessionState;
}

export interface TerminalSessionManagerConfig {
  readonly getRegistry: () => AtomRegistry.AtomRegistry;
  readonly maxBufferBytes?: number;
}

export const EMPTY_TERMINAL_SESSION_STATE = Object.freeze<TerminalSessionState>({
  snapshot: null,
  buffer: "",
  status: "closed",
  error: null,
  hasRunningSubprocess: false,
  updatedAt: null,
  version: 0,
});

const DEFAULT_MAX_BUFFER_BYTES = 512 * 1024;
const knownTerminalSessionKeys = new Set<string>();

export const terminalSessionStateAtom = Atom.family((key: string) => {
  knownTerminalSessionKeys.add(key);
  return Atom.make(EMPTY_TERMINAL_SESSION_STATE).pipe(
    Atom.keepAlive,
    Atom.withLabel(`terminal-session:${key}`),
  );
});

export const EMPTY_TERMINAL_SESSION_ATOM = Atom.make(EMPTY_TERMINAL_SESSION_STATE).pipe(
  Atom.keepAlive,
  Atom.withLabel("terminal-session:null"),
);

export const knownTerminalSessionsAtom = Atom.make<Record<string, KnownTerminalSessionTarget>>(
  {},
).pipe(Atom.keepAlive, Atom.withLabel("terminal-session:index"));

export function getTerminalSessionTargetKey(target: TerminalSessionTarget): string | null {
  if (target.environmentId === null || target.threadId === null || target.terminalId === null) {
    return null;
  }

  return `${target.environmentId}:${target.threadId}:${target.terminalId}`;
}

function toKnownTarget(target: TerminalSessionTarget): KnownTerminalSessionTarget | null {
  const targetKey = getTerminalSessionTargetKey(target);
  if (targetKey === null) {
    return null;
  }

  const environmentId = target.environmentId;
  const threadId = target.threadId;
  const terminalId = target.terminalId;
  if (environmentId === null || threadId === null || terminalId === null) {
    return null;
  }

  return {
    environmentId,
    threadId,
    terminalId,
  };
}

function trimBufferToBytes(buffer: string, maxBufferBytes: number): string {
  if (buffer.length <= maxBufferBytes) {
    return buffer;
  }

  return buffer.slice(buffer.length - maxBufferBytes);
}

function stateFromSnapshot(
  snapshot: TerminalSessionSnapshot,
  maxBufferBytes: number,
): TerminalSessionState {
  return {
    snapshot,
    buffer: trimBufferToBytes(snapshot.history, maxBufferBytes),
    status: snapshot.status,
    error: null,
    hasRunningSubprocess: false,
    updatedAt: snapshot.updatedAt,
    version: 1,
  };
}

export function createTerminalSessionManager(config: TerminalSessionManagerConfig) {
  const maxBufferBytes = config.maxBufferBytes ?? DEFAULT_MAX_BUFFER_BYTES;

  function rememberTarget(target: TerminalSessionTarget): string | null {
    const targetKey = getTerminalSessionTargetKey(target);
    const knownTarget = toKnownTarget(target);
    if (targetKey === null || knownTarget === null) {
      return null;
    }

    const current = config.getRegistry().get(knownTerminalSessionsAtom);
    const existing = current[targetKey];
    if (
      existing?.environmentId === knownTarget.environmentId &&
      existing.threadId === knownTarget.threadId &&
      existing.terminalId === knownTarget.terminalId
    ) {
      return targetKey;
    }

    config.getRegistry().set(knownTerminalSessionsAtom, {
      ...current,
      [targetKey]: knownTarget,
    });
    return targetKey;
  }

  function removeTargets(match: (target: KnownTerminalSessionTarget) => boolean): void {
    const current = config.getRegistry().get(knownTerminalSessionsAtom);
    const next = Object.fromEntries(
      Object.entries(current).filter(([, target]) => !match(target)),
    ) as Record<string, KnownTerminalSessionTarget>;
    if (Object.keys(next).length === Object.keys(current).length) {
      return;
    }

    config.getRegistry().set(knownTerminalSessionsAtom, next);
  }

  function getSnapshot(target: TerminalSessionTarget): TerminalSessionState {
    const targetKey = rememberTarget(target);
    if (targetKey === null) {
      return EMPTY_TERMINAL_SESSION_STATE;
    }

    return config.getRegistry().get(terminalSessionStateAtom(targetKey));
  }

  function setState(targetKey: string, nextState: TerminalSessionState): void {
    config.getRegistry().set(terminalSessionStateAtom(targetKey), nextState);
  }

  function syncSnapshot(
    target: Pick<TerminalSessionTarget, "environmentId">,
    snapshot: TerminalSessionSnapshot,
  ): void {
    const targetKey = rememberTarget({
      environmentId: target.environmentId,
      threadId: snapshot.threadId,
      terminalId: snapshot.terminalId,
    });
    if (targetKey === null) {
      return;
    }

    setState(targetKey, stateFromSnapshot(snapshot, maxBufferBytes));
  }

  function applyEvent(
    target: Pick<TerminalSessionTarget, "environmentId">,
    event: TerminalEvent,
  ): void {
    const targetKey = rememberTarget({
      environmentId: target.environmentId,
      threadId: event.threadId,
      terminalId: event.terminalId,
    });
    if (targetKey === null) {
      return;
    }

    const current = config.getRegistry().get(terminalSessionStateAtom(targetKey));
    switch (event.type) {
      case "started":
      case "restarted":
        setState(targetKey, stateFromSnapshot(event.snapshot, maxBufferBytes));
        return;
      case "output":
        setState(targetKey, {
          ...current,
          buffer: trimBufferToBytes(`${current.buffer}${event.data}`, maxBufferBytes),
          status: current.status === "closed" ? "running" : current.status,
          error: null,
          updatedAt: event.createdAt,
          version: current.version + 1,
        });
        return;
      case "cleared":
        setState(targetKey, {
          ...current,
          buffer: "",
          error: null,
          updatedAt: event.createdAt,
          version: current.version + 1,
        });
        return;
      case "exited":
        setState(targetKey, {
          ...current,
          snapshot: current.snapshot
            ? {
                ...current.snapshot,
                status: "exited",
                exitCode: event.exitCode,
                exitSignal: event.exitSignal,
                updatedAt: event.createdAt,
              }
            : null,
          status: "exited",
          hasRunningSubprocess: false,
          updatedAt: event.createdAt,
          version: current.version + 1,
        });
        return;
      case "closed":
        setState(targetKey, {
          ...current,
          snapshot: null,
          status: "closed",
          error: null,
          hasRunningSubprocess: false,
          updatedAt: event.createdAt,
          version: current.version + 1,
        });
        removeTargets(
          (knownTarget) =>
            knownTarget.environmentId === target.environmentId &&
            knownTarget.threadId === event.threadId &&
            knownTarget.terminalId === event.terminalId,
        );
        return;
      case "error":
        setState(targetKey, {
          ...current,
          status: "error",
          error: event.message,
          hasRunningSubprocess: false,
          updatedAt: event.createdAt,
          version: current.version + 1,
        });
        return;
      case "activity":
        setState(targetKey, {
          ...current,
          hasRunningSubprocess: event.hasRunningSubprocess,
          updatedAt: event.createdAt,
          version: current.version + 1,
        });
        return;
    }
  }

  function invalidate(target?: TerminalSessionTarget): void {
    if (target) {
      const targetKey = getTerminalSessionTargetKey(target);
      if (targetKey !== null) {
        setState(targetKey, EMPTY_TERMINAL_SESSION_STATE);
      }
      return;
    }

    for (const key of knownTerminalSessionKeys) {
      setState(key, EMPTY_TERMINAL_SESSION_STATE);
    }
  }

  function invalidateEnvironment(environmentId: string): void {
    const prefix = `${environmentId}:`;
    for (const key of knownTerminalSessionKeys) {
      if (key.startsWith(prefix)) {
        setState(key, EMPTY_TERMINAL_SESSION_STATE);
      }
    }
    removeTargets((target) => target.environmentId === environmentId);
  }

  function reset(): void {
    invalidate();
    config.getRegistry().set(knownTerminalSessionsAtom, {});
  }

  function listSessions(
    filter?: Partial<KnownTerminalSessionTarget>,
  ): ReadonlyArray<KnownTerminalSession> {
    const knownTargets = Object.values(config.getRegistry().get(knownTerminalSessionsAtom));
    return knownTargets
      .filter((target) => {
        if (filter?.environmentId && target.environmentId !== filter.environmentId) {
          return false;
        }
        if (filter?.threadId && target.threadId !== filter.threadId) {
          return false;
        }
        if (filter?.terminalId && target.terminalId !== filter.terminalId) {
          return false;
        }
        return true;
      })
      .map((target) => ({
        target,
        state: getSnapshot(target),
      }))
      .sort((left, right) => {
        const leftUpdatedAt = left.state.updatedAt ? Date.parse(left.state.updatedAt) : 0;
        const rightUpdatedAt = right.state.updatedAt ? Date.parse(right.state.updatedAt) : 0;
        if (leftUpdatedAt !== rightUpdatedAt) {
          return rightUpdatedAt - leftUpdatedAt;
        }
        return left.target.terminalId.localeCompare(right.target.terminalId);
      });
  }

  return {
    applyEvent,
    getSnapshot,
    invalidate,
    invalidateEnvironment,
    listSessions,
    syncSnapshot,
    reset,
  };
}
