import {
  IsString,
  IsInt,
  IsOptional,
  IsUrl,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';

/**
 * DTO base para lançamentos de fornecedor (pagamento ou recebimento).
 * Subclasses adicionam apenas o ID da conta da contraparte interna.
 */
export class CreateVendorTransactionBaseDto {
  @IsUUID()
  vendorId: string;

  @IsInt()
  @Min(1)
  amount: number;

  @IsString()
  @MaxLength(500)
  description: string;

  @IsOptional()
  @IsUrl()
  receiptUrl?: string;

  @IsOptional()
  @IsUrl()
  internalReceiptUrl?: string;
}
