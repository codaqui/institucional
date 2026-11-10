import { PartialType } from '@nestjs/swagger';
import { IsBoolean, IsEmail, IsISO8601, IsOptional, IsString, IsUrl, IsUUID, Matches, MaxLength, MinLength } from 'class-validator';

export class CreateCityDto {
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name: string;

  @IsString()
  @Matches(/^[A-Za-z]{2}$/)
  uf: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateCityDto extends PartialType(CreateCityDto) {}

export class CreateUniversityInstitutionDto {
  @IsString()
  @MinLength(2)
  @MaxLength(160)
  name: string;

  @IsOptional()
  @IsString()
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  @MaxLength(80)
  slug?: string;

  @IsOptional()
  @IsUrl({ protocols: ['https'], require_tld: false })
  website?: string;

  @IsOptional()
  @IsEmail()
  contactEmail?: string;

  @IsUUID()
  cityId: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateUniversityInstitutionDto extends PartialType(CreateUniversityInstitutionDto) {}

export class AmbassadorApplicationDto {
  @IsString()
  @MinLength(10)
  @MaxLength(2000)
  applicationNotes: string;
}

export class ConfirmAmbassadorDto {
  @IsOptional()
  @IsISO8601()
  validUntil?: string;
}
