import { IsOptional, IsString, IsUrl, MaxLength } from 'class-validator';

export class UpdateMemberDto {
  @IsOptional()
  @IsString()
  @MaxLength(280, { message: 'A bio não pode ultrapassar 280 caracteres.' })
  bio?: string;

  @IsOptional()
  @IsUrl({}, { message: 'O LinkedIn deve ser uma URL válida.' })
  linkedinUrl?: string;
}
