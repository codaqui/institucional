import {
  IsUUID,
  IsNumber,
  IsString,
  IsUrl,
  IsOptional,
  Min,
  MaxLength,
  ValidateNested,
} from 'class-validator';

export class CreateReimbursementDto {
  @IsUUID()
  accountId: string;

  @IsNumber()
  @Min(0.01)
  amount: number;

  @IsString()
  @MaxLength(500)
  description: string;

  @IsUrl()
  receiptUrl: string;

  /** Evento interno ao qual a despesa/reembolso está vinculada. */
  @IsOptional()
  @IsUUID()
  eventId?: string;

  /** Ativação de evento externo ao qual a despesa/reembolso está vinculada. */
  @IsOptional()
  @IsUUID()
  externalActivationId?: string;

  /** Metadados livres do evento (título, data etc.) para exibição. */
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  eventMetadata?: string;
}
