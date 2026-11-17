import { BadRequestException } from '@nestjs/common';
import { validateCompanyProfileUrls } from './company-profile';

describe('company profile URLs', () => {
  it('accepts HTTPS logo and website URLs', () => {
    expect(() =>
      validateCompanyProfileUrls({
        logoUrl: 'https://cdn.example.test/logo.png',
        websiteUrl: 'https://example.test',
      }),
    ).not.toThrow();
  });

  it.each(['http://example.test/logo.png', 'example.test'])(
    'rejects invalid or insecure URL %s',
    (url) => {
      expect(() => validateCompanyProfileUrls({ logoUrl: url })).toThrow(
        BadRequestException,
      );
    },
  );
});
