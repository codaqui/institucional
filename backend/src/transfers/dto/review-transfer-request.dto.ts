import { IsOptional, IsString, MaxLength } from 'class-validator';

export class ReviewTransferRequestDto {
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  reviewNote?: string;
}
