import {
  isAllowedOrigin,
  resolveReturnUrl,
  resolveOrigin,
} from './allowed-origins';
import {
  ALLOWED_ORIGINS_DEV,
  ALLOWED_ORIGINS_PROD,
} from './allowed-origins.config';

describe('allowed-origins', () => {
  const originalNodeEnv = process.env.NODE_ENV;

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
  });

  describe('isAllowedOrigin', () => {
    it('accepts every production origin with exact match', () => {
      for (const origin of ALLOWED_ORIGINS_PROD) {
        expect(isAllowedOrigin(origin)).toBe(true);
      }
    });

    it('accepts a full URL whose origin is whitelisted (path/query ignored)', () => {
      expect(isAllowedOrigin('https://codaqui.dev/eventos?foo=bar')).toBe(true);
      expect(isAllowedOrigin('https://tisocial.org.br/comunidades/x#y')).toBe(
        true,
      );
    });

    it('accepts dev origins when NODE_ENV is not production', () => {
      process.env.NODE_ENV = 'test';
      for (const origin of ALLOWED_ORIGINS_DEV) {
        expect(isAllowedOrigin(origin)).toBe(true);
      }
    });

    it('rejects dev origins in production', () => {
      process.env.NODE_ENV = 'production';
      expect(isAllowedOrigin('http://localhost:3000')).toBe(false);
      expect(isAllowedOrigin('http://tisocial.localhost:8787')).toBe(false);
    });

    it('rejects subdomains of allowed hosts (no wildcard matching)', () => {
      expect(isAllowedOrigin('https://evil.codaqui.dev')).toBe(false);
      expect(isAllowedOrigin('https://www.tisocial.org.br')).toBe(false);
    });

    it('rejects look-alike hosts and wrong schemes/ports', () => {
      expect(isAllowedOrigin('https://codaqui.dev.evil.com')).toBe(false);
      expect(isAllowedOrigin('https://codaquidev.com')).toBe(false);
      expect(isAllowedOrigin('http://codaqui.dev')).toBe(false);
      expect(isAllowedOrigin('https://codaqui.dev:8443')).toBe(false);
    });

    it('rejects empty, malformed and non-URL candidates', () => {
      expect(isAllowedOrigin('')).toBe(false);
      expect(isAllowedOrigin('not a url')).toBe(false);
      expect(isAllowedOrigin('javascript:alert(1)')).toBe(false);
      expect(isAllowedOrigin('//codaqui.dev')).toBe(false);
    });
  });

  describe('resolveReturnUrl', () => {
    it('returns the candidate when its origin is allowed', () => {
      process.env.NODE_ENV = 'production';
      expect(resolveReturnUrl('https://tisocial.org.br/apoiar?x=1')).toBe(
        'https://tisocial.org.br/apoiar?x=1',
      );
    });

    it('falls back to the default origin when candidate is missing', () => {
      process.env.NODE_ENV = 'production';
      expect(resolveReturnUrl(undefined)).toBe('https://codaqui.dev/');
      expect(resolveReturnUrl(undefined, '/participe/apoiar')).toBe(
        'https://codaqui.dev/participe/apoiar',
      );
    });

    it('falls back when the candidate origin is not allowed', () => {
      process.env.NODE_ENV = 'production';
      expect(resolveReturnUrl('https://evil.com/phish')).toBe(
        'https://codaqui.dev/',
      );
      expect(
        resolveReturnUrl('https://evil.com/phish', '/auth/callback'),
      ).toBe('https://codaqui.dev/auth/callback');
    });

    it('falls back when the candidate is not a valid URL', () => {
      process.env.NODE_ENV = 'production';
      expect(resolveReturnUrl('::::')).toBe('https://codaqui.dev/');
    });

    it('uses localhost as default origin outside production', () => {
      process.env.NODE_ENV = 'development';
      expect(resolveReturnUrl(undefined)).toBe('http://localhost:3000/');
      expect(resolveReturnUrl('https://evil.com', '/dash')).toBe(
        'http://localhost:3000/dash',
      );
    });
  });

  describe('resolveOrigin', () => {
    beforeEach(() => {
      process.env.NODE_ENV = 'production';
    });

    it('prefers the explicit origin when allowed', () => {
      expect(
        resolveOrigin(
          'https://devparana.org',
          'https://codaqui.dev',
          undefined,
        ),
      ).toBe('https://devparana.org');
    });

    it('falls back to the Origin header when explicit is missing or disallowed', () => {
      expect(
        resolveOrigin(undefined, 'https://elasnocodigo.com.br', undefined),
      ).toBe('https://elasnocodigo.com.br');
      expect(
        resolveOrigin('https://evil.com', 'https://codaqui.dev', undefined),
      ).toBe('https://codaqui.dev');
    });

    it('derives the origin from the Referer header when others fail', () => {
      expect(
        resolveOrigin(
          undefined,
          undefined,
          'https://tisocial.org.br/pagina/profunda?q=1',
        ),
      ).toBe('https://tisocial.org.br');
    });

    it('ignores a malformed Referer header', () => {
      expect(resolveOrigin(undefined, undefined, 'not-a-url')).toBe(
        'https://codaqui.dev',
      );
    });

    it('ignores a Referer whose origin is not whitelisted', () => {
      expect(
        resolveOrigin(undefined, undefined, 'https://evil.com/x'),
      ).toBe('https://codaqui.dev');
    });

    it('returns the default origin when nothing is allowed', () => {
      expect(resolveOrigin(undefined, undefined, undefined)).toBe(
        'https://codaqui.dev',
      );
      expect(resolveOrigin('ftp://x', 'http://nope.io', undefined)).toBe(
        'https://codaqui.dev',
      );
    });
  });
});
