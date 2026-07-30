import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export class SpeakerDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  handle?: string;

  @IsOptional()
  @IsString()
  avatarUrl?: string;

  @IsOptional()
  @IsString()
  talkTitle?: string;

  @IsOptional()
  @IsString()
  profileUrl?: string;
}

/**
 * Campos sobrescrevíveis de um evento externo (docs/EVENT_PLAN.md — Schema do Override).
 * Campos nunca sobrescrevíveis (id, startAt, endAt, href, source, sourceId, status)
 * são rejeitados pelo ValidationPipe global (forbidNonWhitelisted) e também pela
 * checagem manual no service (mensagens alinhadas com scripts/validate-overrides.mjs).
 */
export class ExtendDataDto {
  @IsOptional()
  @IsString()
  imageUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  summary?: string;

  @IsOptional()
  @IsString()
  location?: string;

  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsBoolean()
  featured?: boolean;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @IsString({ each: true })
  tags?: string[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @ValidateNested({ each: true })
  @Type(() => SpeakerDto)
  speakers?: SpeakerDto[];

  @IsOptional()
  @IsString()
  registrationUrl?: string;

  @IsOptional()
  @IsString()
  slidesUrl?: string;

  @IsOptional()
  @IsString()
  videoUrl?: string;

  @IsOptional()
  @IsString()
  discussionUrl?: string;

  /** Carga horária em minutos (usada no certificado de eventos externos) */
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(2880)
  workloadMinutes?: number;
}

export class UpsertOverrideDto {
  @ValidateNested()
  @Type(() => ExtendDataDto)
  extendData: ExtendDataDto;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
