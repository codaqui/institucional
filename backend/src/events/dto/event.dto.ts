import { Type } from 'class-transformer';
import {
  IsInt,
  IsISO8601,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  Matches,
  Min,
} from 'class-validator';

export class ListEventsQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsString()
  community?: string;
}

export class CreateEventDto {
  @IsString()
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
    message: 'slug deve ser kebab-case (ex.: devpr-conf-2026).',
  })
  slug: string;

  @IsString()
  @IsNotEmpty()
  title: string;

  @IsString()
  @IsNotEmpty()
  summary: string;

  @IsOptional()
  @IsUrl(
    { require_tld: false },
    { message: 'imageUrl deve ser uma URL válida (http ou https).' },
  )
  imageUrl?: string;

  @IsString()
  @IsNotEmpty()
  location: string;

  @IsISO8601()
  startAt: string;

  @IsOptional()
  @IsISO8601()
  endAt?: string;

  @IsOptional()
  @IsString()
  timezone?: string;

  @IsString()
  @IsNotEmpty()
  communityProjectKey: string;

  /**
   * Limite de vagas do RSVP gratuito. Eventos com ingressos pagos devem
   * usar `null` — o limite de um evento pago vem de `quantityTotal` dos
   * lotes (ticket types).
   */
  @IsOptional()
  @IsInt()
  @Min(1)
  capacity?: number;
}

export class UpdateEventDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  title?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  summary?: string;

  @IsOptional()
  @IsUrl(
    { require_tld: false },
    { message: 'imageUrl deve ser uma URL válida (http ou https).' },
  )
  imageUrl?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  location?: string;

  @IsOptional()
  @IsISO8601()
  startAt?: string;

  @IsOptional()
  @IsISO8601()
  endAt?: string;

  @IsOptional()
  @IsString()
  timezone?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  communityProjectKey?: string;

  /**
   * Limite de vagas do RSVP gratuito. Eventos com ingressos pagos devem
   * usar `null` — o limite de um evento pago vem de `quantityTotal` dos
   * lotes (ticket types).
   */
  @IsOptional()
  @IsInt()
  @Min(1)
  capacity?: number;
}
