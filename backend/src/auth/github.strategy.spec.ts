import { GithubStrategy } from './github.strategy';

const ghResponse = (status: number, data: unknown = []) =>
  ({
    ok: status >= 200 && status < 300,
    status,
    json: async () => data,
  }) as unknown as Response;

describe('GithubStrategy', () => {
  let fetchMock: jest.Mock;

  const makeStrategy = (upsertByGithub = jest.fn()) => {
    const strategy = new GithubStrategy({ upsertByGithub } as any);
    return { strategy, upsertByGithub };
  };

  beforeEach(() => {
    fetchMock = jest.fn().mockResolvedValue(
      ghResponse(200, [
        { email: 'octo@cat.dev', verified: true, primary: true },
        { email: 'Alt@Cat.dev', verified: true, primary: false },
        { email: 'unverified@cat.dev', verified: false, primary: false },
      ]),
    );
    global.fetch = fetchMock;
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('authorizationParams', () => {
    it('forwards login hint when provided', () => {
      const { strategy } = makeStrategy();
      expect(strategy.authorizationParams({ login: 'octocat' })).toEqual({
        login: 'octocat',
      });
    });

    it('forwards empty login to force account chooser', () => {
      const { strategy } = makeStrategy();
      expect(strategy.authorizationParams({ login: '' })).toEqual({
        login: '',
      });
    });

    it('returns empty params when login is not provided', () => {
      const { strategy } = makeStrategy();
      expect(strategy.authorizationParams({})).toEqual({});
    });
  });

  describe('scope', () => {
    it('inclui public_repo (escrita no repositório em nome do membro)', () => {
      const { strategy } = makeStrategy();
      // passport-github2 normaliza o scope para this._scope (array ou string)
      const scope = (strategy as any)._scope;
      const scopes = Array.isArray(scope)
        ? scope
        : String(scope).split(/[\s,]+/);
      expect(scopes).toContain('public_repo');
      expect(scopes).toContain('read:user');
      expect(scopes).toContain('user:email');
    });
  });

  describe('validate', () => {
    const profile = {
      id: '12345',
      username: 'octocat',
      displayName: 'Octo Cat',
      emails: [{ value: 'octo@cat.dev' }],
      photos: [{ value: 'https://avatars/octocat' }],
    } as any;

    it('propaga o accessToken como githubAccessToken no upsert', async () => {
      const upsertByGithub = jest.fn().mockResolvedValue({ id: 'member-1' });
      const { strategy } = makeStrategy(upsertByGithub);

      await strategy.validate('gho_token-abc', 'refresh-ignored', profile);

      expect(upsertByGithub).toHaveBeenCalledWith({
        githubId: '12345',
        githubHandle: 'octocat',
        name: 'Octo Cat',
        email: 'octo@cat.dev',
        avatarUrl: 'https://avatars/octocat',
        githubAccessToken: 'gho_token-abc',
        secondaryEmails: ['octo@cat.dev', 'alt@cat.dev'],
      });
      // só verificados, em lowercase
      expect(fetchMock).toHaveBeenCalledWith(
        'https://api.github.com/user/emails',
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer gho_token-abc',
          }),
        }),
      );
    });

    it('falha da API de e-mails NÃO quebra o login (secondaryEmails undefined)', async () => {
      fetchMock.mockRejectedValue(new Error('network down'));
      const upsertByGithub = jest.fn().mockResolvedValue({});
      const { strategy } = makeStrategy(upsertByGithub);

      await strategy.validate('gho_token-abc', '', profile);

      expect(upsertByGithub).toHaveBeenCalledWith(
        expect.objectContaining({ secondaryEmails: undefined }),
      );
    });

    it('HTTP não-ok da API de e-mails também não quebra o login', async () => {
      fetchMock.mockResolvedValue(ghResponse(403, { message: 'Forbidden' }));
      const upsertByGithub = jest.fn().mockResolvedValue({});
      const { strategy } = makeStrategy(upsertByGithub);

      await strategy.validate('gho_token-abc', '', profile);

      expect(upsertByGithub).toHaveBeenCalledWith(
        expect.objectContaining({ secondaryEmails: undefined }),
      );
    });

    it('fallbacks de perfil (sem e-mail/nome/foto)', async () => {
      const upsertByGithub = jest.fn().mockResolvedValue({});
      const { strategy } = makeStrategy(upsertByGithub);

      await strategy.validate('gho_t', '', {
        id: '9',
        username: 'ghost',
        displayName: '',
      } as any);

      expect(upsertByGithub).toHaveBeenCalledWith(
        expect.objectContaining({
          email: 'ghost@github.com',
          name: 'ghost',
          avatarUrl: '',
          githubAccessToken: 'gho_t',
        }),
      );
    });
  });
});
