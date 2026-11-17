import { IsOptional, IsString, MaxLength } from 'class-validator';

export class ReviewAccountDeletionRequestDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reviewNote?: string;
}
