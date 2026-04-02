import { Controller, Post, Body } from '@nestjs/common';
import { StorageService } from './storage.service';

/**
 * StorageController — v1
 *
 * Endpoint de validação de URL de comprovante.
 * Não há upload gerenciado — o comprovante é um link externo (Google Drive, etc.).
 */
@Controller('storage')
export class StorageController {
  constructor(private readonly storageService: StorageService) {}

  @Post('validate-receipt-url')
  validateReceiptUrl(@Body('url') url: string) {
    const validated = this.storageService.validateReceiptUrl(url);
    return { url: validated, valid: true };
  }
}
