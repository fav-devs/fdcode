import {
  parseDiffRouteSearch,
  stripDiffSearchParams,
  type DiffRouteSearch,
} from "./diffRouteSearch";
import {
  parseFileRouteSearch,
  stripFileSearchParams,
  type FileRouteSearch,
} from "./fileRouteSearch";
import {
  parsePlanRouteSearch,
  stripPlanSearchParams,
  type PlanRouteSearch,
} from "./planRouteSearch";
import {
  parsePortsRouteSearch,
  stripPortsSearchParams,
  type PortsRouteSearch,
} from "./portsRouteSearch";

export type ThreadRouteSearch = DiffRouteSearch &
  FileRouteSearch &
  PortsRouteSearch &
  PlanRouteSearch;

export function parseThreadRouteSearch(search: Record<string, unknown>): ThreadRouteSearch {
  return {
    ...parseDiffRouteSearch(search),
    ...parseFileRouteSearch(search),
    ...parsePortsRouteSearch(search),
    ...parsePlanRouteSearch(search),
  };
}

export function stripThreadPanelSearchParams<T extends Record<string, unknown>>(
  params: T,
): Omit<T, "diff" | "diffTurnId" | "diffFilePath" | "files" | "filesPath" | "ports" | "plan"> {
  return stripPlanSearchParams(
    stripPortsSearchParams(stripFileSearchParams(stripDiffSearchParams(params))),
  ) as Omit<T, "diff" | "diffTurnId" | "diffFilePath" | "files" | "filesPath" | "ports" | "plan">;
}
