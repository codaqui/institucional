import { Type } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  IsUUID,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class ListDirectoratesDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 50;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;

  @IsOptional()
  @IsUUID()
  communityId?: string;
}
