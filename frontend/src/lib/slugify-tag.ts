export function slugifyTag(tag: string): string {
  return tag
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/([a-z])(\d)/g, "$1-$2")
    .replace(/(\d)([a-z])/g, "$1-$2")
    .replace(/[^a-z\d]+/g, "-")
    .replace(/^-+/, "")
    .replace(/-+$/, "");
}
