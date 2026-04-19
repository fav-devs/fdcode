import { useAtomValue } from "@effect/atom-react";
import type { PortForward, PortForwardMetadataStreamEvent } from "@t3tools/contracts";
import { Atom } from "effect/unstable/reactivity";
import type { WsRpcClient } from "@t3tools/client-runtime";
import { appAtomRegistry } from "./atomRegistry";

function makeStateAtom<A>(label: string, initialValue: A) {
  return Atom.make(initialValue).pipe(Atom.keepAlive, Atom.withLabel(label));
}

export const portForwardsAtom = makeStateAtom<ReadonlyArray<PortForward>>("port-forwards", []);

function applyPortForwardEvent(event: PortForwardMetadataStreamEvent): void {
  switch (event.type) {
    case "snapshot":
      appAtomRegistry.set(portForwardsAtom, event.forwards);
      return;
    case "upsert": {
      const current = appAtomRegistry.get(portForwardsAtom);
      const exists = current.some((f) => f.id === event.forward.id);
      appAtomRegistry.set(
        portForwardsAtom,
        exists
          ? current.map((f) => (f.id === event.forward.id ? event.forward : f))
          : [...current, event.forward],
      );
      return;
    }
    case "remove":
      appAtomRegistry.set(
        portForwardsAtom,
        appAtomRegistry.get(portForwardsAtom).filter((f) => f.id !== event.forwardId),
      );
      return;
  }
}

export function startPortsStateSync(options: { client: Pick<WsRpcClient, "ports"> }): () => void {
  return options.client.ports.onForwards((event) => {
    applyPortForwardEvent(event);
  });
}

export function usePortForwards(): ReadonlyArray<PortForward> {
  return useAtomValue(portForwardsAtom);
}
