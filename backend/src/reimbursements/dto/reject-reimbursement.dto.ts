import { IsString, MaxLength, MinLength } from 'class-validator';

export class RejectReimbursementDto {
  @IsString()
  @MinLength(1)
  @MaxLength(1000)
  reviewNote: string;
}
