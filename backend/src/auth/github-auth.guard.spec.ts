import { ExecutionContext } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';
import {
  GithubAuthGuard,
  STATE_TTL_SECONDS,
} from './github-auth.guard';

describe('GithubAuthGuard', () => {
  let jwtService: { sign: jest.Mock };
  let guard: GithubAuthGuard;

  const buildContext = (query: Record<string, unknown>): ExecutionContext =>
    ({
      switchToHttp: () => ({
        getRequest: () => ({ query }) as unknown as Request,
      }),
    }) as unknown as ExecutionContext;

  beforeEach(() => {
    jwtService = { sign: jest.fn().mockReturnValue('signed-state-jwt') };
    guard = new GithubAuthGuard(jwtService as unknown as JwtService);
  });

  it('encodes returnTo into a signed state with a 5-minute TTL', () => {
    const opts = guard.getAuthenticateOptions(
      buildContext({ returnTo: 'https://tisocial.org.br/apoiar' }),
    );

    expect(jwtService.sign).toHaveBeenCalledWith(
      { returnTo: 'https://tisocial.org.br/apoiar' },
      { expiresIn: STATE_TTL_SECONDS },
    );
    expect(STATE_TTL_SECONDS).toBe(5 * 60);
    expect(opts.state).toBe('signed-state-jwt');
  });

  it('signs returnTo=null when the query param is absent', () => {
    const opts = guard.getAuthenticateOptions(buildContext({}));

    expect(jwtService.sign).toHaveBeenCalledWith(
      { returnTo: null },
      { expiresIn: STATE_TTL_SECONDS },
    );
    expect(opts.state).toBe('signed-state-jwt');
    expect('login' in opts).toBe(false);
  });

  it('forwards a login hint to pre-select the GitHub account', () => {
    const opts = guard.getAuthenticateOptions(
      buildContext({ login: 'octocat' }),
    ) as { login?: string };

    expect(opts.login).toBe('octocat');
  });

  it('forwards an empty login hint to force the account chooser', () => {
    const opts = guard.getAuthenticateOptions(buildContext({ login: '' })) as {
      login?: string;
    };

    expect(opts.login).toBe('');
  });

  it('combines returnTo and login hint in the same request', () => {
    const opts = guard.getAuthenticateOptions(
      buildContext({ returnTo: 'https://codaqui.dev/admin', login: 'octocat' }),
    ) as { state?: string; login?: string };

    expect(jwtService.sign).toHaveBeenCalledWith(
      { returnTo: 'https://codaqui.dev/admin' },
      { expiresIn: STATE_TTL_SECONDS },
    );
    expect(opts.state).toBe('signed-state-jwt');
    expect(opts.login).toBe('octocat');
  });
});
