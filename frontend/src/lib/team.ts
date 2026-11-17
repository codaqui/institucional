import type { Member } from "../data/team";
import type { PublicMemberProfile } from "./member-path";

export interface EnrichedTeamMember extends Member {
  profilePath?: string;
}

export function githubHandleFromUrl(url?: string): string | undefined {
  if (!url) return undefined;

  try {
    const parsed = new URL(url);
    const match = /^\/([a-zA-Z0-9-]+)\/?$/.exec(parsed.pathname);
    if (
      parsed.protocol !== "https:" ||
      parsed.hostname !== "github.com" ||
      parsed.username ||
      parsed.password ||
      parsed.search ||
      parsed.hash ||
      !match
    ) {
      return undefined;
    }
    return match[1];
  } catch {
    return undefined;
  }
}

function findPublicMember(
  handle: string,
  publicMembers: PublicMemberProfile[],
): PublicMemberProfile | undefined {
  const normalized = handle.trim().toLowerCase();
  return publicMembers.find(
    (candidate) => candidate.githubHandle.trim().toLowerCase() === normalized,
  );
}

export function publicProfilePathForHandle(
  handle: string,
  publicMembers: PublicMemberProfile[],
): string | undefined {
  const member = findPublicMember(handle, publicMembers);
  return member ? `/@${member.githubHandle}` : undefined;
}

export function enrichTeamMember(
  local: Member,
  publicMembers: PublicMemberProfile[],
): EnrichedTeamMember {
  const handle = githubHandleFromUrl(local.github);
  if (!handle) return local;

  const publicMember = findPublicMember(handle, publicMembers);
  if (!publicMember) return local;

  return {
    ...local,
    name: publicMember.name,
    avatar: publicMember.avatarUrl,
    linkedin: publicMember.linkedinUrl ?? local.linkedin,
    github: `https://github.com/${publicMember.githubHandle}`,
    profilePath: `/@${publicMember.githubHandle}`,
  };
}
