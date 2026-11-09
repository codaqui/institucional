import { PartialType } from '@nestjs/swagger';
import { IsDateString, IsNotEmpty, IsNumber, IsString, IsUUID, Matches, MaxLength, Min } from 'class-validator';

export class CreateProjectHourDto {
  @IsUUID()
  memberId: string;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  hours: number;

  @IsDateString()
  occurredAt: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  description: string;

  @IsString()
  @IsNotEmpty()
  @Matches(/\S/)
  @MaxLength(128)
  idempotencyKey: string;
}

export class UpdateProjectHourDto extends PartialType(CreateProjectHourDto) {}
