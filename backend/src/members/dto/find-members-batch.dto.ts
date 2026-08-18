import { IsEmail, IsOptional, IsString } from 'class-validator';

export class FindMembersBatchDto {
  @IsOptional()
  @IsString({ each: true })
  handles?: string[];

  @IsOptional()
  @IsEmail({}, { each: true })
  emails?: string[];
}
