import {
  ArrayNotEmpty,
  IsArray,
  IsISO8601,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';

/** POST /events/external/:eventKey/activate */
export class ActivateExternalDto {
  /** subconjunto de ['checkin', 'certificates', 'payments'] */
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  features: string[];

  /** conta ledger da comunidade organizadora (obrigatório) */
  @IsString()
  @IsNotEmpty()
  communityProjectKey: string;

  /** título amigável usado em certificados/relatórios */
  @IsString()
  @IsOptional()
  title?: string;

  /** data/hora de início do evento (copiada do snapshot) */
  @IsISO8601()
  @IsOptional()
  startAt?: string;
}

/** POST /events/:id/checkin e POST /events/external/:eventKey/checkin */
export class CheckinDto {
  /** token do QR code (checkinToken da inscrição) */
  @IsString()
  @IsNotEmpty()
  token: string;
}
