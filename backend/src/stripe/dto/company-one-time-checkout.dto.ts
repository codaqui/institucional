import {
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import type { CheckoutUiMode } from '../stripe.service';
import {
  DONATION_AMOUNT_MESSAGE,
  MAX_DONATION_CENTS,
  MIN_DONATION_CENTS,
} from './create-checkout-session.dto';

export class CompanyOneTimeCheckoutDto {
  @IsString()
  @IsNotEmpty()
  companyId: string;

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
  @IsString()
  returnPath?: string;
}
