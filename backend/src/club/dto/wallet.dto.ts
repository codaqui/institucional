import { IsInt, IsOptional, IsString, Min } from 'class-validator';

export class AdjustWalletDto {
  @IsString()
  memberId: string;

  @IsInt()
  amount: number;

  @IsOptional()
  @IsString()
  coinType?: string;

  @IsOptional()
  @IsString()
  description?: string;
}

export class AdjustCompanyWalletDto {
  @IsString()
  companyId: string;

  @IsInt()
  amount: number;

  @IsOptional()
  @IsString()
  coinType?: string;

  @IsOptional()
  @IsString()
  description?: string;
}

export class CreditSortCoinsDto {
  @IsInt()
  @Min(1)
  amountReais: number;

  @IsString()
  referenceId: string;
}
