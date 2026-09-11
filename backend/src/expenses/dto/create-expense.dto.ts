import {
  IsString,
  IsInt,
  IsUUID,
  IsOptional,
  IsUrl,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateExpenseDto {
  @IsString()
  @MaxLength(500)
  description: string;

  /** valor em centavos (int) — mesma convenção de vendors */
  @IsInt()
  @Min(1)
  amount: number;

  @IsUUID()
  targetProjectId: string;

  @IsOptional()
  @IsUrl({ require_protocol: true, protocols: ['https'] })
  @MaxLength(2048)
  receiptUrl?: string;
}
