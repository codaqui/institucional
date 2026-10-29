/** Formato aceito de handle de membro (GitHub handle). */
export const MEMBER_HANDLE_REGEX = /^[a-zA-Z0-9_-]+$/;

/** Perfil público de membro, tal como exposto pela API pública (`/members`). */
export interface PublicMemberProfile {
  id: string;
  githubHandle: string;
  name: string;
  avatarUrl: string;
  bio: string | null;
  linkedinUrl: string | null;
  roles: string[];
  joinedAt: string;
}

/** Path estático da vanity URL de um membro (`/@<handle>`). */
export function buildMemberPath(handle: string): string {
  return `/@${handle}`;
}

export interface MemberJsonLd {
  "@context": "https://schema.org";
  "@type": "Person";
  name: string;
  url: string;
  image: string;
  description?: string;
  sameAs: string[];
}

/** Monta o JSON-LD (schema.org/Person) da página estática de perfil. */
export function buildMemberJsonLd(
  member: PublicMemberProfile,
  absoluteUrl: string
): MemberJsonLd {
  return {
    "@context": "https://schema.org",
    "@type": "Person",
    name: member.name,
    url: absoluteUrl,
    image: member.avatarUrl,
    ...(member.bio ? { description: member.bio } : {}),
    sameAs: [
      `https://github.com/${member.githubHandle}`,
      ...(member.linkedinUrl ? [member.linkedinUrl] : []),
    ],
  };
}

/**
 * Trunca a bio para uso em meta description (~160 chars); sem bio, cai em
 * um fallback com o nome do membro.
 */
export function truncateMemberBio(
  bio: string | null | undefined,
  fallback: string,
  maxLength = 160
): string {
  if (!bio) return fallback;
  const normalized = bio.replace(/\s+/g, " ").trim();
  if (!normalized) return fallback;
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, maxLength - 1).trimEnd()}…`;
}

/** Fallback padrão de description quando o membro não tem bio. */
export function defaultMemberBioFallback(name: string): string {
  return `Perfil de ${name} na Associação Codaqui.`;
}
