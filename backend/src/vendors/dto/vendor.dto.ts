import { IsString, IsOptional, MaxLength, IsUrl, IsUUID } from 'class-validator';

export class CreateVendorDto {
  @IsString()
  @MaxLength(255)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
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
  @IsString()
  @MaxLength(20)
  document?: string;

  @IsOptional()
  @IsUrl()
  @MaxLength(500)
  website?: string;
}
