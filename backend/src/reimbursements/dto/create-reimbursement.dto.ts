import { IsUUID, IsNumber, IsString, IsUrl, Min, MaxLength } from 'class-validator';

export class CreateReimbursementDto {
  @IsUUID()
  accountId: string;

  @IsNumber()
  @Min(0.01)
  amount: number;

  @IsString()
  @MaxLength(500)
  description: string;

  @IsUrl()
  receiptUrl: string;
}
