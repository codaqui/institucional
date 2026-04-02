import { IsUrl, IsOptional, IsString, MaxLength } from 'class-validator';

export class ApproveReimbursementDto {
  @IsUrl()
  internalReceiptUrl: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  reviewNote?: string;
}
