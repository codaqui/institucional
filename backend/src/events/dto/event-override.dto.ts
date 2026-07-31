import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

/**
 * Payload de override de metadados de evento.
 *
 * `extendData` segue o mesmo shape do antigo arquivo .override.json:
 * textos simples e objetos JSON livres, sem schema relacional fixo.
 */
export class EventOverridePayloadDto {
  @ApiProperty({
    description: 'Metadados estendidos do evento (antigo extendData).',
    example: { summary: 'Descrição customizada', workloadMinutes: 300 },
  })
  @IsObject()
  @IsNotEmpty()
  extendData: Record<string, unknown>;
}

export class CreateEventOverrideDto {
  @ApiProperty({
    description: 'Chave da fonte: "<source>:<sourceId>".',
    example: 'ocgroups:cloud-native-maringa',
  })
  @IsString()
  @IsNotEmpty()
  sourceKey: string;

  @ApiProperty({
    description: 'Identificador do evento na fonte externa.',
    example: 'ocgroups-d18d2fc7-8150-408d-81c4-a4f4e4097838',
  })
  @IsString()
  @IsNotEmpty()
  eventId: string;

  @ApiProperty({ type: EventOverridePayloadDto })
  payload: EventOverridePayloadDto;

  @ApiPropertyOptional({
    description: 'Motivo da edição.',
    example: 'Aumentando carga horária.',
  })
  @IsString()
  @IsOptional()
  @MaxLength(500)
  reason?: string;
}

export class UpdateEventOverrideDto {
  @ApiProperty({ type: EventOverridePayloadDto })
  payload: EventOverridePayloadDto;

  @ApiPropertyOptional({
    description: 'Motivo da edição.',
    example: 'Corrigindo título.',
  })
  @IsString()
  @IsOptional()
  @MaxLength(500)
  reason?: string;
}

export class EventOverrideResponseDto {
  id: string;
  sourceKey: string;
  eventId: string;
  ownerMemberId: string;
  payload: Record<string, unknown>;
  reason: string | null;
  createdByMemberId: string;
  updatedByMemberId: string;
  createdAt: Date;
  updatedAt: Date;
}
