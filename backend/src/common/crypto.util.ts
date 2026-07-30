import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

/**
 * Criptografia em repouso do token OAuth do GitHub (Member.githubAccessToken).
 *
 * Formatos persistidos:
 * - `v1:<iv_hex>:<authTag_hex>:<ciphertext_hex>` — AES-256-GCM, quando a env
 *   `GITHUB_TOKEN_ENCRYPTION_KEY` está definida (32 bytes em hex ou base64).
 * - `plain:<token>` — fallback de DESENVOLVIMENTO, quando a env não está
 *   definida. Em produção a env é obrigatória (ver .env.example).
 *
 * O decrypt reconhece os dois formatos, então tokens gravados em dev
 * continuam legíveis depois que a chave é configurada.
 */

const ENV_KEY = 'GITHUB_TOKEN_ENCRYPTION_KEY';
const PREFIX_V1 = 'v1:';
const PREFIX_PLAIN = 'plain:';

let cachedKey: Buffer | null | undefined;

/** Resolve e valida a chave (32 bytes). Cacheia o resultado. */
function resolveKey(): Buffer | null {
  if (cachedKey !== undefined) return cachedKey;
  const raw = process.env[ENV_KEY]?.trim();
  if (!raw) {
    cachedKey = null;
    return cachedKey;
  }
  const key = /^[0-9a-fA-F]{64}$/.test(raw)
    ? Buffer.from(raw, 'hex')
    : Buffer.from(raw, 'base64');
  if (key.length !== 32) {
    throw new Error(
      `${ENV_KEY} inválida: esperado 32 bytes em hex (64 chars) ou base64; recebido ${key.length} byte(s).`,
    );
  }
  cachedKey = key;
  return cachedKey;
}

/** Apenas para testes — limpa o cache da chave. */
export function resetTokenKeyCache(): void {
  cachedKey = undefined;
}

/** Criptografa o token para persistência (ou prefixa com `plain:` em dev). */
export function encryptToken(token: string): string {
  const key = resolveKey();
  if (!key) return `${PREFIX_PLAIN}${token}`;
  const iv = randomBytes(12); // GCM recomenda IV de 96 bits
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([
    cipher.update(token, 'utf8'),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();
  return [
    'v1',
    iv.toString('hex'),
    authTag.toString('hex'),
    ciphertext.toString('hex'),
  ].join(':');
}

/**
 * Descriptografa um token persistido. Reconhece `v1:` (AES-256-GCM) e
 * `plain:` (legado de dev). Lança Error claro para formato/chave inválidos.
 */
export function decryptToken(stored: string): string {
  if (stored.startsWith(PREFIX_PLAIN)) {
    return stored.slice(PREFIX_PLAIN.length);
  }
  if (!stored.startsWith(PREFIX_V1)) {
    throw new Error(
      'Token do GitHub em formato desconhecido (esperado prefixo v1: ou plain:).',
    );
  }
  const key = resolveKey();
  if (!key) {
    throw new Error(
      `Token criptografado encontrado, mas ${ENV_KEY} não está definida — impossível descriptografar.`,
    );
  }
  const [, ivHex, authTagHex, ciphertextHex] = stored.split(':');
  if (!ivHex || !authTagHex || !ciphertextHex) {
    throw new Error('Token do GitHub corrompido (payload v1: incompleto).');
  }
  try {
    const decipher = createDecipheriv(
      'aes-256-gcm',
      key,
      Buffer.from(ivHex, 'hex'),
    );
    decipher.setAuthTag(Buffer.from(authTagHex, 'hex'));
    return Buffer.concat([
      decipher.update(Buffer.from(ciphertextHex, 'hex')),
      decipher.final(),
    ]).toString('utf8');
  } catch {
    throw new Error(
      `Falha ao descriptografar token do GitHub — ${ENV_KEY} não corresponde à chave usada na gravação.`,
    );
  }
}
