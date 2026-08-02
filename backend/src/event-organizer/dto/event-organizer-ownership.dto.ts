import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  IsArray,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

export class CreateEventOrganizerOwnershipDto {
  @ApiProperty({
    description: 'ID do membro que receberá a ownership.',
    example: '00000000-0000-0000-0000-000000000001',
  })
  @IsUUID()
  @IsNotEmpty()
  memberId: string;

  @ApiProperty({
    description: 'Handle GitHub do membro (deve bater com o cadastro).',
    example: 'endersonmenezes',
  })
  @IsString()
  @IsNotEmpty()
  githubHandle: string;

  @ApiProperty({
    description:
      'Scopes de ownership. Ex.: ["ocgroups:cloud-native-maringa:*"].',
    example: ['ocgroups:cloud-native-maringa:*'],
  })
  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(100)
  scope: string[];
}

export class UpdateEventOrganizerOwnershipDto {
  @ApiProperty({
    description:
      'Scopes de ownership. Ex.: ["ocgroups:cloud-native-maringa:*"].',
    example: ['ocgroups:cloud-native-maringa:*'],
  })
  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(100)
  scope: string[];

  @ApiPropertyOptional({
    description: 'Motivo da alteração.',
    example: 'Adicionando novos eventos.',
  })
  @IsString()
  @IsOptional()
  @MaxLength(500)
  reason?: string;
}

export class EventOrganizerOwnershipResponseDto {
  id: string;
  memberId: string;
  githubHandle: string;
  scope: string[];
  createdByMemberId: string;
  updatedByMemberId: string;
  createdAt: Date;
  updatedAt: Date;
}
