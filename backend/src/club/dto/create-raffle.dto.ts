import { IsString, IsInt, IsDateString, IsOptional, Min } from 'class-validator';

export class CreateRaffleDto {
  @IsString()
  title: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsInt()
  @Min(1)
  costInCoins: number;

  @IsDateString()
  closesAt: string;
}
