import { IsUUID } from 'class-validator';
import { CreateVendorTransactionBaseDto } from './vendor-transaction-base.dto';

export class CreateVendorPaymentDto extends CreateVendorTransactionBaseDto {
  /** Conta da comunidade que vai pagar (não pode ser EXTERNAL) */
  @IsUUID()
  sourceAccountId: string;
}
