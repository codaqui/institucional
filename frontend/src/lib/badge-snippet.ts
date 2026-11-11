import { MEMBER_HANDLE_REGEX } from "./member-path";

export function buildBadgeSnippets(
  origin: string,
  githubHandle: string,
): { markdown: string; html: string } {
  if (!MEMBER_HANDLE_REGEX.test(githubHandle)) {
    throw new Error("Handle GitHub inválido.");
  }
  const baseUrl = origin.replace(/\/+$/, "");
  const profileUrl = `${baseUrl}/@${githubHandle}`;
  const badgeUrl = `${baseUrl}/badges/${githubHandle}.svg`;
  return {
    markdown: `[![Selo Codaqui](${badgeUrl})](${profileUrl})`,
    html: `<a href="${profileUrl}"><img src="${badgeUrl}" alt="Selo Codaqui"></a>`,
  };
}
