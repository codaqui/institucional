export function isSafeCommunityUrl(value: unknown): value is string {
  if (typeof value !== 'string' || value.length === 0) return false;
  if (value.startsWith('/')) return !value.startsWith('//');
  try {
    return new URL(value).protocol === 'https:';
  } catch {
    return false;
  }
}

export function hasOnlySafeCommunityUrls(
  entries: Record<string, unknown>[] | undefined,
): boolean {
  return (
    entries === undefined ||
    entries.every(
      (entry) =>
        entry !== null &&
        typeof entry === 'object' &&
        !Array.isArray(entry) &&
        isSafeCommunityUrl(entry.url),
    )
  );
}
