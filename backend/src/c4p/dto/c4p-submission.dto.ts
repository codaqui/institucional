import {
  IsBoolean,
  IsEmail,
  IsString,
  Length,
  MaxLength,
} from 'class-validator';

export class SubmitC4pTalkDto {
  @IsString()
  @Length(1, 160)
  speakerName: string;

  @IsEmail()
  @MaxLength(160)
  speakerEmail: string;

  @IsString()
  @Length(1, 255)
  title: string;

  @IsString()
  @Length(1, 20000)
  summary: string;

  @IsString()
  @MaxLength(60)
  speakerPhone?: string;

  @IsString()
  @MaxLength(200)
  speakerRole?: string;

  @IsString()
  @MaxLength(255)
  linkedin?: string;

  @IsBoolean()
  spokeBefore?: boolean;

  @IsString()
  @MaxLength(40)
  level?: string;

  @IsString()
  @MaxLength(255)
  track?: string;

  @IsString()
  @MaxLength(20000)
  bio?: string;

  @IsString()
  @MaxLength(2000)
  photoUrl?: string;

  @IsString()
  @MaxLength(20000)
  extraNotes?: string;

  consent: true;

  turnstileToken?: string;
}
