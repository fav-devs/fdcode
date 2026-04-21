import type {
  EnvironmentId,
  ProjectSearchEntriesResult,
  ProjectSearchLocalEntriesResult,
} from "@t3tools/contracts";
import { queryOptions } from "@tanstack/react-query";
import { ensureEnvironmentApi } from "~/environmentApi";

export const projectQueryKeys = {
  all: ["projects"] as const,
  searchEntries: (
    environmentId: EnvironmentId | null,
    cwd: string | null,
    query: string,
    limit: number,
  ) => ["projects", "search-entries", environmentId ?? null, cwd, query, limit] as const,
  searchLocalEntries: (
    environmentId: EnvironmentId | null,
    rootPath: string | null,
    query: string,
    limit: number,
    includeFiles: boolean,
  ) =>
    [
      "projects",
      "search-local-entries",
      environmentId ?? null,
      rootPath,
      query,
      limit,
      includeFiles,
    ] as const,
};

const DEFAULT_SEARCH_ENTRIES_LIMIT = 80;
const DEFAULT_SEARCH_ENTRIES_STALE_TIME = 15_000;
const EMPTY_SEARCH_ENTRIES_RESULT: ProjectSearchEntriesResult = {
  entries: [],
  truncated: false,
};

const DEFAULT_SEARCH_LOCAL_ENTRIES_LIMIT = 50;
const DEFAULT_SEARCH_LOCAL_ENTRIES_STALE_TIME = 10_000;
const EMPTY_SEARCH_LOCAL_ENTRIES_RESULT: ProjectSearchLocalEntriesResult = {
  entries: [],
  truncated: false,
};

export function projectSearchEntriesQueryOptions(input: {
  environmentId: EnvironmentId | null;
  cwd: string | null;
  query: string;
  enabled?: boolean;
  limit?: number;
  staleTime?: number;
}) {
  const limit = input.limit ?? DEFAULT_SEARCH_ENTRIES_LIMIT;
  return queryOptions({
    queryKey: projectQueryKeys.searchEntries(input.environmentId, input.cwd, input.query, limit),
    queryFn: async () => {
      if (!input.cwd || !input.environmentId) {
        throw new Error("Workspace entry search is unavailable.");
      }
      const api = ensureEnvironmentApi(input.environmentId);
      return api.projects.searchEntries({
        cwd: input.cwd,
        query: input.query,
        limit,
      });
    },
    enabled:
      (input.enabled ?? true) &&
      input.environmentId !== null &&
      input.cwd !== null &&
      input.query.length > 0,
    staleTime: input.staleTime ?? DEFAULT_SEARCH_ENTRIES_STALE_TIME,
    placeholderData: (previous) => previous ?? EMPTY_SEARCH_ENTRIES_RESULT,
  });
}

export function projectSearchLocalEntriesQueryOptions(input: {
  environmentId: EnvironmentId | null;
  rootPath: string | null;
  query: string;
  enabled?: boolean;
  limit?: number;
  includeFiles?: boolean;
}) {
  const limit = input.limit ?? DEFAULT_SEARCH_LOCAL_ENTRIES_LIMIT;
  const includeFiles = input.includeFiles ?? false;
  return queryOptions({
    queryKey: projectQueryKeys.searchLocalEntries(
      input.environmentId,
      input.rootPath,
      input.query,
      limit,
      includeFiles,
    ),
    queryFn: async () => {
      if (!input.rootPath || !input.environmentId) {
        throw new Error("Local entry search is unavailable.");
      }
      const api = ensureEnvironmentApi(input.environmentId);
      return api.projects.searchLocalEntries({
        rootPath: input.rootPath,
        query: input.query,
        limit,
        includeFiles,
      });
    },
    enabled:
      (input.enabled ?? true) &&
      input.environmentId !== null &&
      input.rootPath !== null &&
      input.query.length >= 2,
    staleTime: DEFAULT_SEARCH_LOCAL_ENTRIES_STALE_TIME,
    placeholderData: (previous) => previous ?? EMPTY_SEARCH_LOCAL_ENTRIES_RESULT,
  });
}
