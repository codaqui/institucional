import type { NextFunction, Request, Response } from 'express';
import {
  ReturnToMiddleware,
  RETURN_TO_COOKIE,
} from './return-to.middleware';

describe('ReturnToMiddleware', () => {
  const originalNodeEnv = process.env.NODE_ENV;

  let middleware: ReturnToMiddleware;
  let res: { cookie: jest.Mock };
  let next: jest.Mock<NextFunction>;

  const reqWithQuery = (query: Record<string, unknown>) =>
    ({ query }) as unknown as Request;

  beforeEach(() => {
    middleware = new ReturnToMiddleware();
    res = { cookie: jest.fn() };
    next = jest.fn();
  });

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
  });

  it('calls next without setting a cookie when returnTo is absent', () => {
    middleware.use(reqWithQuery({}), res as unknown as Response, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.cookie).not.toHaveBeenCalled();
  });

  it('ignores a returnTo that is not a valid URL', () => {
    middleware.use(
      reqWithQuery({ returnTo: 'not a url' }),
      res as unknown as Response,
      next,
    );

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.cookie).not.toHaveBeenCalled();
  });

  it('ignores a returnTo whose origin is not whitelisted (open redirect)', () => {
    process.env.NODE_ENV = 'production';
    middleware.use(
      reqWithQuery({ returnTo: 'https://evil.com/phishing' }),
      res as unknown as Response,
      next,
    );

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.cookie).not.toHaveBeenCalled();
  });

  it('ignores protocol-relative and subdomain look-alike origins', () => {
    process.env.NODE_ENV = 'production';
    for (const candidate of [
      'https://codaqui.dev.evil.com/x',
      'https://evil.codaqui.dev/x',
    ]) {
      middleware.use(
        reqWithQuery({ returnTo: candidate }),
        res as unknown as Response,
        next,
      );
    }

    expect(next).toHaveBeenCalledTimes(2);
    expect(res.cookie).not.toHaveBeenCalled();
  });

  it('persists an allowed returnTo in a short-lived httpOnly cookie', () => {
    process.env.NODE_ENV = 'production';
    middleware.use(
      reqWithQuery({ returnTo: 'https://tisocial.org.br/apoiar?origem=home' }),
      res as unknown as Response,
      next,
    );

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.cookie).toHaveBeenCalledWith(
      RETURN_TO_COOKIE,
      'https://tisocial.org.br/apoiar?origem=home',
      {
        httpOnly: true,
        secure: true,
        sameSite: 'lax',
        maxAge: 5 * 60 * 1000,
        path: '/',
      },
    );
  });

  it('sets secure=false outside production', () => {
    process.env.NODE_ENV = 'development';
    middleware.use(
      reqWithQuery({ returnTo: 'http://localhost:3000/admin' }),
      res as unknown as Response,
      next,
    );

    expect(res.cookie).toHaveBeenCalledWith(
      RETURN_TO_COOKIE,
      'http://localhost:3000/admin',
      expect.objectContaining({ secure: false, httpOnly: true }),
    );
  });
});
