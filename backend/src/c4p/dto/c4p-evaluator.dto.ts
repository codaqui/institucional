import { IsString, MaxLength, MinLength } from 'class-validator';

export class InviteC4pEvaluatorDto {
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  handleOrEmail: string;
}
