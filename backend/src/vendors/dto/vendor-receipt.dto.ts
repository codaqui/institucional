import { IsUUID } from 'class-validator';
import { CreateVendorTransactionBaseDto } from './vendor-transaction-base.dto';

export class CreateVendorReceiptDto extends CreateVendorTransactionBaseDto {
  /** Conta da comunidade que vai receber o valor (não pode ser EXTERNAL) */
  @IsUUID()
  destinationAccountId: string;
}
