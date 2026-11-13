import {
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class UpsertC4pVoteDto {
  @IsObject()
  scores: Record<string, number>;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  comment?: string;
}
