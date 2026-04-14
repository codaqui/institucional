import { IsString, IsInt, IsOptional, IsUUID, MaxLength, Min } from 'class-validator';

export class CreateTemplateDto {
  @IsString()
  @MaxLength(255)
  name: string;

  @IsUUID()
  sourceAccountId: string;

  @IsUUID()
  vendorId: string;

  @IsInt()
  @Min(1)
  amount: number;

  @IsString()
  description: string;
}

export class UpdateTemplateDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  name?: string;

  @IsOptional()
  @IsUUID()
  sourceAccountId?: string;

  @IsOptional()
  @IsUUID()
  vendorId?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  amount?: number;

  @IsOptional()
  @IsString()
  description?: string;
}
