import { Injectable } from '@nestjs/common';

/**
 * StorageService — v1 simplificada
 *
 * Comprovantes são links externos (Google Drive, Dropbox, etc.).
 * O/a revisor/a tem a responsabilidade de guardar no Drive da organização ao aprovar.
 *
 * Evolução futura: substituir por MinIO/S3 quando houver escala e investimento em infra.
 */
@Injectable()
export class StorageService {
  private readonly trustedHostnames = [
    'drive.google.com',
    'docs.google.com',
    'www.dropbox.com',
    'dropbox.com',
    'onedrive.live.com',
    '1drv.ms',
    'imgur.com',
    'i.imgur.com',
  ];

  /**
   * Valida se a URL fornecida é de um domínio confiável e usa HTTPS.
   * Retorna a URL se válida.
   */
  validateReceiptUrl(url: string): string {
    try {
      const parsed = new URL(url);
      if (parsed.protocol !== 'https:') {
        throw new Error('URL deve usar https');
      }
      const isTrusted = this.trustedHostnames.some(
        (domain) =>
          parsed.hostname === domain || parsed.hostname.endsWith(`.${domain}`),
      );
      if (!isTrusted) {
        throw new Error(
          `Domínio não permitido. Use: ${this.trustedHostnames.join(', ')}`,
        );
      }
      return url;
    } catch (err) {
      if (err instanceof Error && err.message.startsWith('Domínio')) throw err;
      if (err instanceof Error && err.message.startsWith('URL deve')) throw err;
      throw new Error(`URL inválida para comprovante: "${url}"`);
    }
  }
}
