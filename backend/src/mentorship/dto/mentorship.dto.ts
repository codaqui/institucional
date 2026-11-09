import { ArrayMaxSize, ArrayMinSize, IsArray, IsOptional, IsString, MaxLength } from 'class-validator';

export class MentorApplicationDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(10)
  @IsString({ each: true })
  @MaxLength(40, { each: true })
  areas: string[];

  @IsOptional()
  @IsString()
  @MaxLength(500)
  focus?: string;
}

export class UpdateMentorProfileDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(10)
  @IsString({ each: true })
  @MaxLength(40, { each: true })
  areas: string[];

  @IsOptional()
  @IsString()
  @MaxLength(500)
  focus?: string;
}
