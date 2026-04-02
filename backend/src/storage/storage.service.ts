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
  /**
   * Valida se a URL fornecida é acessível (básico — apenas formato).
   * Retorna a URL se válida.
   */
  validateReceiptUrl(url: string): string {
    try {
      const parsed = new URL(url);
      if (!['http:', 'https:'].includes(parsed.protocol)) {
        throw new Error('URL deve usar http ou https');
      }
      return url;
    } catch {
      throw new Error(`URL inválida para comprovante: "${url}"`);
    }
  }
}
