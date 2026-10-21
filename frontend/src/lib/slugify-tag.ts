export function slugifyTag(tag: string): string {
  return tag
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/([a-z])([0-9])/g, "$1-$2")
    .replace(/([0-9])([a-z])/g, "$1-$2")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
