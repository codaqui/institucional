import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import type { CheckoutInterval, CheckoutUiMode } from '../stripe.service';

export const MIN_DONATION_CENTS = 100;
export const MAX_DONATION_CENTS = 5_000_000;

export const DONATION_AMOUNT_MESSAGE =
  'O valor da doação deve ser de R$ 1,00 a R$ 50.000,00, informado em centavos inteiros.';

export class CheckoutRecurringDto {
  @IsIn(['month', 'year'])
  interval: CheckoutInterval;
}

export class CreateCheckoutSessionDto {
  @IsInt({ message: DONATION_AMOUNT_MESSAGE })
  @Min(MIN_DONATION_CENTS, { message: DONATION_AMOUNT_MESSAGE })
  @Max(MAX_DONATION_CENTS, { message: DONATION_AMOUNT_MESSAGE })
  amount: number;

  @IsString()
  @IsNotEmpty()
  communityId: string;

  @IsOptional()
  @IsIn(['embedded_page', 'hosted'])
  uiMode?: CheckoutUiMode;

  @IsOptional()
  @ValidateNested()
  @Type(() => CheckoutRecurringDto)
  recurring?: CheckoutRecurringDto;

  @IsOptional()
  @IsString()
  returnPath?: string;
}
