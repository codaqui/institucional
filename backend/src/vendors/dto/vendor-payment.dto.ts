import { IsString, IsInt, IsOptional, IsUrl, IsUUID, MaxLength, Min } from 'class-validator';

export class CreateVendorPaymentDto {
  @IsUUID()
  vendorId: string;

  @IsUUID()
  sourceAccountId: string;

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
