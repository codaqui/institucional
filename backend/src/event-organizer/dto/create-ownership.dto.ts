import {
  ArrayNotEmpty,
  IsArray,
  IsString,
  IsUUID,
  Matches,
} from 'class-validator';

/**
 * Formato de scope: `<source>:<sourceId>:<eventId|*>`
 * Segmentos não podem ser vazios nem conter '/', ':' ou '*'.
 */
export const SCOPE_REGEX = /^[^/:*]+:[^/:*]+:(\*|[^/:*]+)$/;

export class CreateOwnershipDto {
  @IsUUID()
  memberId: string;

  @IsString()
  @Matches(/^[a-zA-Z0-9_-]+$/, {
    message: 'githubHandle inválido.',
  })
  githubHandle: string;

  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  @Matches(SCOPE_REGEX, {
    each: true,
    message:
      'Cada scope deve ter o formato <source>:<sourceId>:<eventId|*> (ex.: meetup:devparana:*).',
  })
  scope: string[];
}
