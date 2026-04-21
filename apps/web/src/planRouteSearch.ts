import { isRouteSearchToggleEnabled } from "./routeSearchValue";

export interface PlanRouteSearch {
  plan?: "1" | undefined;
}

function isPlanOpenValue(value: unknown): boolean {
  return isRouteSearchToggleEnabled(value);
}

export function stripPlanSearchParams<T extends Record<string, unknown>>(
  params: T,
): Omit<T, "plan"> {
  const { plan: _plan, ...rest } = params;
  return rest as Omit<T, "plan">;
}

export function parsePlanRouteSearch(search: Record<string, unknown>): PlanRouteSearch {
  const plan = isPlanOpenValue(search.plan) ? "1" : undefined;
  return plan ? { plan } : {};
}
