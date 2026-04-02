import {
  IsUUID,
  IsNumber,
  IsString,
  Min,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateTransferRequestDto {
  @IsUUID()
  sourceAccountId: string;

  @IsUUID()
  destinationAccountId: string;

  @IsNumber()
  @Min(0.01)
  amount: number;

  @IsString()
  @MinLength(1)
  @MaxLength(500)
  reason: string;
}
