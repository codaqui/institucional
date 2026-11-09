import { PartialType } from '@nestjs/swagger';
import { IsDateString, IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreatePartnershipDto {
  @IsIn(['termo', 'pontual'])
  kind: 'termo' | 'pontual';

  @IsDateString()
  startedAt: string;

  @IsOptional()
  @IsDateString()
  endsAt?: string | null;

  @IsOptional()
  @IsIn(['active', 'ended', 'canceled'])
  status?: 'active' | 'ended' | 'canceled';

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}

export class UpdatePartnershipDto extends PartialType(CreatePartnershipDto) {}
