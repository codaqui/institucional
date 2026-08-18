import type { CodaquiMember } from "../hooks/useCodaquiMembers";
import type { RfcPersonRef } from "../data/rfc-schema";

export function findMember(
  ref: RfcPersonRef,
  members: CodaquiMember[]
): CodaquiMember | undefined {
  const handle = ref.githubHandle?.trim();
  const name = ref.name?.trim();

  if (handle) {
    const byHandle = members.find(
      (m) => m.githubHandle?.toLowerCase() === handle.toLowerCase()
    );
    if (byHandle) return byHandle;
  }

  if (name) {
    const byName = members.find(
      (m) => m.name?.toLowerCase().trim() === name.toLowerCase()
    );
    if (byName) return byName;
  }

  return undefined;
}

export function displayName(ref: RfcPersonRef, member?: CodaquiMember): string {
  return member?.name ?? ref.name ?? ref.email ?? "—";
}

export function displayAvatar(
  ref: RfcPersonRef,
  member?: CodaquiMember
): string {
  return member?.avatarUrl ?? `https://github.com/${ref.githubHandle ?? "ghost"}.png`;
}
