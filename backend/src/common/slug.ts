export function slugify(value: string): string {
  let slug = '';
  let pendingSeparator = false;
  for (const character of value) {
    const code = character.codePointAt(0)!;
    const isLowercaseLetter = code >= 97 && code <= 122;
    const isDigit = code >= 48 && code <= 57;
    if (!isLowercaseLetter && !isDigit) {
      pendingSeparator = true;
      continue;
    }
    if (pendingSeparator && slug) slug += '-';
    slug += character;
    pendingSeparator = false;
  }
  return slug;
}
