import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsEmail,
  IsNotEmpty,
  IsString,
  MaxLength,
} from 'class-validator';

export class ClaimGuestDto {
  @IsString()
  @IsNotEmpty()
  token: string;

  @Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
  @IsNotEmpty()
  @IsString()
  @MaxLength(160)
  name: string;

  @Transform(({ value }) => typeof value === 'string' ? value.trim().toLowerCase() : value)
  @IsNotEmpty()
  @IsEmail()
  email: string;

  @IsBoolean()
  @Transform(({ value }) => value === true || value === 'true')
  consent: boolean;

  @IsString()
  @IsNotEmpty()
  turnstileToken: string;
}
