import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsISO8601,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';
import { TicketKind } from '../entities/ticket-type.entity';
import { EventStaffRole } from '../entities/event-staff.entity';

export class CreateTicketTypeDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsEnum(TicketKind)
  kind: TicketKind;

  @IsInt()
  @Min(0)
  priceCents: number;

  @IsInt()
  @Min(0)
  quantityTotal: number;

  @IsOptional()
  @IsISO8601()
  salesStartAt?: string;

  @IsOptional()
  @IsISO8601()
  salesEndAt?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10)
  maxPerOrder?: number;
}

export class UpdateTicketTypeDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  name?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  priceCents?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  quantityTotal?: number;

  @IsOptional()
  @IsISO8601()
  salesStartAt?: string;

  @IsOptional()
  @IsISO8601()
  salesEndAt?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10)
  maxPerOrder?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class AddStaffDto {
  @IsUUID()
  memberId: string;

  @IsEnum(EventStaffRole)
  staffRole: EventStaffRole;
}

export class RegisterDto {
  @IsUUID()
  ticketTypeId: string;
}

export class CheckoutAttendeeDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  email: string;
}

export class CheckoutDto {
  @IsUUID()
  ticketTypeId: string;

  @IsInt()
  @Min(1)
  quantity: number;

  /**
   * Conformidade CDC art. 49: termos de compra e política de reembolso
   * precisam ser aceitos explicitamente no checkout.
   */
  @IsBoolean()
  acceptTerms: boolean;

  /**
   * Lista de participantes. Opcional: quando não informada ou tamanho
   * diferente de `quantity`, o comprador é usado para todos os ingressos.
   * Quando informada, cada objeto define nome/e-mail do participante
   * (permite comprar ingresso nominado a outra pessoa).
   */
  @IsOptional()
  attendees?: CheckoutAttendeeDto[];

  /**
   * Modo de UI do Stripe Checkout.
   * - 'hosted' (padrão): redireciona para a página do Stripe.
   * - 'embedded': renderiza o formulário de pagamento dentro da página
   *   do evento (retorna clientSecret).
   */
  @IsOptional()
  @IsEnum(['hosted', 'embedded'] as const)
  uiMode?: 'hosted' | 'embedded';
}

export class RefundOrderDto {
  @IsOptional()
  @IsUUID('4', { each: true })
  registrationIds?: string[];
}
