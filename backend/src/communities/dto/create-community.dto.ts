import {
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class CreateCommunityDto {
  @IsString()
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
    message: 'slug deve conter apenas letras minúsculas, números e hífens',
  })
  @MaxLength(80)
  slug: string;

  @IsString()
  @MinLength(2)
  @MaxLength(160)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(16)
  emoji?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2048)
  logoUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  location?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  founded?: number;

  @IsOptional()
  @IsArray()
  links?: Record<string, unknown>[];

  @IsOptional()
  @IsArray()
  socialProfiles?: Record<string, unknown>[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @IsOptional()
  @IsIn(['parceira', 'integrada'])
  level?: 'parceira' | 'integrada';

  @IsOptional()
  @IsIn(['proposed', 'active', 'suspended', 'exited'])
  status?: 'proposed' | 'active' | 'suspended' | 'exited';

  @IsOptional()
  @IsBoolean()
  siteEnabled?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  siteDomain?: string;
}
