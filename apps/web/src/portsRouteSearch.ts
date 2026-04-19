export interface PortsRouteSearch {
  ports?: "1" | undefined;
}

function isPortsOpenValue(value: unknown): boolean {
  return value === "1" || value === 1 || value === true;
}

export function stripPortsSearchParams<T extends Record<string, unknown>>(
  params: T,
): Omit<T, "ports"> {
  const { ports: _ports, ...rest } = params;
  return rest as Omit<T, "ports">;
}

export function parsePortsRouteSearch(search: Record<string, unknown>): PortsRouteSearch {
  const ports = isPortsOpenValue(search.ports) ? "1" : undefined;
  return ports ? { ports } : {};
}
