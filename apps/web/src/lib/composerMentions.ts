export function createComposerMentionTokenRegex(options: {
  includeTrailingTokenAtEnd: boolean;
  global?: boolean;
}): RegExp {
  const suffix = options.includeTrailingTokenAtEnd ? "(?=\\s|$)" : "(?=\\s)";
  return new RegExp(
    `(^|\\s)@(?:"([^"]+)"|([^\\s@]+))${suffix}`,
    options.global === false ? "" : "g",
  );
}

export function extractComposerMentionPath(match: RegExpExecArray | RegExpMatchArray): string {
  return (match[2] ?? match[3] ?? "").trim();
}

export function formatComposerMentionToken(path: string): string {
  const normalizedPath = path.startsWith("@") ? path.slice(1) : path;
  return /\s/.test(normalizedPath) ? `@"${normalizedPath}"` : `@${normalizedPath}`;
}
