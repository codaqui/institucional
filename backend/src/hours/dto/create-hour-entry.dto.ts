import { Transform, Type } from 'class-transformer';
import {
  IsDateString,
  IsIn,
  IsNotEmpty,
  IsNumber,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { HourEntrySource } from '../entities/hour-entry.entity';

export class CreateHourEntryDto {
  @IsIn([HourEntrySource.DIRECTORATE_ACTIVITY])
  sourceType: HourEntrySource.DIRECTORATE_ACTIVITY;

  @IsUUID()
  sourceId: string;

  @Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
  @IsNotEmpty()
  @IsString()
  @MaxLength(160)
  sourceLabel: string;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @Max(1000)
  hours: number;

  @Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
  @IsNotEmpty()
  @IsString()
  @MaxLength(500)
  description: string;

  @IsDateString()
  occurredAt: string;

  @Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
  @IsNotEmpty()
  @IsString()
  @MaxLength(128)
  idempotencyKey: string;
}
