import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export const CERTIFICATE_FILTERS = ['all', 'eligible', 'granted', 'registration_pending'] as const;
export type CertificateFilter = (typeof CERTIFICATE_FILTERS)[number];

export class ListRegistrationsQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsIn(CERTIFICATE_FILTERS)
  certificateFilter?: CertificateFilter;
}

export class BatchCheckinDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @IsString({ each: true })
  tokens: string[];
}

export class BatchCertificateInviteDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @IsString({ each: true })
  registrationIds: string[];
}
