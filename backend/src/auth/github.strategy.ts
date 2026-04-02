import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, Profile } from 'passport-github2';
import { MembersService } from '../members/members.service';

@Injectable()
export class GithubStrategy extends PassportStrategy(Strategy, 'github') {
  constructor(private readonly membersService: MembersService) {
    super({
      clientID: process.env.GITHUB_CLIENT_ID ?? 'dev-client-id',
      clientSecret: process.env.GITHUB_CLIENT_SECRET ?? 'dev-client-secret',
      callbackURL: `${process.env.BACKEND_URL ?? 'http://localhost:3001'}/auth/github/callback`,
      scope: ['read:user', 'user:email'],
    });
  }

  async validate(
    _accessToken: string,
    _refreshToken: string,
    profile: Profile,
  ) {
    const email =
      (profile.emails?.[0]?.value) ?? `${profile.username ?? 'user'}@github.com`;

    return this.membersService.upsertByGithub({
      githubId: profile.id,
      githubHandle: profile.username ?? '',
      name: profile.displayName || (profile.username ?? ''),
      email,
      avatarUrl: profile.photos?.[0]?.value ?? '',
    });
  }
}
