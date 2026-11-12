import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { C4P_SLUG_PATTERN } from '../c4p.constants';
import type { C4pCallStatus, Criterion } from '../entities/c4p-call.entity';

export class CriterionDto implements Criterion {
  @Matches(/^[a-z][a-z0-9_]{0,30}$/, {
    message: 'A chave do critério deve estar em snake_case (a–z, 0–9, _).',
  })
  key: string;

  @Length(3, 80)
  label: string;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @Max(100)
  weight: number;
}

export class CreateC4pCallDto {
  @Matches(C4P_SLUG_PATTERN, {
    message: 'O slug deve ser kebab-case (a–z, 0–9, hífens).',
  })
  slug: string;

  @IsString()
  @Length(3, 160)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @IsOptional()
  @IsUUID()
  managedEventId?: string;

  @IsOptional()
  @IsUUID()
  communityId?: string;

  @IsOptional()
  @IsDateString()
  submissionOpenAt?: string;

  @IsOptional()
  @IsDateString()
  submissionCloseAt?: string;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(10)
  @ValidateNested({ each: true })
  @Type(() => CriterionDto)
  criteria?: Criterion[];

  @IsOptional()
  @IsBoolean()
  publicResults?: boolean;
}

export class UpdateC4pCallDto {
  @IsOptional()
  @IsString()
  @Length(3, 160)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @IsOptional()
  @IsUUID()
  managedEventId?: string | null;

  @IsOptional()
  @IsUUID()
  communityId?: string | null;

  @IsOptional()
  @IsDateString()
  submissionOpenAt?: string | null;

  @IsOptional()
  @IsDateString()
  submissionCloseAt?: string | null;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(10)
  @ValidateNested({ each: true })
  @Type(() => CriterionDto)
  criteria?: Criterion[];

  @IsOptional()
  @IsBoolean()
  publicResults?: boolean;

  @IsOptional()
  @IsIn(['draft', 'open'])
  status?: C4pCallStatus;
}

export class ListC4pCallsDto {
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(100)
  limit?: number;

  @IsOptional()
  @IsIn(['draft', 'open', 'closed'])
  status?: C4pCallStatus;
}
