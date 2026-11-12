import {
  Equals,
  IsBoolean,
  IsEmail,
  IsOptional,
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

  @IsOptional()
  @IsString()
  @MaxLength(60)
  speakerPhone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  speakerRole?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  linkedin?: string;

  @IsOptional()
  @IsBoolean()
  spokeBefore?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  level?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  track?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20000)
  bio?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  photoUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20000)
  extraNotes?: string;

  @Equals(true, {
    message: 'O consentimento para tratamento dos dados é obrigatório.',
  })
  consent: true;

  // turnstileToken NÃO é declarado aqui: o TurnstileGuard lê o body bruto
  // (padrão do guest-claim de eventos), e o ValidationPipe global com
  // forbidNonWhitelisted rejeitaria a propriedade sem decorator.
}
