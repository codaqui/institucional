import { Transform, Type } from 'class-transformer';
import {
  IsDate,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { ASSEMBLY_DISCUSSION_URL_PATTERN } from '../assembly.rules';
import type { AssemblyStatus, AssemblyType } from '../entities/assembly.entity';

const trimText = Transform(({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value,
);

export class AssemblyNotaryRegistryDto {
  @trimText
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  book: string;

  @trimText
  @IsString()
  @IsNotEmpty()
  @MaxLength(40)
  page: string;

  @Type(() => Date)
  @IsDate()
  registeredAt: Date;
}

export class CreateAssemblyDto {
  @IsIn(['ordinaria', 'oficial'])
  type: AssemblyType;

  @trimText
  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  title: string;

  @Type(() => Date)
  @IsDate()
  scheduledAt: Date;

  @trimText
  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  agendaSummary: string;

  @IsString()
  @MaxLength(2048)
  @Matches(ASSEMBLY_DISCUSSION_URL_PATTERN, {
    message:
      'discussionUrl deve ser a URL exata de uma Discussion do repositório.',
  })
  discussionUrl: string;

  @IsOptional()
  @IsUrl({ require_protocol: true, protocols: ['https'] })
  @MaxLength(2048)
  ataPdfUrl?: string | null;

  @IsOptional()
  @ValidateNested()
  @Type(() => AssemblyNotaryRegistryDto)
  notaryRegistry?: AssemblyNotaryRegistryDto | null;
}

export class UpdateAssemblyDto {
  @IsOptional()
  @trimText
  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  title?: string;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  scheduledAt?: Date;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  heldAt?: Date | null;

  @IsOptional()
  @IsIn(['scheduled', 'held', 'canceled'])
  status?: AssemblyStatus;

  @IsOptional()
  @trimText
  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  agendaSummary?: string;

  @IsOptional()
  @IsUrl({ require_protocol: true, protocols: ['https'] })
  @MaxLength(2048)
  ataPdfUrl?: string | null;

  @IsOptional()
  @ValidateNested()
  @Type(() => AssemblyNotaryRegistryDto)
  notaryRegistry?: AssemblyNotaryRegistryDto | null;
}

export class ListAssembliesDto {
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
  @IsIn(['ordinaria', 'oficial'])
  type?: AssemblyType;

  @IsOptional()
  @IsIn(['scheduled', 'held', 'canceled'])
  status?: AssemblyStatus;
}
