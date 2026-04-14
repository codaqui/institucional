import {
  IsString,
  IsOptional,
  MaxLength,
  IsUrl,
  IsUUID,
  Matches,
} from 'class-validator';
import { Transform } from 'class-transformer';

/**
 * Strips all non-digit characters so the DB stores only raw digits.
 * Future-proof: when CNPJ gains letters (July 2026), change to strip
 * only formatting chars (dots, dashes, slashes).
 */
const stripNonDigits = () =>
  Transform(({ value }) =>
    typeof value === 'string' ? value.replaceAll(/\D/g, '') : value,
  );

export class CreateVendorDto {
  @IsString()
  @MaxLength(255)
  name: string;

  @IsOptional()
  @stripNonDigits()
  @IsString()
  @Matches(/^\d{11}$|^\d{14}$/, {
    message: 'Documento deve conter 11 dígitos (CPF) ou 14 dígitos (CNPJ).',
  })
  document?: string;

  @IsOptional()
  @IsUrl()
  @MaxLength(500)
  website?: string;

  /** Se informado, vincula a uma Account existente. Senão, cria automaticamente. */
  @IsOptional()
  @IsUUID()
  accountId?: string;
}

export class UpdateVendorDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  name?: string;

  @IsOptional()
  @stripNonDigits()
  @IsString()
  @Matches(/^\d{11}$|^\d{14}$/, {
    message: 'Documento deve conter 11 dígitos (CPF) ou 14 dígitos (CNPJ).',
  })
  document?: string;

  @IsOptional()
  @IsUrl()
  @MaxLength(500)
  website?: string;
}
