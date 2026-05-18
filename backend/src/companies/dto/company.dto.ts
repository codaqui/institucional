import {
  IsString,
  IsOptional,
  IsUrl,
  IsInt,
  Min,
  Length,
  Matches,
} from 'class-validator';

export class CreateCompanyDto {
  /** Somente dígitos — o service valida formato CNPJ */
  @IsString()
  @Matches(/^\d{14}$/, { message: 'cnpj deve conter exatamente 14 dígitos numéricos' })
  cnpj: string;

  @IsString()
  @Length(2, 200)
  name: string;

  @IsOptional()
  @IsUrl()
  logoUrl?: string;

  @IsOptional()
  @IsUrl()
  websiteUrl?: string;
}

export class UpdateCompanyDto {
  @IsOptional()
  @IsString()
  @Length(2, 200)
  name?: string;

  @IsOptional()
  @IsUrl()
  logoUrl?: string;

  @IsOptional()
  @IsUrl()
  websiteUrl?: string;
}

export class CreateCompanyCheckoutDto {
  @IsInt()
  @Min(20000)
  amountCents: number;

  @IsOptional()
  @IsString()
  successUrl?: string;

  @IsOptional()
  @IsString()
  cancelUrl?: string;
}
