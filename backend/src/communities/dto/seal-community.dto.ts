import {
  IsISO8601,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class SealCommunityDto {
  @IsOptional()
  @IsISO8601()
  validUntil?: string;

  @IsString()
  @MinLength(3)
  @MaxLength(4000)
  notes: string;
}
