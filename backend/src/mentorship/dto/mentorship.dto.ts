import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsEmail, IsInt, IsISO8601, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from 'class-validator';

export class MentorApplicationDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(10)
  @IsString({ each: true })
  @MaxLength(40, { each: true })
  areas: string[];

  @IsOptional()
  @IsString()
  @MaxLength(500)
  focus?: string;
}

export class UpdateMentorProfileDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(10)
  @IsString({ each: true })
  @MaxLength(40, { each: true })
  areas: string[];

  @IsOptional()
  @IsString()
  @MaxLength(500)
  focus?: string;
}

export class AvailabilityRuleDto {
  @IsString()
  startTime: string;

  @IsString()
  endTime: string;

  @IsOptional()
  @IsString()
  timeZone?: string;
}

export class ReserveSlotDto {
  @IsUUID()
  mentorId: string;

  @IsISO8601()
  scheduledAt: string;

  @Type(() => Number)
  @IsInt()
  @Min(15)
  @Max(240)
  durationMin: number;

  @IsString()
  @MaxLength(160)
  menteeName: string;

  @IsEmail()
  menteeEmail: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(10)
  @IsString({ each: true })
  @MaxLength(40, { each: true })
  topicTags: string[];

  @IsOptional()
  guestConsentAt?: Date;
}
