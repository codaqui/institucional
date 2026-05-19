import { GithubStrategy } from './github.strategy';

describe('GithubStrategy', () => {
  const makeStrategy = () =>
    new GithubStrategy({
      upsertByGithub: jest.fn(),
    } as any);

  describe('authorizationParams', () => {
    it('forwards login hint when provided', () => {
      const strategy = makeStrategy();
      expect(strategy.authorizationParams({ login: 'octocat' })).toEqual({
        login: 'octocat',
      });
    });

    it('forwards empty login to force account chooser', () => {
      const strategy = makeStrategy();
      expect(strategy.authorizationParams({ login: '' })).toEqual({
        login: '',
      });
    });

    it('returns empty params when login is not provided', () => {
      const strategy = makeStrategy();
      expect(strategy.authorizationParams({})).toEqual({});
    });
  });
});
