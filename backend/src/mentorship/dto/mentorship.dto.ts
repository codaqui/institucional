import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsBoolean, IsDate, IsEmail, IsInt, IsISO8601, IsOptional, IsString, IsTimeZone, IsUUID, Matches, Max, MaxLength, Min, MinLength } from 'class-validator';

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

const WEEKLY_TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

export class AvailabilityRuleDto {
  @IsString()
  @Matches(WEEKLY_TIME_PATTERN)
  startTime: string;

  @IsString()
  @Matches(WEEKLY_TIME_PATTERN)
  endTime: string;

  @IsOptional()
  @IsString()
  @IsTimeZone()
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
  @Type(() => Date)
  @IsDate()
  guestConsentAt?: Date;
}

export class ConfirmSessionDto {
  @IsString()
  @Matches(/^https:\/\//)
  @MaxLength(2000)
  meetLink: string;
}

export class CancelSessionDto {
  @IsString()
  @MinLength(3)
  @MaxLength(500)
  reason: string;
}

export class RateSessionDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(5)
  rating: number;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  feedback?: string;
}

export class ListSessionsQueryDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 50;
}

export class ListMentorsQueryDto extends ListSessionsQueryDto {}

export class UpdateMentorAdminDto extends UpdateMentorProfileDto {
  @IsUUID()
  memberId: string;

  @IsBoolean()
  active: boolean;
}


export class MemberOptionsQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;
}

export class AssignMenteeDto {
  @IsUUID()
  memberId: string;
}
