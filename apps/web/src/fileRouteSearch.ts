import { isRouteSearchToggleEnabled, normalizeRouteSearchString } from "./routeSearchValue";

export interface FileRouteSearch {
  files?: "1" | undefined;
  filesPath?: string | undefined;
}

function isFilesOpenValue(value: unknown): boolean {
  return isRouteSearchToggleEnabled(value);
}

export function stripFileSearchParams<T extends Record<string, unknown>>(
  params: T,
): Omit<T, "files" | "filesPath"> {
  const { files: _files, filesPath: _filesPath, ...rest } = params;
  return rest as Omit<T, "files" | "filesPath">;
}

export function parseFileRouteSearch(search: Record<string, unknown>): FileRouteSearch {
  const files = isFilesOpenValue(search.files) ? "1" : undefined;
  const filesPath = files ? normalizeRouteSearchString(search.filesPath) : undefined;
  return {
    ...(files ? { files } : {}),
    ...(filesPath ? { filesPath } : {}),
  };
}
