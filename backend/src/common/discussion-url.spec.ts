import { BadRequestException } from '@nestjs/common';
import { assertDiscussionUrl } from './discussion-url';

describe('assertDiscussionUrl', () => {
  it('accepts the exact repository discussion URL', () => {
    expect(assertDiscussionUrl('https://github.com/codaqui/institucional/discussions/123'))
      .toBe('https://github.com/codaqui/institucional/discussions/123');
  });

  it.each([
    'https://github.com/codaqui/other/discussions/123',
    'https://github.com/codaqui/institucional/discussions/abc',
    'http://github.com/codaqui/institucional/discussions/123',
  ])('rejects %s', (value) => {
    expect(() => assertDiscussionUrl(value)).toThrow(BadRequestException);
  });
});
