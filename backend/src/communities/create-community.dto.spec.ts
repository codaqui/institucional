import { validate } from 'class-validator';
import { CreateCommunityDto } from './dto/create-community.dto';

function dtoWith(value: Record<string, unknown>) {
  return Object.assign(new CreateCommunityDto(), {
    slug: 'comunidade-teste',
    name: 'Comunidade Teste',
    ...value,
  });
}

describe('CreateCommunityDto URL validation', () => {
  it.each([
    'https://example.com/community',
    '/comunidades/teste',
    'https://github.com/DeveloperParana',
    '/comunidades/devparana',
    'https://www.meetup.com/pt-BR/developerparana/',
    '/img/devparana.svg',
  ])(
    'accepts safe community URL %s',
    async (url) => {
      const errors = await validate(
        dtoWith({
          links: [{ label: 'Site', url }],
          socialProfiles: [{ platform: 'website', url }],
        }),
      );
      expect(errors).toHaveLength(0);
    },
  );

  it.each([
    'javascript:alert(1)',
    'http://example.com',
    'data:text/html,test',
    '//external.example',
    '/\\external.example',
    '/comunidades/\nexternal.example',
    'https://example.com/\\@external.example',
  ])(
    'rejects unsafe community URL %s',
    async (url) => {
      const errors = await validate(
        dtoWith({ socialProfiles: [{ platform: 'website', url }] }),
      );
      expect(errors).not.toHaveLength(0);
    },
  );

  it('rejects a non-array links payload without throwing in the custom validator', async () => {
    const errors = await validate(
      dtoWith({ links: { url: 'https://example.com' } }),
    );
    expect(errors).not.toHaveLength(0);
  });
});
