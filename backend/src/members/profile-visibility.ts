import { BadRequestException } from '@nestjs/common';
import type { Member } from './entities/member.entity';

export const PROFILE_VISIBILITY_KEYS = [
  'bio',
  'linkedin',
  'roles',
  'memberSince',
  'events',
  'certificates',
  'hours',
  'donations',
  'sortcoins',
  'designations',
] as const;

export type ProfileVisibilityKey = (typeof PROFILE_VISIBILITY_KEYS)[number];
export type ProfileVisibility = Record<ProfileVisibilityKey, boolean>;
export type PublicMember = Omit<Member, 'joinedAt' | 'email'> & {
  joinedAt?: Date;
  email?: never;
};

export const DEFAULT_PROFILE_VISIBILITY: ProfileVisibility = {
  bio: true,
  linkedin: true,
  roles: true,
  memberSince: true,
  events: true,
  certificates: true,
  hours: true,
  donations: true,
  sortcoins: false,
  designations: true,
};

export const PROFILE_VISIBILITY_FIELDS = [
  { key: 'bio', label: 'Bio', source: 'Perfil do membro', purpose: 'Apresentação pública' },
  { key: 'linkedin', label: 'LinkedIn', source: 'Perfil do membro', purpose: 'Link profissional público' },
  { key: 'roles', label: 'Papéis', source: 'RBAC e designations', purpose: 'Representações institucionais' },
  { key: 'memberSince', label: 'Membro desde', source: 'Data de entrada', purpose: 'Histórico da associação' },
  { key: 'events', label: 'Eventos', source: 'Inscrições e check-ins', purpose: 'Histórico de participação' },
  { key: 'certificates', label: 'Certificados', source: 'Emissões por presença', purpose: 'Comprovação de participação' },
  { key: 'hours', label: 'Horas', source: 'Aprovações de horas', purpose: 'Total de contribuição' },
  { key: 'donations', label: 'Doações', source: 'Ledger financeiro', purpose: 'Histórico de apoio opt-in' },
  { key: 'sortcoins', label: 'SortCoins', source: 'Clube Codaqui', purpose: 'Saldo e histórico opt-in' },
  { key: 'designations', label: 'Designations', source: 'Vínculos ativos', purpose: 'Representações institucionais' },
] as const;

export function resolveProfileVisibility(input: unknown): ProfileVisibility {
  if (input == null) return { ...DEFAULT_PROFILE_VISIBILITY };
  if (typeof input !== 'object' || Array.isArray(input)) {
    throw new BadRequestException('Visibilidade deve ser um objeto com chaves booleanas.');
  }
  const values = input as Record<string, unknown>;
  for (const [key, value] of Object.entries(values)) {
    if (!PROFILE_VISIBILITY_KEYS.includes(key as ProfileVisibilityKey)) {
      throw new BadRequestException(`Chave de visibilidade desconhecida: ${key}`);
    }
    if (typeof value !== 'boolean') {
      throw new BadRequestException(`Visibilidade de ${key} deve ser booleana.`);
    }
  }
  return { ...DEFAULT_PROFILE_VISIBILITY, ...values } as ProfileVisibility;
}

export function applyProfileVisibility(member: Member): PublicMember {
  const visibility = resolveProfileVisibility(member.profileVisibility);
  const { email: _email, ...publicMember } = member;
  return {
    ...publicMember,
    bio: visibility.bio ? member.bio : null,
    linkedinUrl: visibility.linkedin ? member.linkedinUrl : null,
    roles: visibility.roles ? member.roles : [],
    joinedAt: visibility.memberSince ? member.joinedAt : undefined,
  };
}
