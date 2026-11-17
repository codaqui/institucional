import { IsOptional, IsString, IsUUID, Length, Matches } from 'class-validator';

export class ConvertSubscriptionDto {
  @IsUUID()
  memberId: string;

  @IsString()
  @Matches(/^sub_[A-Za-z0-9]+$/)
  subscriptionId: string;

  @IsOptional()
  @IsUUID()
  companyId?: string;

  @IsOptional()
  @IsString()
  @Length(2, 200)
  name?: string;

  @IsOptional()
  @Matches(/^\d{14}$/)
  cnpj?: string;

  @IsOptional()
  @IsString()
  @Length(2, 200)
  tradeName?: string;

  @IsOptional()
  @IsString()
  logoUrl?: string;

  @IsOptional()
  @IsString()
  websiteUrl?: string;
}
