import { BadRequestException } from '@nestjs/common';
import {
  DEFAULT_PROFILE_VISIBILITY,
  PROFILE_VISIBILITY_KEYS,
  applyProfileVisibility,
  resolveProfileVisibility,
} from './profile-visibility';
import { MemberRole } from './entities/member.entity';

describe('profile visibility', () => {
  it('preserves current public defaults and never exposes email as a visibility key', () => {
    expect(DEFAULT_PROFILE_VISIBILITY.bio).toBe(true);
    expect(DEFAULT_PROFILE_VISIBILITY.linkedin).toBe(true);
    expect(DEFAULT_PROFILE_VISIBILITY.sortcoins).toBe(true);
    expect(PROFILE_VISIBILITY_KEYS).not.toContain('email');
  });

  it('merges only known boolean keys', () => {
    expect(resolveProfileVisibility({ bio: false, sortcoins: true })).toEqual({
      ...DEFAULT_PROFILE_VISIBILITY,
      bio: false,
      sortcoins: true,
    });
  });

  it('rejects unknown keys and non-boolean values', () => {
    expect(() => resolveProfileVisibility({ email: false })).toThrow(
      BadRequestException,
    );
    expect(() => resolveProfileVisibility({ bio: 'false' })).toThrow(
      BadRequestException,
    );
  });

  it('removes hidden fields from the public member payload', () => {
    const member = {
      id: 'member-1',
      githubId: '1',
      githubHandle: 'octocat',
      name: 'Monalisa',
      email: 'private@example.test',
      avatarUrl: 'avatar',
      bio: 'Bio pública',
      linkedinUrl: 'https://linkedin.example',
      roles: [MemberRole.ADMIN],
      isActive: true,
      eventCommsOptIn: false,
      githubAccessToken: null,
      secondaryEmails: [],
      joinedAt: new Date('2024-01-01'),
      profileVisibility: { bio: false, linkedin: false, roles: false, memberSince: false },
    };

    const result = applyProfileVisibility(member);

    expect(result).not.toHaveProperty('bio');
    expect(result).not.toHaveProperty('linkedinUrl');
    expect(result).not.toHaveProperty('roles');
    expect(result).not.toHaveProperty('joinedAt');
    expect(result).not.toHaveProperty('email');
    expect(result).not.toHaveProperty('profileVisibility');
    expect(result).not.toHaveProperty('githubAccessToken');
    expect(result).not.toHaveProperty('secondaryEmails');
  });
});
