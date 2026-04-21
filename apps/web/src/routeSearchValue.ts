function tryParseJsonString(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

export function normalizeRouteSearchString(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const normalized = value.trim();
  if (normalized.length === 0) {
    return undefined;
  }

  const parsed = tryParseJsonString(normalized);
  if (typeof parsed !== "string") {
    return normalized;
  }

  const unwrapped = parsed.trim();
  return unwrapped.length > 0 ? unwrapped : undefined;
}

export function isRouteSearchToggleEnabled(value: unknown): boolean {
  if (value === "1" || value === 1 || value === true) {
    return true;
  }

  if (typeof value !== "string") {
    return false;
  }

  const parsed = tryParseJsonString(value.trim());
  return parsed === "1" || parsed === 1 || parsed === true;
}
