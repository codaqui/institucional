import { IsString, IsNumber, IsUUID, IsOptional, IsUrl, MaxLength, Min } from 'class-validator';

export class CreateExpenseDto {
  @IsString()
  @MaxLength(500)
  description: string;

  @IsNumber()
  @Min(0.01)
  amount: number;

  @IsUUID()
  targetProjectId: string;

  @IsOptional()
  @IsUrl({ require_protocol: true, protocols: ['https'] })
  @MaxLength(2048)
  receiptUrl?: string;
}
