import { PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import type { AnnouncementSeverity } from '../entities/announcement.entity';

export class AnnouncementInputDto {
  @IsString()
  @MinLength(3)
  @MaxLength(280)
  text: string;

  @IsIn(['info', 'success', 'warning', 'error'])
  severity: AnnouncementSeverity;

  @IsOptional()
  @IsString()
  @MaxLength(2048)
  linkUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  linkLabel?: string;

  @IsOptional()
  @IsDateString()
  startsAt?: string;

  @IsOptional()
  @IsDateString()
  endsAt?: string;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

export class CreateAnnouncementDto extends AnnouncementInputDto {}
export class UpdateAnnouncementDto extends PartialType(AnnouncementInputDto) {}

export class ListAnnouncementsDto {
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
}
