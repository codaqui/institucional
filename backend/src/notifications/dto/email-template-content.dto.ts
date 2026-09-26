import { IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class EmailTemplateContentDto {
  @ApiProperty({ example: 'Inscrição confirmada — {{eventTitle}}' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  subject: string;

  @ApiProperty({ example: 'Olá, {{attendeeName}}!' })
  @IsString()
  @IsNotEmpty()
  bodyMarkdown: string;
}
