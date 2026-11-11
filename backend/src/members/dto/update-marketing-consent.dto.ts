import { IsBoolean, IsOptional } from 'class-validator';

export class UpdateMarketingConsentDto {
  @IsBoolean()
  marketingEmailOptIn: boolean;

  @IsOptional()
  @IsBoolean()
  confirmReactivation?: boolean;
}
