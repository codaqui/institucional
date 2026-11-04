export function isSafeCommunityUrl(value: unknown): value is string {
  if (
    typeof value !== 'string' ||
    value.length === 0 ||
    /[\\\u0000-\u001f\u007f]/.test(value)
  ) {
    return false;
  }

  const base = 'https://codaqui.dev';
  try {
    if (value.startsWith('//')) return false;
    if (value.startsWith('/')) {
      return new URL(value, base).origin === base;
    }
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
    (Array.isArray(entries) &&
      entries.every(
        (entry) =>
          entry !== null &&
          typeof entry === 'object' &&
          !Array.isArray(entry) &&
          isSafeCommunityUrl(entry.url),
      ))
  );
}
