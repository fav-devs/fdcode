export function extendReplacementRangeForTrailingSpace(
  text: string,
  rangeEnd: number,
  replacement: string,
): number {
  if (!replacement.endsWith(" ")) {
    return rangeEnd;
  }
  return text[rangeEnd] === " " ? rangeEnd + 1 : rangeEnd;
}

export function ensureLeadingSpaceForReplacement(
  text: string,
  rangeStart: number,
  replacement: string,
): string {
  if (replacement.length === 0) return replacement;
  if (rangeStart === 0) return replacement;
  const precedingChar = text[rangeStart - 1];
  if (!precedingChar || /\s/.test(precedingChar)) return replacement;
  return ` ${replacement}`;
}
