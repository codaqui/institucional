import { Injectable, Logger } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, Profile } from 'passport-github2';
import { MembersService } from '../members/members.service';

@Injectable()
export class GithubStrategy extends PassportStrategy(Strategy, 'github') {
  private readonly logger = new Logger(GithubStrategy.name);

  constructor(private readonly membersService: MembersService) {
    super({
      clientID: process.env.GITHUB_CLIENT_ID ?? 'dev-client-id',
      clientSecret: process.env.GITHUB_CLIENT_SECRET ?? 'dev-client-secret',
      callbackURL: `${process.env.BACKEND_URL ?? 'http://localhost:3001'}/auth/github/callback`,
      // public_repo: necessário para escrever no repositório em nome do
      // membro (GitHub-as-Database — overrides/organizers via PR). O novo
      // consentimento aparece automaticamente no próximo login de cada usuário.
      scope: ['read:user', 'user:email', 'public_repo'],
    });
  }

  authorizationParams(options: { login?: string }): Record<string, string> {
    if (options.login === undefined) {
      return {};
    }
    return { login: options.login };
  }

  async validate(accessToken: string, _refreshToken: string, profile: Profile) {
    const email =
      profile.emails?.[0]?.value ?? `${profile.username ?? 'user'}@github.com`;

    return this.membersService.upsertByGithub({
      githubId: profile.id,
      githubHandle: profile.username ?? '',
      name: profile.displayName || (profile.username ?? ''),
      email,
      avatarUrl: profile.photos?.[0]?.value ?? '',
      githubAccessToken: accessToken,
      secondaryEmails: await this.fetchVerifiedEmails(accessToken),
    });
  }

  /**
   * Todos os e-mails VERIFICADOS da conta GitHub (scope user:email) — usados
   * no match de participantes importados via CSV. Falha da API NUNCA quebra
   * o login (warn + undefined → mantém os e-mails já gravados).
   */
  private async fetchVerifiedEmails(
    accessToken: string,
  ): Promise<string[] | undefined> {
    try {
      const res = await fetch('https://api.github.com/user/emails', {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28',
        },
      });
      if (!res.ok) {
        this.logger.warn(
          `Falha ao buscar e-mails do GitHub (HTTP ${res.status}) — login segue sem atualizar secondaryEmails`,
        );
        return undefined;
      }
      const emails = (await res.json()) as Array<{
        email: string;
        verified: boolean;
      }>;
      if (!Array.isArray(emails)) return undefined;
      return emails.filter((e) => e.verified).map((e) => e.email.toLowerCase());
    } catch (error) {
      this.logger.warn(
        `Erro ao buscar e-mails do GitHub: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      return undefined;
    }
  }
}
