import {
  IsString,
  IsInt,
  IsOptional,
  IsUUID,
  IsIn,
  MaxLength,
  Min,
} from 'class-validator';

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

  /** 'payment' (default) ou 'receipt'. Define a direção do template. */
  @IsOptional()
  @IsIn(['payment', 'receipt'])
  direction?: 'payment' | 'receipt';
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

  @IsOptional()
  @IsIn(['payment', 'receipt'])
  direction?: 'payment' | 'receipt';
}
