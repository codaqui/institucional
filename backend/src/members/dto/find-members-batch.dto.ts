import { ArrayMaxSize, IsArray, IsOptional, IsString } from 'class-validator';

const MAX_BATCH_SIZE = 50;

export class FindMembersBatchDto {
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(MAX_BATCH_SIZE)
  handles?: string[];
}
