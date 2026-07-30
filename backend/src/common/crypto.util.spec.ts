import { decryptToken, encryptToken, resetTokenKeyCache } from './crypto.util';

const ENV_KEY = 'GITHUB_TOKEN_ENCRYPTION_KEY';
// 32 bytes em hex (64 chars) e em base64 — os dois formatos aceitos
const KEY_HEX = 'a'.repeat(64);
const KEY_BASE64 = Buffer.from('b'.repeat(32), 'utf8').toString('base64');

describe('crypto.util (githubAccessToken)', () => {
  const savedKey = process.env[ENV_KEY];

  afterEach(() => {
    if (savedKey === undefined) delete process.env[ENV_KEY];
    else process.env[ENV_KEY] = savedKey;
    resetTokenKeyCache();
  });

  describe('sem a env (fallback de dev)', () => {
    beforeEach(() => {
      delete process.env[ENV_KEY];
      resetTokenKeyCache();
    });

    it('armazena com prefixo plain:', () => {
      expect(encryptToken('gho_abc123')).toBe('plain:gho_abc123');
    });

    it('descriptografa o formato plain:', () => {
      expect(decryptToken('plain:gho_abc123')).toBe('gho_abc123');
    });
  });

  describe('com a env (AES-256-GCM)', () => {
    it.each([
      ['hex', KEY_HEX],
      ['base64', KEY_BASE64],
    ])('round-trip com chave %s', (_label, key) => {
      process.env[ENV_KEY] = key;
      resetTokenKeyCache();

      const stored = encryptToken('gho_secreto');
      expect(stored).toMatch(/^v1:[0-9a-f]{24}:[0-9a-f]{32}:[0-9a-f]+$/);
      expect(stored).not.toContain('gho_secreto');
      expect(decryptToken(stored)).toBe('gho_secreto');
    });

    it('IV aleatório: dois encrypts do mesmo token diferem', () => {
      process.env[ENV_KEY] = KEY_HEX;
      resetTokenKeyCache();
      expect(encryptToken('gho_x')).not.toBe(encryptToken('gho_x'));
    });

    it('descriptografa plain: mesmo com a chave configurada (legado de dev)', () => {
      process.env[ENV_KEY] = KEY_HEX;
      resetTokenKeyCache();
      expect(decryptToken('plain:gho_legado')).toBe('gho_legado');
    });

    it('chave com tamanho errado → erro claro', () => {
      process.env[ENV_KEY] = 'c0ffe'; // hex válido mas ≠ 64 chars → base64 curto
      resetTokenKeyCache();
      expect(() => encryptToken('gho_x')).toThrow(`${ENV_KEY} inválida`);
    });

    it('chave errada na leitura → erro claro (auth tag)', () => {
      process.env[ENV_KEY] = KEY_HEX;
      resetTokenKeyCache();
      const stored = encryptToken('gho_secreto');

      process.env[ENV_KEY] = 'f'.repeat(64);
      resetTokenKeyCache();
      expect(() => decryptToken(stored)).toThrow(
        'não corresponde à chave usada na gravação',
      );
    });

    it('payload v1: incompleto → erro claro', () => {
      process.env[ENV_KEY] = KEY_HEX;
      resetTokenKeyCache();
      expect(() => decryptToken('v1:apenas-iv')).toThrow('corrompido');
    });

    it('formato desconhecido → erro claro', () => {
      process.env[ENV_KEY] = KEY_HEX;
      resetTokenKeyCache();
      expect(() => decryptToken('gho_sem_prefixo')).toThrow(
        'formato desconhecido',
      );
    });

    it('token v1: sem a env → erro claro', () => {
      process.env[ENV_KEY] = KEY_HEX;
      resetTokenKeyCache();
      const stored = encryptToken('gho_secreto');

      delete process.env[ENV_KEY];
      resetTokenKeyCache();
      expect(() => decryptToken(stored)).toThrow(
        `${ENV_KEY} não está definida`,
      );
    });
  });
});
